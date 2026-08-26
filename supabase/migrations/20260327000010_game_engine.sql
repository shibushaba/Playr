-- PLAYR Game Engine
-- Hardened join/confirm, waitlist promotion, lifecycle processors,
-- recurring generation, game_events, confirmed-game locks, pg_cron tick

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- game_events (lightweight audit)
-- ---------------------------------------------------------------------------

create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint game_events_type_check check (
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
      'game_updated'
    )
  )
);

create index if not exists game_events_game_created_idx
  on public.game_events (game_id, created_at desc);
create index if not exists game_events_type_idx
  on public.game_events (event_type);

alter table public.game_events enable row level security;

create policy game_events_select_participants
on public.game_events for select
to authenticated
using (
  public.is_game_host_or_cohost(game_id, auth.uid())
  or public.is_active_participant(game_id, auth.uid())
);

grant select on table public.game_events to authenticated;

create or replace function public.log_game_event(
  p_game_id uuid,
  p_event_type text,
  p_actor_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.game_events (game_id, actor_id, event_type, metadata)
  values (p_game_id, p_actor_id, p_event_type, coalesce(p_metadata, '{}'::jsonb));
exception
  when others then
    raise warning 'PLAYR log_game_event failed: %', sqlerrm;
end;
$$;

-- Unique occurrence identity for recurring generation
create unique index if not exists games_group_occurrence_uidx
on public.games (group_id, game_date, start_time)
where group_id is not null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.raise_playr_error(p_code text, p_message text default null)
returns void
language plpgsql
as $$
begin
  raise exception '%', p_code
    using errcode = 'P0001',
          detail = coalesce(p_message, p_code);
end;
$$;

create or replace function public.expire_reservations_for_game(p_game_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
begin
  for r in
    select id, user_id
    from public.game_players
    where game_id = p_game_id
      and status = 'reserved'
      and reservation_expires_at is not null
      and reservation_expires_at <= timezone('utc', now())
    for update
  loop
    update public.game_players
    set status = 'cancelled',
        cancelled_at = timezone('utc', now())
    where id = r.id;
    perform public.log_game_event(
      p_game_id, 'reservation_expired', r.user_id,
      jsonb_build_object('game_player_id', r.id)
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.get_game_player_count(p_game_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.game_players gp
  where gp.game_id = p_game_id
    and (
      gp.status in ('confirmed', 'attended')
      or (
        gp.status = 'reserved'
        and gp.reservation_expires_at is not null
        and gp.reservation_expires_at > timezone('utc', now())
      )
    );
$$;

create or replace function public.get_confirmed_player_count(p_game_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.game_players gp
  where gp.game_id = p_game_id
    and gp.status in ('confirmed', 'attended');
$$;

-- ---------------------------------------------------------------------------
-- Confirmed game field lock + status protection
-- ---------------------------------------------------------------------------

create or replace function public.protect_game_mutations()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Client cannot freely set system statuses
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status then
    if new.status in ('confirmed', 'cancelled', 'live', 'completed') then
      if new.status = 'cancelled'
         and old.status in ('draft', 'open')
         and new.host_id = auth.uid() then
        null; -- host may cancel before confirmation
      elsif new.status = 'open'
         and old.status = 'draft'
         and new.host_id = auth.uid() then
        null;
      else
        perform public.raise_playr_error(
          'STATUS_LOCKED',
          'Game status changes are controlled by PLAYR rules'
        );
      end if;
    end if;
  end if;

  -- After confirmation, lock critical schedule/venue/capacity fields
  if tg_op = 'UPDATE'
     and old.status in ('confirmed', 'live', 'completed', 'cancelled') then
    if new.venue_id is distinct from old.venue_id
       or new.game_date is distinct from old.game_date
       or new.start_time is distinct from old.start_time
       or new.end_time is distinct from old.end_time
       or new.minimum_players is distinct from old.minimum_players
       or new.maximum_players is distinct from old.maximum_players
       or new.host_id is distinct from old.host_id
       or new.confirmation_deadline is distinct from old.confirmation_deadline
    then
      perform public.raise_playr_error(
        'CONFIRMED_GAME_LOCKED',
        'Confirmed games cannot change venue, schedule, or capacity. Cancel and create a new game instead.'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists games_protect_status on public.games;
drop trigger if exists games_protect_mutations on public.games;

create trigger games_protect_mutations
before update on public.games
for each row execute function public.protect_game_mutations();

-- Log game creation
create or replace function public.games_after_insert_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_game_event(
    new.id,
    'game_created',
    new.host_id,
    jsonb_build_object(
      'status', new.status,
      'confirmation_deadline', new.confirmation_deadline
    )
  );
  return new;
end;
$$;

drop trigger if exists games_after_insert_log on public.games;
create trigger games_after_insert_log
after insert on public.games
for each row execute function public.games_after_insert_log();

-- ---------------------------------------------------------------------------
-- Waitlist promotion
-- ---------------------------------------------------------------------------

create or replace function public.promote_next_waitlisted(p_game_id uuid)
returns public.game_players
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  wl public.game_players%rowtype;
  promoted public.game_players%rowtype;
  capacity integer;
begin
  select * into g from public.games where id = p_game_id for update;
  if not found then
    return null;
  end if;

  if g.status not in ('open', 'confirmed') then
    return null;
  end if;

  perform public.expire_reservations_for_game(p_game_id);
  capacity := public.get_game_player_count(p_game_id);
  if capacity >= g.maximum_players then
    return null;
  end if;

  select * into wl
  from public.game_players
  where game_id = p_game_id
    and status = 'waitlisted'
  order by joined_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  if g.status = 'confirmed' then
    update public.game_players
    set status = 'confirmed',
        reservation_expires_at = null
    where id = wl.id
    returning * into promoted;
  else
    update public.game_players
    set status = 'reserved',
        reservation_expires_at = least(
          timezone('utc', now()) + interval '8 minutes',
          g.confirmation_deadline
        )
    where id = wl.id
    returning * into promoted;
  end if;

  perform public.log_game_event(
    p_game_id,
    'waitlist_promoted',
    promoted.user_id,
    jsonb_build_object(
      'game_player_id', promoted.id,
      'new_status', promoted.status
    )
  );

  return promoted;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_game (atomic reserve — NOT waitlist)
-- ---------------------------------------------------------------------------

create or replace function public.join_game(p_game_id uuid)
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
  capacity integer;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in to join this game.');
  end if;

  select * into g from public.games where id = p_game_id for update;
  if not found then
    perform public.raise_playr_error('GAME_NOT_FOUND', 'Game not found.');
  end if;

  if g.status = 'cancelled' then
    perform public.raise_playr_error('GAME_CANCELLED', 'That game was cancelled.');
  end if;

  if g.status = 'confirmed' then
    perform public.raise_playr_error('GAME_CONFIRMED', 'This game is locked and no longer accepting players.');
  end if;

  if g.status in ('live', 'completed', 'draft') then
    perform public.raise_playr_error('GAME_CLOSED', 'That game is no longer accepting players.');
  end if;

  if g.status <> 'open' then
    perform public.raise_playr_error('GAME_CLOSED', 'That game is no longer accepting players.');
  end if;

  if g.confirmation_deadline <= timezone('utc', now()) then
    perform public.raise_playr_error('GAME_CLOSED', 'That game is no longer accepting players.');
  end if;

  -- Expire stale holds before capacity check
  perform public.expire_reservations_for_game(p_game_id);

  if exists (
    select 1
    from public.game_players gp
    where gp.game_id = p_game_id
      and gp.user_id = uid
      and gp.status in ('reserved', 'confirmed', 'waitlisted', 'attended', 'no_show')
  ) then
    perform public.raise_playr_error('ALREADY_JOINED', 'You already have a spot in this game.');
  end if;

  capacity := public.get_game_player_count(p_game_id);
  if capacity >= g.maximum_players then
    perform public.raise_playr_error('GAME_FULL', 'That game is already full.');
  end if;

  expires_at := least(
    timezone('utc', now()) + interval '8 minutes',
    g.confirmation_deadline
  );

  insert into public.game_players (
    game_id, user_id, role, status, reservation_expires_at
  ) values (
    p_game_id, uid, 'player', 'reserved', expires_at
  )
  returning * into row_out;

  -- Re-check capacity under lock (defense in depth)
  if public.get_game_player_count(p_game_id) > g.maximum_players then
    delete from public.game_players where id = row_out.id;
    perform public.raise_playr_error('GAME_FULL', 'That game is already full.');
  end if;

  perform public.log_game_event(
    p_game_id, 'player_reserved', uid,
    jsonb_build_object(
      'game_player_id', row_out.id,
      'reservation_expires_at', row_out.reservation_expires_at
    )
  );

  return row_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_waitlist
-- ---------------------------------------------------------------------------

create or replace function public.join_waitlist(p_game_id uuid)
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
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in to join this game.');
  end if;

  select * into g from public.games where id = p_game_id for update;
  if not found then
    perform public.raise_playr_error('GAME_NOT_FOUND', 'Game not found.');
  end if;

  if g.status = 'cancelled' then
    perform public.raise_playr_error('GAME_CANCELLED', 'That game was cancelled.');
  end if;

  if g.status <> 'open' then
    perform public.raise_playr_error('GAME_CLOSED', 'Waitlist is only available for open games.');
  end if;

  if g.confirmation_deadline <= timezone('utc', now()) then
    perform public.raise_playr_error('GAME_CLOSED', 'That game is no longer accepting players.');
  end if;

  perform public.expire_reservations_for_game(p_game_id);

  if exists (
    select 1 from public.game_players gp
    where gp.game_id = p_game_id
      and gp.user_id = uid
      and gp.status in ('reserved', 'confirmed', 'waitlisted', 'attended', 'no_show')
  ) then
    perform public.raise_playr_error('ALREADY_JOINED', 'You already have a spot in this game.');
  end if;

  if public.get_game_player_count(p_game_id) < g.maximum_players then
    perform public.raise_playr_error('GAME_NOT_FULL', 'Spots are still available — join the game instead.');
  end if;

  insert into public.game_players (
    game_id, user_id, role, status, reservation_expires_at
  ) values (
    p_game_id, uid, 'player', 'waitlisted', null
  )
  returning * into row_out;

  perform public.log_game_event(
    p_game_id, 'player_waitlisted', uid,
    jsonb_build_object('game_player_id', row_out.id)
  );

  return row_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_game_reservation
-- ---------------------------------------------------------------------------

create or replace function public.confirm_game_reservation(p_game_id uuid)
returns public.game_players
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gp public.game_players%rowtype;
  g public.games%rowtype;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in to join this game.');
  end if;

  select * into g from public.games where id = p_game_id for update;
  if not found then
    perform public.raise_playr_error('GAME_NOT_FOUND', 'Game not found.');
  end if;

  if g.status = 'cancelled' then
    perform public.raise_playr_error('GAME_CANCELLED', 'That game was cancelled.');
  end if;

  if g.status <> 'open' then
    perform public.raise_playr_error('GAME_CLOSED', 'That game is no longer accepting players.');
  end if;

  if g.confirmation_deadline <= timezone('utc', now()) then
    perform public.raise_playr_error('GAME_CLOSED', 'That game is no longer accepting players.');
  end if;

  select * into gp
  from public.game_players
  where game_id = p_game_id and user_id = uid
  for update;

  if not found then
    perform public.raise_playr_error('NO_RESERVATION', 'No reservation found.');
  end if;

  if gp.status = 'confirmed' then
    return gp;
  end if;

  if gp.status = 'waitlisted' then
    perform public.raise_playr_error('WAITLISTED', 'You are on the waitlist, not reserved.');
  end if;

  if gp.status <> 'reserved' then
    perform public.raise_playr_error('GAME_CLOSED', 'That game is no longer accepting players.');
  end if;

  if gp.reservation_expires_at is null
     or gp.reservation_expires_at <= timezone('utc', now()) then
    update public.game_players
    set status = 'cancelled', cancelled_at = timezone('utc', now())
    where id = gp.id;
    perform public.log_game_event(p_game_id, 'reservation_expired', uid, jsonb_build_object('game_player_id', gp.id));
    perform public.raise_playr_error('RESERVATION_EXPIRED', 'Your reservation expired.');
  end if;

  update public.game_players
  set status = 'confirmed', reservation_expires_at = null
  where id = gp.id
  returning * into gp;

  perform public.log_game_event(
    p_game_id, 'player_confirmed', uid,
    jsonb_build_object('game_player_id', gp.id)
  );

  return gp;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_game_participation (+ waitlist promotion)
-- ---------------------------------------------------------------------------

create or replace function public.cancel_game_participation(p_game_id uuid)
returns public.game_players
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gp public.game_players%rowtype;
  g public.games%rowtype;
  was_confirmed boolean := false;
  promoted public.game_players%rowtype;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select * into g from public.games where id = p_game_id for update;
  if not found then
    perform public.raise_playr_error('GAME_NOT_FOUND', 'Game not found.');
  end if;

  select * into gp
  from public.game_players
  where game_id = p_game_id
    and user_id = uid
    and status in ('reserved', 'confirmed', 'waitlisted')
  for update;

  if not found then
    perform public.raise_playr_error('NO_PARTICIPATION', 'No active participation found.');
  end if;

  was_confirmed := (gp.status = 'confirmed');

  update public.game_players
  set status = 'cancelled', cancelled_at = timezone('utc', now())
  where id = gp.id
  returning * into gp;

  perform public.log_game_event(
    p_game_id, 'player_cancelled', uid,
    jsonb_build_object('game_player_id', gp.id, 'was_confirmed', was_confirmed)
  );

  -- After confirmation: game stays confirmed; promote waitlist
  -- Before confirmation: also promote if a seat freed
  if g.status in ('open', 'confirmed') and was_confirmed then
    promoted := public.promote_next_waitlisted(p_game_id);
  elsif g.status = 'open' then
    promoted := public.promote_next_waitlisted(p_game_id);
  end if;

  return gp;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled processors (idempotent)
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_expired_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
begin
  for r in
    select id, game_id, user_id
    from public.game_players
    where status = 'reserved'
      and reservation_expires_at is not null
      and reservation_expires_at <= timezone('utc', now())
    for update skip locked
  loop
    update public.game_players
    set status = 'cancelled', cancelled_at = timezone('utc', now())
    where id = r.id
      and status = 'reserved';
    if found then
      perform public.log_game_event(
        r.game_id, 'reservation_expired', r.user_id,
        jsonb_build_object('game_player_id', r.id)
      );
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

create or replace function public.process_open_game_confirmations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  g record;
  confirmed_count integer;
  new_status public.game_status;
begin
  for g in
    select *
    from public.games
    where status = 'open'
      and confirmation_deadline <= timezone('utc', now())
    for update skip locked
  loop
    perform public.expire_reservations_for_game(g.id);
    confirmed_count := public.get_confirmed_player_count(g.id);

    if confirmed_count >= g.minimum_players then
      new_status := 'confirmed';
    else
      new_status := 'cancelled';
    end if;

    update public.games
    set status = new_status
    where id = g.id
      and status = 'open';

    if found then
      perform public.log_game_event(
        g.id,
        case when new_status = 'confirmed' then 'game_confirmed' else 'game_cancelled' end,
        null,
        jsonb_build_object(
          'confirmed_count', confirmed_count,
          'minimum_players', g.minimum_players
        )
      );
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

create or replace function public.process_game_lifecycle()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  g record;
  start_at timestamptz;
  end_at timestamptz;
begin
  -- confirmed → live
  for g in
    select *
    from public.games
    where status = 'confirmed'
    for update skip locked
  loop
    start_at := public.game_start_at(g.game_date, g.start_time);
    if start_at <= timezone('utc', now()) then
      update public.games
      set status = 'live'
      where id = g.id and status = 'confirmed';
      if found then
        perform public.log_game_event(g.id, 'game_started', null, '{}'::jsonb);
        n := n + 1;
      end if;
    end if;
  end loop;

  -- live → completed
  for g in
    select *
    from public.games
    where status = 'live'
    for update skip locked
  loop
    end_at := public.game_start_at(g.game_date, g.end_time);
    if end_at <= timezone('utc', now()) then
      update public.games
      set status = 'completed'
      where id = g.id and status = 'live';
      if found then
        perform public.log_game_event(g.id, 'game_completed', null, '{}'::jsonb);
        n := n + 1;
      end if;
    end if;
  end loop;

  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recurring game generation (14-day horizon, Asia/Kolkata)
-- ---------------------------------------------------------------------------

create or replace function public.weekday_matches_config(
  p_date date,
  p_type public.recurrence_type,
  p_config jsonb
)
returns boolean
language plpgsql
immutable
as $$
declare
  iso_dow integer;
  days integer[];
  day_name text;
  mapped integer;
begin
  iso_dow := extract(isodow from p_date)::integer; -- 1..7 Mon..Sun

  if p_type = 'daily' then
    return true;
  end if;

  if p_config ? 'weekdays' then
    days := array(
      select jsonb_array_elements_text(p_config -> 'weekdays')::integer
    );
    return iso_dow = any (days);
  end if;

  if p_config ? 'days' then
    for day_name in select lower(jsonb_array_elements_text(p_config -> 'days'))
    loop
      mapped := case day_name
        when 'mon' then 1 when 'monday' then 1
        when 'tue' then 2 when 'tuesday' then 2
        when 'wed' then 3 when 'wednesday' then 3
        when 'thu' then 4 when 'thursday' then 4
        when 'fri' then 5 when 'friday' then 5
        when 'sat' then 6 when 'saturday' then 6
        when 'sun' then 7 when 'sunday' then 7
        else null
      end;
      if mapped = iso_dow then
        return true;
      end if;
    end loop;
    return false;
  end if;

  -- weekly with no config: default every day of week (true daily-ish);
  -- prefer requiring config for custom
  if p_type = 'weekly' then
    return true;
  end if;

  return false;
end;
$$;

-- System helper to attach host without auth.uid()
create or replace function public.ensure_host_player_for_system(
  p_game_id uuid,
  p_host_id uuid
)
returns public.game_players
language plpgsql
security definer
set search_path = public
as $$
declare
  row_out public.game_players;
begin
  if p_game_id is null or p_host_id is null then
    return null;
  end if;

  select * into row_out
  from public.game_players
  where game_id = p_game_id and user_id = p_host_id
  order by created_at desc
  limit 1;

  if found then
    update public.game_players
    set role = 'host', status = 'confirmed', reservation_expires_at = null, cancelled_at = null
    where id = row_out.id
    returning * into row_out;
  else
    insert into public.game_players (game_id, user_id, role, status, reservation_expires_at)
    values (p_game_id, p_host_id, 'host', 'confirmed', null)
    returning * into row_out;
  end if;

  return row_out;
end;
$$;

create or replace function public.generate_recurring_games(p_horizon_days integer default 14)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  grp record;
  d date;
  start_local date;
  end_local date;
  end_time time;
  new_game_id uuid;
begin
  start_local := (timezone('Asia/Kolkata', now()))::date;
  end_local := start_local + p_horizon_days;

  for grp in
    select *
    from public.recurring_groups
    where is_active = true
  loop
    d := start_local;
    while d <= end_local loop
      if public.weekday_matches_config(d, grp.recurrence_type, grp.recurrence_config) then
        end_time := (grp.start_time + make_interval(mins => grp.duration_minutes))::time;

        insert into public.games (
          host_id,
          group_id,
          sport_id,
          venue_id,
          title,
          description,
          game_date,
          start_time,
          end_time,
          minimum_players,
          maximum_players,
          player_share,
          visibility,
          status,
          venue_confirmation
        )
        values (
          grp.host_id,
          grp.id,
          grp.sport_id,
          grp.venue_id,
          grp.name,
          grp.description,
          d,
          grp.start_time,
          end_time,
          grp.minimum_players,
          grp.maximum_players,
          grp.player_share,
          case grp.visibility
            when 'invite_only' then 'invite_only'::public.game_visibility
            when 'private' then 'private'::public.game_visibility
            else 'public'::public.game_visibility
          end,
          'open',
          'pending'
        )
        on conflict (group_id, game_date, start_time) where group_id is not null
        do nothing
        returning id into new_game_id;

        if new_game_id is not null then
          perform public.ensure_host_player_for_system(new_game_id, grp.host_id);
          n := n + 1;
          new_game_id := null;
        end if;
      end if;
      d := d + 1;
    end loop;
  end loop;

  return n;
end;
$$;

-- Pause / resume group (host only)
create or replace function public.set_recurring_group_active(
  p_group_id uuid,
  p_is_active boolean
)
returns public.recurring_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_out public.recurring_groups;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  update public.recurring_groups
  set is_active = p_is_active
  where id = p_group_id
    and host_id = uid
  returning * into row_out;

  if not found then
    perform public.raise_playr_error('FORBIDDEN', 'Only the group host can pause or resume.');
  end if;

  return row_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Engine tick (single scheduled entrypoint)
-- ---------------------------------------------------------------------------

create or replace function public.run_playr_engine_tick()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expired integer;
  confirmed integer;
  lifecycle integer;
  generated integer;
begin
  expired := public.cleanup_expired_reservations();
  confirmed := public.process_open_game_confirmations();
  lifecycle := public.process_game_lifecycle();
  generated := public.generate_recurring_games(14);

  return jsonb_build_object(
    'expired_reservations', expired,
    'confirmation_transitions', confirmed,
    'lifecycle_transitions', lifecycle,
    'recurring_generated', generated,
    'ran_at', timezone('utc', now())
  );
end;
$$;

grant execute on function public.join_waitlist(uuid) to authenticated;
grant execute on function public.set_recurring_group_active(uuid, boolean) to authenticated;
grant execute on function public.get_confirmed_player_count(uuid) to authenticated, anon;
grant execute on function public.run_playr_engine_tick() to service_role;
grant execute on function public.cleanup_expired_reservations() to service_role;
grant execute on function public.process_open_game_confirmations() to service_role;
grant execute on function public.process_game_lifecycle() to service_role;
grant execute on function public.generate_recurring_games(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Schedule every minute via pg_cron (Supabase Pro / local with cron enabled)
-- ---------------------------------------------------------------------------

do $$
begin
  -- Unschedule prior job if re-applied
  if exists (
    select 1 from cron.job where jobname = 'playr-engine-tick'
  ) then
    perform cron.unschedule((select jobid from cron.job where jobname = 'playr-engine-tick' limit 1));
  end if;

  perform cron.schedule(
    'playr-engine-tick',
    '* * * * *',
    $cron$ select public.run_playr_engine_tick(); $cron$
  );
exception
  when undefined_table then
    raise notice 'pg_cron unavailable — schedule run_playr_engine_tick() manually every minute.';
  when undefined_function then
    raise notice 'pg_cron unavailable — schedule run_playr_engine_tick() manually every minute.';
  when others then
    raise notice 'Could not schedule playr-engine-tick: %', sqlerrm;
end;
$$;
