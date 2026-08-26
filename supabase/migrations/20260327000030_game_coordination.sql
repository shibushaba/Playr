-- PLAYR Step 5: contact consent, chat tightening, check-in RPCs,
-- attendance, trust stats, reports/blocks, game event types

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------

alter table public.game_players
  add column if not exists contact_consent_at timestamptz;

alter table public.check_ins
  add column if not exists checked_in_by uuid references public.profiles (id) on delete set null;

alter table public.reports
  add column if not exists message_id uuid references public.game_messages (id) on delete set null;

alter table public.reports drop constraint if exists reports_has_target;
alter table public.reports
  add constraint reports_has_target check (
    reported_user_id is not null
    or game_id is not null
    or venue_id is not null
    or message_id is not null
  );

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_blocks_distinct check (blocker_id <> blocked_user_id),
  unique (blocker_id, blocked_user_id)
);

create index if not exists user_blocks_blocker_idx on public.user_blocks (blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_user_id);

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own
on public.user_blocks for select
to authenticated
using (blocker_id = auth.uid());

drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own
on public.user_blocks for insert
to authenticated
with check (blocker_id = auth.uid() and blocked_user_id <> auth.uid());

drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own
on public.user_blocks for delete
to authenticated
using (blocker_id = auth.uid());

grant select, insert, delete on table public.user_blocks to authenticated;

-- Expand game_events types for attendance/check-in
alter table public.game_events drop constraint if exists game_events_type_check;
alter table public.game_events
  add constraint game_events_type_check check (
    event_type in (
      'game_created',
      'player_reserved',
      'reservation_expired',
      'player_confirmed',
      'player_cancelled',
      'player_waitlisted',
      'waitlist_promoted',
      'game_confirmed',
      'game_cancelled',
      'game_started',
      'game_completed',
      'game_updated',
      'player_checked_in',
      'attendance_marked',
      'attendance_disputed'
    )
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.game_kickoff_at(p_game_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select ((g.game_date + g.start_time) at time zone 'Asia/Kolkata')
  from public.games g
  where g.id = p_game_id;
$$;

create or replace function public.is_contact_eligible(p_game_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.game_players gp
    where gp.game_id = p_game_id
      and gp.user_id = p_user_id
      and gp.status in ('reserved', 'confirmed', 'attended')
      and (
        gp.status <> 'reserved'
        or gp.reservation_expires_at is null
        or gp.reservation_expires_at > timezone('utc', now())
      )
  )
  or public.is_game_host_or_cohost(p_game_id, p_user_id);
$$;

create or replace function public.is_chat_participant(p_game_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_game_host_or_cohost(p_game_id, p_user_id)
  or exists (
    select 1
    from public.game_players gp
    where gp.game_id = p_game_id
      and gp.user_id = p_user_id
      and gp.status in ('confirmed', 'attended')
  );
$$;

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks ub
    where (ub.blocker_id = p_a and ub.blocked_user_id = p_b)
       or (ub.blocker_id = p_b and ub.blocked_user_id = p_a)
  );
$$;

grant execute on function public.game_kickoff_at(uuid) to authenticated;
grant execute on function public.is_contact_eligible(uuid, uuid) to authenticated;
grant execute on function public.is_chat_participant(uuid, uuid) to authenticated;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Contact phone (tightened)
-- ---------------------------------------------------------------------------

create or replace function public.get_game_contact_phone(
  p_game_id uuid,
  p_target_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  g public.games%rowtype;
  phone_out text;
begin
  if viewer is null then
    return null;
  end if;

  select * into g from public.games where id = p_game_id;
  if not found then
    return null;
  end if;

  if public.is_blocked_between(viewer, p_target_user_id) then
    return null;
  end if;

  -- Own phone
  if viewer = p_target_user_id then
    select phone into phone_out from public.profiles where id = p_target_user_id;
    return phone_out;
  end if;

  -- Host/co-host → reserved/confirmed/attended participant
  if public.is_game_host_or_cohost(p_game_id, viewer)
     and public.is_contact_eligible(p_game_id, p_target_user_id) then
    select phone into phone_out from public.profiles where id = p_target_user_id;
    return phone_out;
  end if;

  -- Confirmed/reserved participant → host only
  if public.is_contact_eligible(p_game_id, viewer)
     and p_target_user_id = g.host_id then
    select phone into phone_out from public.profiles where id = p_target_user_id;
    return phone_out;
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Join with contact consent
-- ---------------------------------------------------------------------------

drop function if exists public.join_game(uuid);
drop function if exists public.join_game(uuid, boolean);
drop function if exists public.join_waitlist(uuid);
drop function if exists public.join_waitlist(uuid, boolean);

create or replace function public.join_game(
  p_game_id uuid,
  p_contact_consent boolean default false
)
returns public.game_players
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.games%rowtype;
  expires_at timestamptz;
  row_out public.game_players;
  join_status public.game_player_status;
  consent_at timestamptz;
begin
  if uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not coalesce(p_contact_consent, false) then
    raise exception 'CONTACT_CONSENT_REQUIRED' using errcode = 'P0001';
  end if;

  select * into g from public.games where id = p_game_id for update;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;

  if g.status <> 'open' then
    raise exception 'GAME_CLOSED' using errcode = 'P0001';
  end if;

  if g.confirmation_deadline <= timezone('utc', now()) then
    raise exception 'GAME_CLOSED' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.game_players gp
    where gp.game_id = p_game_id
      and gp.user_id = uid
      and gp.status in ('reserved', 'confirmed', 'waitlisted', 'attended', 'no_show')
  ) then
    raise exception 'ALREADY_JOINED' using errcode = 'P0001';
  end if;

  if public.is_game_full(p_game_id) then
    join_status := 'waitlisted';
    expires_at := null;
  else
    join_status := 'reserved';
    expires_at := least(
      timezone('utc', now()) + interval '8 minutes',
      g.confirmation_deadline
    );
  end if;

  consent_at := timezone('utc', now());

  insert into public.game_players (
    game_id, user_id, role, status, reservation_expires_at, contact_consent_at
  ) values (
    p_game_id, uid, 'player', join_status, expires_at, consent_at
  )
  returning * into row_out;

  return row_out;
end;
$$;

create or replace function public.join_waitlist(
  p_game_id uuid,
  p_contact_consent boolean default false
)
returns public.game_players
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.games%rowtype;
  row_out public.game_players;
begin
  if uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not coalesce(p_contact_consent, false) then
    raise exception 'CONTACT_CONSENT_REQUIRED' using errcode = 'P0001';
  end if;

  select * into g from public.games where id = p_game_id for update;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;

  if g.status = 'cancelled' then
    raise exception 'GAME_CANCELLED' using errcode = 'P0001';
  end if;

  if g.status <> 'open' then
    raise exception 'GAME_CLOSED' using errcode = 'P0001';
  end if;

  if g.confirmation_deadline <= timezone('utc', now()) then
    raise exception 'GAME_CLOSED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.game_players gp
    where gp.game_id = p_game_id
      and gp.user_id = uid
      and gp.status in ('reserved', 'confirmed', 'waitlisted', 'attended', 'no_show')
  ) then
    raise exception 'ALREADY_JOINED' using errcode = 'P0001';
  end if;

  if public.get_game_player_count(p_game_id) < g.maximum_players then
    raise exception 'GAME_NOT_FULL' using errcode = 'P0001';
  end if;

  insert into public.game_players (
    game_id, user_id, role, status, reservation_expires_at, contact_consent_at
  ) values (
    p_game_id, uid, 'player', 'waitlisted', null, timezone('utc', now())
  )
  returning * into row_out;

  perform public.log_game_event(
    p_game_id, 'player_waitlisted', uid,
    jsonb_build_object('game_player_id', row_out.id)
  );

  return row_out;
end;
$$;

grant execute on function public.join_game(uuid, boolean) to authenticated;
grant execute on function public.join_waitlist(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Chat RLS (confirmed + host only; block filter on insert)
-- ---------------------------------------------------------------------------

drop policy if exists game_messages_select on public.game_messages;
create policy game_messages_select
on public.game_messages for select
to authenticated
using (public.is_chat_participant(game_id, auth.uid()));

drop policy if exists game_messages_insert on public.game_messages;
create policy game_messages_insert
on public.game_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_chat_participant(game_id, auth.uid())
  and exists (
    select 1 from public.games g
    where g.id = game_id
      and g.status in ('open', 'confirmed', 'live', 'completed')
  )
  and not exists (
    select 1 from public.games g
    where g.id = game_id
      and public.is_blocked_between(auth.uid(), g.host_id)
  )
);

-- ---------------------------------------------------------------------------
-- Check-in: revoke direct client inserts; use RPCs
-- ---------------------------------------------------------------------------

drop policy if exists check_ins_insert_own on public.check_ins;
-- Keep select; inserts via security definer RPCs only
revoke insert on table public.check_ins from authenticated;
grant select on table public.check_ins to authenticated;

-- Drop broad player update on game_players status for attendance — hosts still need updates via RPC
-- Keep existing update policy but check-in/attendance go through RPCs that are security definer

create or replace function public.check_in_with_location(
  p_game_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision default 250
)
returns public.check_ins
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.games%rowtype;
  gp public.game_players%rowtype;
  v public.venues%rowtype;
  kickoff timestamptz;
  now_utc timestamptz := timezone('utc', now());
  dist_m double precision;
  radius double precision := greatest(50, least(coalesce(p_radius_meters, 250), 500));
  row_out public.check_ins;
begin
  if uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'LOCATION_REQUIRED' using errcode = 'P0001';
  end if;

  select * into g from public.games where id = p_game_id;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;

  if g.status in ('cancelled', 'draft') then
    raise exception 'CHECKIN_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select * into gp
  from public.game_players
  where game_id = p_game_id and user_id = uid
  for update;

  if not found or gp.status not in ('confirmed', 'attended') then
    raise exception 'CHECKIN_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  if gp.status = 'no_show' then
    raise exception 'CHECKIN_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.check_ins c where c.game_id = p_game_id and c.user_id = uid) then
    raise exception 'ALREADY_CHECKED_IN' using errcode = 'P0001';
  end if;

  kickoff := public.game_kickoff_at(p_game_id);
  if kickoff is null then
    raise exception 'CHECKIN_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if now_utc < kickoff - interval '30 minutes' then
    raise exception 'CHECKIN_TOO_EARLY' using errcode = 'P0001';
  end if;

  if now_utc > kickoff + interval '15 minutes' then
    raise exception 'CHECKIN_TOO_LATE' using errcode = 'P0001';
  end if;

  select * into v from public.venues where id = g.venue_id;
  if not found or v.latitude is null or v.longitude is null then
    raise exception 'VENUE_LOCATION_MISSING' using errcode = 'P0001';
  end if;

  if v.location is not null then
    dist_m := st_distance(
      v.location,
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography
    );
  else
    dist_m := st_distance(
      st_setsrid(st_makepoint(v.longitude, v.latitude), 4326)::geography,
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography
    );
  end if;

  if dist_m > radius then
    raise exception 'TOO_FAR:%', round(dist_m)::text using errcode = 'P0001';
  end if;

  insert into public.check_ins (
    game_id, user_id, method, latitude, longitude, checked_in_by
  ) values (
    p_game_id, uid, 'location', p_latitude, p_longitude, uid
  )
  returning * into row_out;

  update public.game_players
  set checked_in_at = row_out.checked_in_at,
      status = case when status = 'confirmed' then 'attended'::public.game_player_status else status end
  where id = gp.id;

  perform public.log_game_event(
    p_game_id, 'player_checked_in', uid,
    jsonb_build_object('method', 'location', 'distance_meters', round(dist_m))
  );

  return row_out;
end;
$$;

create or replace function public.host_manual_check_in(
  p_game_id uuid,
  p_user_id uuid
)
returns public.check_ins
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.games%rowtype;
  gp public.game_players%rowtype;
  kickoff timestamptz;
  now_utc timestamptz := timezone('utc', now());
  row_out public.check_ins;
begin
  if uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not public.is_game_host_or_cohost(p_game_id, uid) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into g from public.games where id = p_game_id;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;

  if g.status in ('cancelled', 'draft') then
    raise exception 'CHECKIN_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select * into gp
  from public.game_players
  where game_id = p_game_id and user_id = p_user_id
  for update;

  if not found or gp.status not in ('confirmed', 'attended') then
    raise exception 'CHECKIN_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.check_ins c where c.game_id = p_game_id and c.user_id = p_user_id) then
    raise exception 'ALREADY_CHECKED_IN' using errcode = 'P0001';
  end if;

  kickoff := public.game_kickoff_at(p_game_id);
  if kickoff is null then
    raise exception 'CHECKIN_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Host window: 30 min before through 2 hours after kickoff
  if now_utc < kickoff - interval '30 minutes' then
    raise exception 'CHECKIN_TOO_EARLY' using errcode = 'P0001';
  end if;
  if now_utc > kickoff + interval '2 hours' then
    raise exception 'CHECKIN_TOO_LATE' using errcode = 'P0001';
  end if;

  insert into public.check_ins (
    game_id, user_id, method, latitude, longitude, checked_in_by
  ) values (
    p_game_id, p_user_id, 'manual', null, null, uid
  )
  returning * into row_out;

  update public.game_players
  set checked_in_at = row_out.checked_in_at,
      status = case when status = 'confirmed' then 'attended'::public.game_player_status else status end
  where id = gp.id;

  perform public.log_game_event(
    p_game_id, 'player_checked_in', uid,
    jsonb_build_object('method', 'manual', 'subject_user_id', p_user_id)
  );

  return row_out;
end;
$$;

create or replace function public.get_check_in_window(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kickoff timestamptz;
  now_utc timestamptz := timezone('utc', now());
begin
  kickoff := public.game_kickoff_at(p_game_id);
  if kickoff is null then
    return jsonb_build_object('available', false, 'reason', 'unknown');
  end if;

  return jsonb_build_object(
    'kickoff_at', kickoff,
    'opens_at', kickoff - interval '30 minutes',
    'closes_at', kickoff + interval '15 minutes',
    'host_closes_at', kickoff + interval '2 hours',
    'now', now_utc,
    'player_window_open', now_utc >= kickoff - interval '30 minutes'
      and now_utc <= kickoff + interval '15 minutes',
    'host_window_open', now_utc >= kickoff - interval '30 minutes'
      and now_utc <= kickoff + interval '2 hours',
    'too_early', now_utc < kickoff - interval '30 minutes',
    'too_late', now_utc > kickoff + interval '15 minutes'
  );
end;
$$;

grant execute on function public.check_in_with_location(uuid, double precision, double precision, double precision)
  to authenticated;
grant execute on function public.host_manual_check_in(uuid, uuid) to authenticated;
grant execute on function public.get_check_in_window(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Attendance: mark no-show / confirm attended (host)
-- ---------------------------------------------------------------------------

create or replace function public.host_mark_attendance(
  p_game_id uuid,
  p_user_id uuid,
  p_status public.attendance_feedback_status,
  p_notes text default null
)
returns public.game_attendance_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.games%rowtype;
  gp public.game_players%rowtype;
  row_out public.game_attendance_feedback;
  new_player_status public.game_player_status;
begin
  if uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not public.is_game_host_or_cohost(p_game_id, uid) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_user_id = uid then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into g from public.games where id = p_game_id;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;

  if g.status not in ('live', 'completed', 'confirmed') then
    raise exception 'ATTENDANCE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select * into gp
  from public.game_players
  where game_id = p_game_id and user_id = p_user_id
  for update;

  if not found or gp.status not in ('confirmed', 'attended', 'no_show') then
    raise exception 'ATTENDANCE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if p_status = 'no_show' then
    new_player_status := 'no_show';
  elsif p_status = 'attended' then
    new_player_status := 'attended';
  else
    new_player_status := gp.status;
  end if;

  insert into public.game_attendance_feedback (
    game_id, subject_user_id, submitted_by, attendance_status, notes
  ) values (
    p_game_id, p_user_id, uid, p_status, nullif(trim(coalesce(p_notes, '')), '')
  )
  on conflict (game_id, subject_user_id, submitted_by)
  do update set
    attendance_status = excluded.attendance_status,
    notes = excluded.notes
  returning * into row_out;

  update public.game_players
  set status = new_player_status
  where id = gp.id;

  perform public.log_game_event(
    p_game_id, 'attendance_marked', uid,
    jsonb_build_object(
      'subject_user_id', p_user_id,
      'attendance_status', p_status::text
    )
  );

  return row_out;
end;
$$;

grant execute on function public.host_mark_attendance(uuid, uuid, public.attendance_feedback_status, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Dispute attendance (report; does not auto-alter)
-- ---------------------------------------------------------------------------

create or replace function public.dispute_attendance(
  p_game_id uuid,
  p_reason text,
  p_description text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gp public.game_players%rowtype;
  row_out public.reports;
begin
  if uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into gp
  from public.game_players
  where game_id = p_game_id and user_id = uid;

  if not found then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  insert into public.reports (
    reporter_id, reported_user_id, game_id, reason, description
  ) values (
    uid,
    null,
    p_game_id,
    coalesce(nullif(trim(p_reason), ''), 'attendance_dispute'),
    coalesce(nullif(trim(p_description), ''), 'Player disputes attendance marking.')
  )
  returning * into row_out;

  perform public.log_game_event(
    p_game_id, 'attendance_disputed', uid,
    jsonb_build_object('report_id', row_out.id)
  );

  return row_out;
end;
$$;

grant execute on function public.dispute_attendance(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Create report (simple)
-- ---------------------------------------------------------------------------

create or replace function public.create_report(
  p_reason text,
  p_description text default null,
  p_reported_user_id uuid default null,
  p_game_id uuid default null,
  p_venue_id uuid default null,
  p_message_id uuid default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_out public.reports;
begin
  if uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'INVALID_REPORT' using errcode = 'P0001';
  end if;

  if p_reported_user_id is null
     and p_game_id is null
     and p_venue_id is null
     and p_message_id is null then
    raise exception 'INVALID_REPORT' using errcode = 'P0001';
  end if;

  if p_reported_user_id is not null and p_reported_user_id = uid then
    raise exception 'INVALID_REPORT' using errcode = 'P0001';
  end if;

  insert into public.reports (
    reporter_id, reported_user_id, game_id, venue_id, message_id, reason, description
  ) values (
    uid,
    p_reported_user_id,
    p_game_id,
    p_venue_id,
    p_message_id,
    trim(p_reason),
    nullif(trim(coalesce(p_description, '')), '')
  )
  returning * into row_out;

  return row_out;
end;
$$;

grant execute on function public.create_report(text, text, uuid, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Trust / reliability (derived, read-only)
-- ---------------------------------------------------------------------------

create or replace function public.get_player_reliability(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  games_joined int := 0;
  attended int := 0;
  no_shows int := 0;
  late_cancels int := 0;
  hosted int := 0;
  completed_hosted int := 0;
  cancelled_hosted int := 0;
  attendance_rate numeric := null;
  completion_rate numeric := null;
  label text := 'New player';
begin
  if p_user_id is null then
    return null;
  end if;

  select
    count(*) filter (where gp.status in ('confirmed', 'attended', 'no_show')),
    count(*) filter (where gp.status = 'attended' or gp.checked_in_at is not null),
    count(*) filter (where gp.status = 'no_show'),
    count(*) filter (
      where gp.status = 'cancelled'
        and gp.cancelled_at is not null
        and exists (
          select 1 from public.games g
          where g.id = gp.game_id
            and gp.cancelled_at > public.game_kickoff_at(g.id) - interval '3 hours'
        )
    )
  into games_joined, attended, no_shows, late_cancels
  from public.game_players gp
  where gp.user_id = p_user_id;

  select
    count(*),
    count(*) filter (where g.status = 'completed'),
    count(*) filter (where g.status = 'cancelled')
  into hosted, completed_hosted, cancelled_hosted
  from public.games g
  where g.host_id = p_user_id
    and g.status in ('completed', 'cancelled', 'live', 'confirmed');

  if games_joined > 0 then
    attendance_rate := round((attended::numeric / games_joined::numeric) * 100);
  end if;

  if hosted > 0 then
    completion_rate := round((completed_hosted::numeric / hosted::numeric) * 100);
  end if;

  if games_joined = 0 and hosted = 0 then
    label := 'New player';
  elsif coalesce(attendance_rate, 100) >= 90 and no_shows <= 1 then
    label := 'Reliable player';
  elsif coalesce(attendance_rate, 100) >= 75 then
    label := 'Building reliability';
  else
    label := 'Needs improvement';
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'label', label,
    'games_joined', games_joined,
    'attended', attended,
    'no_shows', no_shows,
    'late_cancellations', late_cancels,
    'attendance_rate', attendance_rate,
    'games_hosted', hosted,
    'hosted_completed', completed_hosted,
    'hosted_cancelled', cancelled_hosted,
    'completion_rate', completion_rate
  );
end;
$$;

grant execute on function public.get_player_reliability(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- List check-ins for a game (no exact coords to non-self)
-- ---------------------------------------------------------------------------

create or replace function public.list_game_check_ins(p_game_id uuid)
returns table (
  user_id uuid,
  checked_in_at timestamptz,
  method public.check_in_method,
  checked_in_by uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not (
    public.is_game_host_or_cohost(p_game_id, auth.uid())
    or public.is_chat_participant(p_game_id, auth.uid())
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  select c.user_id, c.checked_in_at, c.method, c.checked_in_by
  from public.check_ins c
  where c.game_id = p_game_id;
end;
$$;

grant execute on function public.list_game_check_ins(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime (optional; ignore if publication missing)
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.game_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
  when others then null;
end $$;
