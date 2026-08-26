-- PLAYR final completion: privacy, locks, dispute, reports, invite errors

-- ---------------------------------------------------------------------------
-- B: Venue phone not public (anon + broad authenticated select)
-- ---------------------------------------------------------------------------

revoke select on table public.venues from anon;
revoke select on table public.venues from authenticated;

grant select (
  id, name, description, address, city, state, country,
  latitude, longitude, location, sports, facilities, opening_hours,
  website, image_url, status, created_by, claimed_by, created_at, updated_at
) on table public.venues to anon;

grant select (
  id, name, description, address, city, state, country,
  latitude, longitude, location, sports, facilities, opening_hours,
  website, image_url, status, created_by, claimed_by, created_at, updated_at
) on table public.venues to authenticated;

-- Creators may still manage their venue phone via update
grant update (
  name, description, address, city, state, country,
  latitude, longitude, sports, facilities, opening_hours,
  phone, website, image_url, status, updated_at
) on table public.venues to authenticated;

grant insert on table public.venues to authenticated;

-- ---------------------------------------------------------------------------
-- A1/B3: Protect confirmation_deadline / host_id for authenticated clients
-- Allow deadline recalc when game_date or start_time also changes.
-- ---------------------------------------------------------------------------

create or replace function public.protect_game_mutations()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Engine / service role (no JWT) may change status freely
  if auth.uid() is null then
    if tg_op = 'UPDATE'
       and old.status = 'confirmed'
       and new.status is distinct from old.status
       and (
         new.confirmation_deadline is distinct from old.confirmation_deadline
         or new.minimum_players is distinct from old.minimum_players
         or new.maximum_players is distinct from old.maximum_players
         or new.game_date is distinct from old.game_date
         or new.start_time is distinct from old.start_time
         or new.end_time is distinct from old.end_time
         or new.host_id is distinct from old.host_id
         or new.group_id is distinct from old.group_id
       ) then
      perform public.raise_playr_error(
        'CONFIRMED_GAME_LOCKED',
        'Confirmed games cannot change capacity, schedule, or host'
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.host_id is distinct from old.host_id then
    perform public.raise_playr_error(
      'FORBIDDEN',
      'Host cannot be transferred by clients'
    );
  end if;

  -- Clients must not manually set confirmation_deadline
  if tg_op = 'UPDATE'
     and new.confirmation_deadline is distinct from old.confirmation_deadline
     and new.game_date is not distinct from old.game_date
     and new.start_time is not distinct from old.start_time then
    perform public.raise_playr_error(
      'FORBIDDEN',
      'Confirmation deadline is set by PLAYR'
    );
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'open'
       and old.status = 'draft'
       and new.host_id = auth.uid() then
      null;
    elsif new.status = 'cancelled'
       and old.status in ('draft', 'open')
       and new.host_id = auth.uid() then
      null;
    else
      perform public.raise_playr_error(
        'STATUS_LOCKED',
        'Game status changes are controlled by PLAYR rules'
      );
    end if;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'confirmed'
     and (
       new.confirmation_deadline is distinct from old.confirmation_deadline
       or new.minimum_players is distinct from old.minimum_players
       or new.maximum_players is distinct from old.maximum_players
       or new.game_date is distinct from old.game_date
       or new.start_time is distinct from old.start_time
       or new.end_time is distinct from old.end_time
       or new.host_id is distinct from old.host_id
       or new.group_id is distinct from old.group_id
       or new.venue_id is distinct from old.venue_id
     ) then
    perform public.raise_playr_error(
      'CONFIRMED_GAME_LOCKED',
      'Confirmed games cannot change capacity, schedule, venue, or host'
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- B8: Tighten dispute_attendance
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
  g public.games%rowtype;
  gp public.game_players%rowtype;
  row_out public.reports;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select * into g from public.games where id = p_game_id;
  if not found then
    perform public.raise_playr_error('GAME_NOT_FOUND', 'Game not found.');
  end if;

  if g.status not in ('live', 'completed') then
    perform public.raise_playr_error(
      'ATTENDANCE_UNAVAILABLE',
      'Attendance disputes are only available after the game.'
    );
  end if;

  select * into gp
  from public.game_players
  where game_id = p_game_id and user_id = uid;

  if not found or gp.status not in ('confirmed', 'attended', 'no_show') then
    perform public.raise_playr_error('FORBIDDEN', 'You cannot dispute this attendance.');
  end if;

  if not exists (
    select 1
    from public.game_attendance_feedback f
    where f.game_id = p_game_id
      and f.subject_user_id = uid
  ) then
    perform public.raise_playr_error(
      'ATTENDANCE_UNAVAILABLE',
      'No attendance mark found to dispute.'
    );
  end if;

  insert into public.reports (
    reporter_id, reported_user_id, game_id, reason, description
  ) values (
    uid,
    g.host_id,
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

-- ---------------------------------------------------------------------------
-- B11: Reports insert RPC-only
-- ---------------------------------------------------------------------------

drop policy if exists reports_insert on public.reports;
drop policy if exists reports_insert_own on public.reports;
revoke insert on table public.reports from authenticated;
grant select on table public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- A9 / invite error codes
-- ---------------------------------------------------------------------------

create or replace function public.accept_game_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.game_invites%rowtype;
  validation jsonb;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  validation := public.validate_game_invite(p_token);
  if not coalesce((validation->>'valid')::boolean, false) then
    perform public.raise_playr_error('INVITE_INVALID', 'Invite is not valid.');
  end if;

  select * into inv
  from public.game_invites
  where id = (validation->>'invite_id')::uuid
  for update;

  if inv.invited_user_id is not null and inv.invited_user_id <> uid then
    perform public.raise_playr_error('FORBIDDEN', 'This invite is for another user.');
  end if;

  update public.game_invites
  set status = 'accepted',
      accepted_at = timezone('utc', now()),
      invited_user_id = coalesce(invited_user_id, uid)
  where id = inv.id
  returning * into inv;

  return jsonb_build_object(
    'accepted', true,
    'invite_id', inv.id,
    'game_id', inv.game_id
  );
end;
$$;

create or replace function public.accept_group_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.group_invites%rowtype;
  validation jsonb;
  member_row public.recurring_group_members;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  validation := public.validate_group_invite(p_token);
  if not coalesce((validation->>'valid')::boolean, false) then
    perform public.raise_playr_error('INVITE_INVALID', 'Invite is not valid.');
  end if;

  select * into inv
  from public.group_invites
  where id = (validation->>'invite_id')::uuid
  for update;

  if inv.invited_user_id is not null and inv.invited_user_id <> uid then
    perform public.raise_playr_error('FORBIDDEN', 'This invite is for another user.');
  end if;

  update public.group_invites
  set status = 'accepted',
      accepted_at = timezone('utc', now()),
      invited_user_id = coalesce(invited_user_id, uid)
  where id = inv.id
  returning * into inv;

  insert into public.recurring_group_members (group_id, user_id, role, status, joined_at)
  values (inv.group_id, uid, 'member', 'active', timezone('utc', now()))
  on conflict (group_id, user_id) do update
  set status = 'active',
      joined_at = coalesce(public.recurring_group_members.joined_at, excluded.joined_at)
  returning * into member_row;

  return jsonb_build_object(
    'accepted', true,
    'invite_id', inv.id,
    'group_id', inv.group_id,
    'member_id', member_row.id
  );
end;
$$;

create or replace function public.leave_group(p_group_id uuid)
returns public.recurring_group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_out public.recurring_group_members;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select * into row_out
  from public.recurring_group_members
  where group_id = p_group_id and user_id = uid
  for update;

  if not found then
    perform public.raise_playr_error('NOT_A_MEMBER', 'You are not a member of this group.');
  end if;

  if row_out.role = 'host' then
    perform public.raise_playr_error(
      'HOST_CANNOT_LEAVE',
      'The host cannot leave the group.'
    );
  end if;

  update public.recurring_group_members
  set status = 'left',
      role = 'member'
  where id = row_out.id
  returning * into row_out;

  return row_out;
end;
$$;

-- raise_playr_error: secure search_path (keep default on p_message)
create or replace function public.raise_playr_error(
  p_code text,
  p_message text default null
)
returns void
language plpgsql
set search_path = public
as $$
begin
  raise exception '%', p_code
    using errcode = 'P0001',
          detail = coalesce(p_message, p_code),
          hint = p_code;
end;
$$;
