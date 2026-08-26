-- PLAYR initial schema
-- Secure foundation: RLS on all app tables, phone via restricted columns + RPCs

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.venue_status as enum ('pending', 'community_added', 'verified');
create type public.group_visibility as enum ('public', 'private', 'invite_only');
create type public.recurrence_type as enum ('daily', 'weekly', 'custom');
create type public.game_visibility as enum ('public', 'private', 'invite_only');
create type public.game_status as enum ('draft', 'open', 'confirmed', 'cancelled', 'live', 'completed');
create type public.venue_confirmation as enum ('pending', 'confirmed');
create type public.game_player_role as enum ('player', 'host', 'co_host');
create type public.game_player_status as enum ('reserved', 'confirmed', 'waitlisted', 'cancelled', 'no_show', 'attended');
create type public.check_in_method as enum ('qr', 'location', 'manual');
create type public.submission_status as enum ('pending', 'approved', 'rejected');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.attendance_feedback_status as enum ('attended', 'no_show', 'late');

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  username text unique,
  phone text,
  avatar_url text,
  bio text,
  home_latitude double precision,
  home_longitude double precision,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (
    username is null or username ~ '^[a-z0-9_]{3,30}$'
  )
);

create index profiles_username_idx on public.profiles (username);
create index profiles_is_active_idx on public.profiles (is_active);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile on signup (never fail the auth insert)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username, phone)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', ''), ''),
    nullif(lower(coalesce(new.raw_user_meta_data ->> 'username', '')), ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'phone', ''), '')
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    -- Do not break auth signup if profile creation fails
    raise warning 'PLAYR profile create failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. sports
-- ---------------------------------------------------------------------------

create table public.sports (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create index sports_is_active_idx on public.sports (is_active);

-- ---------------------------------------------------------------------------
-- 3. venues
-- ---------------------------------------------------------------------------

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  address text,
  city text,
  state text,
  country text default 'India',
  latitude double precision,
  longitude double precision,
  phone text,
  website text,
  image_url text,
  facilities jsonb not null default '[]'::jsonb,
  sports jsonb not null default '[]'::jsonb,
  opening_hours jsonb not null default '{}'::jsonb,
  status public.venue_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  claimed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index venues_status_idx on public.venues (status);
create index venues_city_idx on public.venues (city);
create index venues_geo_idx on public.venues (latitude, longitude);
create index venues_created_by_idx on public.venues (created_by);

create trigger venues_set_updated_at
before update on public.venues
for each row execute function public.set_updated_at();

-- Prevent non-service role from setting verified via client updates
create or replace function public.protect_venue_verification()
returns trigger
language plpgsql
as $$
begin
  -- Allow migrations / service role; block verified status from client JWTs
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status = 'verified' then
    raise exception 'Only moderators can verify venues';
  end if;
  if tg_op = 'INSERT' and new.status = 'verified' then
    raise exception 'Only moderators can create verified venues';
  end if;
  return new;
end;
$$;

create trigger venues_protect_verification
before insert or update on public.venues
for each row execute function public.protect_venue_verification();

-- ---------------------------------------------------------------------------
-- 4. recurring_groups
-- ---------------------------------------------------------------------------

create table public.recurring_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  host_id uuid not null references public.profiles (id) on delete cascade,
  sport_id uuid not null references public.sports (id),
  venue_id uuid references public.venues (id) on delete set null,
  visibility public.group_visibility not null default 'public',
  recurrence_type public.recurrence_type not null default 'weekly',
  recurrence_config jsonb not null default '{}'::jsonb,
  start_time time not null,
  duration_minutes integer not null default 90 check (duration_minutes > 0),
  minimum_players integer not null check (minimum_players >= 2),
  maximum_players integer not null check (maximum_players >= minimum_players),
  player_share numeric(10, 2),
  auto_open_missing_spots boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index recurring_groups_host_idx on public.recurring_groups (host_id);
create index recurring_groups_sport_idx on public.recurring_groups (sport_id);
create index recurring_groups_active_idx on public.recurring_groups (is_active);

create trigger recurring_groups_set_updated_at
before update on public.recurring_groups
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. games
-- ---------------------------------------------------------------------------

create table public.games (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.recurring_groups (id) on delete set null,
  sport_id uuid not null references public.sports (id),
  venue_id uuid references public.venues (id) on delete set null,
  title text not null,
  description text,
  game_date date not null,
  start_time time not null,
  end_time time not null,
  minimum_players integer not null check (minimum_players >= 2),
  maximum_players integer not null check (maximum_players >= minimum_players),
  player_share numeric(10, 2),
  visibility public.game_visibility not null default 'public',
  status public.game_status not null default 'open',
  venue_confirmation public.venue_confirmation not null default 'pending',
  confirmation_deadline timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint games_end_after_start check (end_time > start_time)
);

create index games_status_visibility_idx on public.games (status, visibility);
create index games_host_idx on public.games (host_id);
create index games_date_idx on public.games (game_date, start_time);
create index games_deadline_idx on public.games (confirmation_deadline);
create index games_group_idx on public.games (group_id);
create index games_sport_idx on public.games (sport_id);

create trigger games_set_updated_at
before update on public.games
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. game_players
-- ---------------------------------------------------------------------------

create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.game_player_role not null default 'player',
  status public.game_player_status not null default 'reserved',
  joined_at timestamptz not null default timezone('utc', now()),
  reservation_expires_at timestamptz,
  checked_in_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index game_players_game_idx on public.game_players (game_id);
create index game_players_user_idx on public.game_players (user_id);
create index game_players_status_idx on public.game_players (status);

-- One active participation per user/game (cancelled/reserved/waitlisted/attended/no_show)
create unique index game_players_one_active_per_user
on public.game_players (game_id, user_id)
where status in ('reserved', 'confirmed', 'waitlisted', 'attended', 'no_show');

create trigger game_players_set_updated_at
before update on public.game_players
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. check_ins
-- ---------------------------------------------------------------------------

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  checked_in_at timestamptz not null default timezone('utc', now()),
  method public.check_in_method not null default 'manual',
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default timezone('utc', now()),
  unique (game_id, user_id)
);

create index check_ins_game_idx on public.check_ins (game_id);

-- ---------------------------------------------------------------------------
-- 8. game_messages
-- ---------------------------------------------------------------------------

create table public.game_messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(trim(message)) > 0 and char_length(message) <= 2000),
  created_at timestamptz not null default timezone('utc', now())
);

create index game_messages_game_created_idx on public.game_messages (game_id, created_at);

-- ---------------------------------------------------------------------------
-- 9. venue_submissions
-- ---------------------------------------------------------------------------

create table public.venue_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete set null,
  name text not null,
  address text,
  phone text,
  latitude double precision,
  longitude double precision,
  notes text,
  status public.submission_status not null default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index venue_submissions_submitter_idx on public.venue_submissions (submitted_by);
create index venue_submissions_status_idx on public.venue_submissions (status);

-- ---------------------------------------------------------------------------
-- 10. reports
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete set null,
  game_id uuid references public.games (id) on delete set null,
  venue_id uuid references public.venues (id) on delete set null,
  reason text not null,
  description text,
  status public.report_status not null default 'open',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reports_has_target check (
    reported_user_id is not null or game_id is not null or venue_id is not null
  )
);

create index reports_reporter_idx on public.reports (reporter_id);
create index reports_status_idx on public.reports (status);

create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 11. game_attendance_feedback
-- ---------------------------------------------------------------------------

create table public.game_attendance_feedback (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  subject_user_id uuid not null references public.profiles (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  attendance_status public.attendance_feedback_status not null,
  payment_acknowledged boolean,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (game_id, subject_user_id, submitted_by)
);

create index game_attendance_feedback_game_idx on public.game_attendance_feedback (game_id);

-- ---------------------------------------------------------------------------
-- Core helper functions (security definer where needed for RLS)
-- ---------------------------------------------------------------------------

create or replace function public.calculate_game_confirmation_deadline(game_start timestamptz)
returns timestamptz
language sql
immutable
as $$
  select game_start - interval '3 hours';
$$;

create or replace function public.game_start_at(p_date date, p_time time, p_tz text default 'Asia/Kolkata')
returns timestamptz
language sql
immutable
as $$
  select (p_date + p_time) at time zone p_tz;
$$;

create or replace function public.games_set_confirmation_deadline()
returns trigger
language plpgsql
as $$
declare
  start_at timestamptz;
begin
  start_at := public.game_start_at(new.game_date, new.start_time);
  new.confirmation_deadline := public.calculate_game_confirmation_deadline(start_at);
  if new.end_time is null then
    new.end_time := new.start_time + interval '90 minutes';
  end if;
  return new;
end;
$$;

create trigger games_set_confirmation_deadline
before insert or update of game_date, start_time
on public.games
for each row execute function public.games_set_confirmation_deadline();

create or replace function public.is_active_participant(p_game_id uuid, p_user_id uuid)
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
      and gp.status in ('reserved', 'confirmed', 'waitlisted', 'attended')
      and (
        gp.status <> 'reserved'
        or gp.reservation_expires_at is null
        or gp.reservation_expires_at > timezone('utc', now())
      )
  );
$$;

create or replace function public.is_game_host_or_cohost(p_game_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.games g where g.id = p_game_id and g.host_id = p_user_id
  )
  or exists (
    select 1
    from public.game_players gp
    where gp.game_id = p_game_id
      and gp.user_id = p_user_id
      and gp.role in ('host', 'co_host')
      and gp.status in ('reserved', 'confirmed', 'attended')
  );
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
    and gp.status in ('confirmed', 'reserved', 'attended')
    and (
      gp.status <> 'reserved'
      or (gp.reservation_expires_at is not null and gp.reservation_expires_at > timezone('utc', now()))
    );
$$;

create or replace function public.is_game_full(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.get_game_player_count(p_game_id) >= g.maximum_players from public.games g where g.id = p_game_id),
    true
  );
$$;

create or replace function public.can_user_join_game(p_game_id uuid, p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
begin
  if p_user_id is null then
    return false;
  end if;

  select * into g from public.games where id = p_game_id;
  if not found then
    return false;
  end if;

  if g.status <> 'open' then
    return false;
  end if;

  if g.confirmation_deadline <= timezone('utc', now()) then
    return false;
  end if;

  if public.is_game_full(p_game_id) then
    return false;
  end if;

  if exists (
    select 1
    from public.game_players gp
    where gp.game_id = p_game_id
      and gp.user_id = p_user_id
      and gp.status in ('reserved', 'confirmed', 'waitlisted', 'attended', 'no_show')
  ) then
    return false;
  end if;

  return true;
end;
$$;

-- Phone contact RPC (authorized only)
create or replace function public.get_game_contact_phone(p_game_id uuid, p_target_user_id uuid)
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

  -- Host/co-host can see participant phones
  if public.is_game_host_or_cohost(p_game_id, viewer)
     and public.is_active_participant(p_game_id, p_target_user_id) then
    select phone into phone_out from public.profiles where id = p_target_user_id;
    return phone_out;
  end if;

  -- Participant can see host phone
  if public.is_active_participant(p_game_id, viewer)
     and (p_target_user_id = g.host_id) then
    select phone into phone_out from public.profiles where id = p_target_user_id;
    return phone_out;
  end if;

  -- Own phone
  if viewer = p_target_user_id then
    select phone into phone_out from public.profiles where id = p_target_user_id;
    return phone_out;
  end if;

  return null;
end;
$$;

-- Join / reserve
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
  join_status public.game_player_status;
begin
  if uid is null then
    raise exception 'Please sign in to join this game.' using errcode = '42501';
  end if;

  select * into g from public.games where id = p_game_id for update;
  if not found then
    raise exception 'Game not found.' using errcode = 'P0002';
  end if;

  if g.status <> 'open' then
    raise exception 'That game is no longer accepting players.' using errcode = 'P0001';
  end if;

  if g.confirmation_deadline <= timezone('utc', now()) then
    raise exception 'That game is no longer accepting players.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.game_players gp
    where gp.game_id = p_game_id
      and gp.user_id = uid
      and gp.status in ('reserved', 'confirmed', 'waitlisted', 'attended', 'no_show')
  ) then
    raise exception 'You already have a spot in this game.' using errcode = 'P0001';
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

  insert into public.game_players (
    game_id, user_id, role, status, reservation_expires_at
  ) values (
    p_game_id, uid, 'player', join_status, expires_at
  )
  returning * into row_out;

  return row_out;
end;
$$;

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
    raise exception 'Please sign in to join this game.' using errcode = '42501';
  end if;

  select * into g from public.games where id = p_game_id;
  if not found then
    raise exception 'Game not found.';
  end if;

  select * into gp
  from public.game_players
  where game_id = p_game_id and user_id = uid
  for update;

  if not found then
    raise exception 'No reservation found.';
  end if;

  if gp.status = 'confirmed' then
    return gp;
  end if;

  if gp.status = 'waitlisted' then
    return gp;
  end if;

  if gp.status <> 'reserved' then
    raise exception 'That game is no longer accepting players.';
  end if;

  if gp.reservation_expires_at is null
     or gp.reservation_expires_at <= timezone('utc', now()) then
    update public.game_players
    set status = 'cancelled', cancelled_at = timezone('utc', now())
    where id = gp.id;
    raise exception 'Your reservation expired.';
  end if;

  if g.confirmation_deadline <= timezone('utc', now()) then
    raise exception 'That game is no longer accepting players.';
  end if;

  update public.game_players
  set status = 'confirmed', reservation_expires_at = null
  where id = gp.id
  returning * into gp;

  return gp;
end;
$$;

create or replace function public.cancel_game_participation(p_game_id uuid)
returns public.game_players
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gp public.game_players%rowtype;
begin
  if uid is null then
    raise exception 'Please sign in.';
  end if;

  update public.game_players
  set status = 'cancelled', cancelled_at = timezone('utc', now())
  where game_id = p_game_id
    and user_id = uid
    and status in ('reserved', 'confirmed', 'waitlisted')
  returning * into gp;

  if not found then
    raise exception 'No active participation found.';
  end if;

  return gp;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.sports enable row level security;
alter table public.venues enable row level security;
alter table public.recurring_groups enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.check_ins enable row level security;
alter table public.game_messages enable row level security;
alter table public.venue_submissions enable row level security;
alter table public.reports enable row level security;
alter table public.game_attendance_feedback enable row level security;

-- profiles: public-ish fields via SELECT; phone restricted by column privileges
create policy profiles_select_authenticated
on public.profiles for select
to authenticated
using (is_active = true or id = auth.uid());

create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check (id = auth.uid());

-- Column-level protection for phone
revoke all on table public.profiles from anon, authenticated, public;
grant select (
  id, display_name, username, avatar_url, bio,
  home_latitude, home_longitude, is_active, created_at, updated_at
) on table public.profiles to authenticated;
grant update (
  display_name, username, phone, avatar_url, bio,
  home_latitude, home_longitude, updated_at
) on table public.profiles to authenticated;
grant insert (
  id, display_name, username, phone, avatar_url, bio,
  home_latitude, home_longitude, is_active
) on table public.profiles to authenticated;

-- Full own profile including phone (column grants hide phone on direct table SELECT)
create or replace function public.get_my_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

grant execute on function public.get_my_profile() to authenticated;

-- sports
create policy sports_select_all_auth
on public.sports for select
to authenticated
using (is_active = true);

grant select on table public.sports to authenticated;
grant select on table public.sports to anon;

create policy sports_select_anon
on public.sports for select
to anon
using (is_active = true);

-- venues
create policy venues_select_readable
on public.venues for select
to authenticated
using (
  status in ('community_added', 'verified')
  or created_by = auth.uid()
);

create policy venues_insert_auth
on public.venues for insert
to authenticated
with check (
  created_by = auth.uid()
  and status in ('pending', 'community_added')
);

create policy venues_update_own_unverified
on public.venues for update
to authenticated
using (
  created_by = auth.uid()
  and status in ('pending', 'community_added')
)
with check (
  created_by = auth.uid()
  and status in ('pending', 'community_added')
);

grant select, insert, update on table public.venues to authenticated;

-- recurring_groups
create policy groups_select
on public.recurring_groups for select
to authenticated
using (
  visibility = 'public'
  or host_id = auth.uid()
);

create policy groups_insert_host
on public.recurring_groups for insert
to authenticated
with check (host_id = auth.uid());

create policy groups_update_host
on public.recurring_groups for update
to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid());

grant select, insert, update on table public.recurring_groups to authenticated;

-- games
create policy games_select
on public.games for select
to authenticated
using (
  (
    visibility = 'public'
    and status in ('open', 'confirmed', 'live', 'completed', 'cancelled')
  )
  or host_id = auth.uid()
  or public.is_active_participant(id, auth.uid())
);

create policy games_insert_host
on public.games for insert
to authenticated
with check (host_id = auth.uid() and status in ('draft', 'open'));

create policy games_update_host
on public.games for update
to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid());

-- Block clients from freely flipping confirmation status via a trigger
create or replace function public.protect_game_status_changes()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status in ('confirmed', 'cancelled', 'live', 'completed') then
    if new.status = 'cancelled' and old.status in ('draft', 'open') and new.host_id = auth.uid() then
      return new;
    end if;
    if new.status = 'open' and old.status = 'draft' and new.host_id = auth.uid() then
      return new;
    end if;
    raise exception 'Game status changes are controlled by PLAYR rules';
  end if;
  return new;
end;
$$;

create trigger games_protect_status
before update on public.games
for each row execute function public.protect_game_status_changes();

grant select, insert, update on table public.games to authenticated;

-- game_players
create policy game_players_select
on public.game_players for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_game_host_or_cohost(game_id, auth.uid())
  or public.is_active_participant(game_id, auth.uid())
);

-- Direct inserts blocked; use join_game RPC (security definer)
create policy game_players_no_direct_insert
on public.game_players for insert
to authenticated
with check (false);

create policy game_players_update_own_cancel
on public.game_players for update
to authenticated
using (user_id = auth.uid() or public.is_game_host_or_cohost(game_id, auth.uid()))
with check (user_id = auth.uid() or public.is_game_host_or_cohost(game_id, auth.uid()));

grant select, update on table public.game_players to authenticated;

-- check_ins
create policy check_ins_select
on public.check_ins for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_game_host_or_cohost(game_id, auth.uid())
);

create policy check_ins_insert_own
on public.check_ins for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_active_participant(game_id, auth.uid())
);

grant select, insert on table public.check_ins to authenticated;

-- game_messages
create policy game_messages_select
on public.game_messages for select
to authenticated
using (
  public.is_active_participant(game_id, auth.uid())
  or public.is_game_host_or_cohost(game_id, auth.uid())
);

create policy game_messages_insert
on public.game_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (
    public.is_active_participant(game_id, auth.uid())
    or public.is_game_host_or_cohost(game_id, auth.uid())
  )
);

grant select, insert on table public.game_messages to authenticated;

-- venue_submissions
create policy venue_submissions_insert
on public.venue_submissions for insert
to authenticated
with check (submitted_by = auth.uid());

create policy venue_submissions_select_own
on public.venue_submissions for select
to authenticated
using (submitted_by = auth.uid());

grant select, insert on table public.venue_submissions to authenticated;

-- reports
create policy reports_insert
on public.reports for insert
to authenticated
with check (reporter_id = auth.uid());

create policy reports_select_own
on public.reports for select
to authenticated
using (reporter_id = auth.uid());

grant select, insert on table public.reports to authenticated;

-- attendance feedback
create policy feedback_select
on public.game_attendance_feedback for select
to authenticated
using (
  submitted_by = auth.uid()
  or subject_user_id = auth.uid()
  or public.is_game_host_or_cohost(game_id, auth.uid())
);

create policy feedback_insert
on public.game_attendance_feedback for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and submitted_by <> subject_user_id
  and (
    public.is_active_participant(game_id, auth.uid())
    or public.is_game_host_or_cohost(game_id, auth.uid())
  )
  and exists (
    select 1 from public.games g
    where g.id = game_id and g.status in ('completed', 'live')
  )
);

-- Users cannot mark themselves attended via this table as subject+submitter
-- (enforced by submitted_by <> subject_user_id)

grant select, insert on table public.game_attendance_feedback to authenticated;

-- RPC grants
grant execute on function public.calculate_game_confirmation_deadline(timestamptz) to authenticated, anon;
grant execute on function public.get_game_player_count(uuid) to authenticated, anon;
grant execute on function public.is_game_full(uuid) to authenticated, anon;
grant execute on function public.can_user_join_game(uuid, uuid) to authenticated;
grant execute on function public.join_game(uuid) to authenticated;
grant execute on function public.confirm_game_reservation(uuid) to authenticated;
grant execute on function public.cancel_game_participation(uuid) to authenticated;
grant execute on function public.get_game_contact_phone(uuid, uuid) to authenticated;
grant execute on function public.is_active_participant(uuid, uuid) to authenticated;
grant execute on function public.is_game_host_or_cohost(uuid, uuid) to authenticated;
grant execute on function public.game_start_at(date, time, text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Seed: sports
-- ---------------------------------------------------------------------------

insert into public.sports (id, name, slug, icon) values
  ('11111111-1111-1111-1111-111111111101', 'Football', 'football', '⚽'),
  ('11111111-1111-1111-1111-111111111102', 'Cricket', 'cricket', '🏏'),
  ('11111111-1111-1111-1111-111111111103', 'Badminton', 'badminton', '🏸'),
  ('11111111-1111-1111-1111-111111111104', 'Basketball', 'basketball', '🏀'),
  ('11111111-1111-1111-1111-111111111105', 'Volleyball', 'volleyball', '🏐'),
  ('11111111-1111-1111-1111-111111111106', 'Tennis', 'tennis', '🎾'),
  ('11111111-1111-1111-1111-111111111107', 'Table Tennis', 'table-tennis', '🏓');

-- ---------------------------------------------------------------------------
-- Seed: Kozhikode venues (fictional / test)
-- ---------------------------------------------------------------------------

insert into public.venues (
  id, name, description, address, city, state, country,
  latitude, longitude, facilities, sports, status
) values
(
  '22222222-2222-2222-2222-222222222201',
  'PLAYR Test Turf — Kallai',
  'Fictional outdoor turf for PLAYR development. Not a real booking venue.',
  'Near Kallai Bridge (test address)',
  'Kozhikode',
  'Kerala',
  'India',
  11.2356, 75.7912,
  '["floodlights","parking","water"]'::jsonb,
  '["football"]'::jsonb,
  'verified'
),
(
  '22222222-2222-2222-2222-222222222202',
  'PLAYR Test Badminton Hall — Indira Gandhi Rd',
  'Indoor courts seed data for local testing around Kozhikode.',
  'Indira Gandhi Road (test address)',
  'Kozhikode',
  'Kerala',
  'India',
  11.2588, 75.7804,
  '["ac","parking","lockers"]'::jsonb,
  '["badminton","table-tennis"]'::jsonb,
  'community_added'
),
(
  '22222222-2222-2222-2222-222222222203',
  'PLAYR Test Cricket Nets — Medical College',
  'Practice nets seed venue. Fictional listing for MVP testing.',
  'Medical College Area (test address)',
  'Kozhikode',
  'Kerala',
  'India',
  11.2714, 75.8370,
  '["nets","lighting"]'::jsonb,
  '["cricket"]'::jsonb,
  'community_added'
),
(
  '22222222-2222-2222-2222-222222222204',
  'PLAYR Test Basketball Court — Beach Road',
  'Open court seed data near Kozhikode beach road.',
  'Beach Road stretch (test address)',
  'Kozhikode',
  'Kerala',
  'India',
  11.2599, 75.7745,
  '["outdoor","lighting"]'::jsonb,
  '["basketball","volleyball"]'::jsonb,
  'pending'
),
(
  '22222222-2222-2222-2222-222222222205',
  'PLAYR Test Multipurpose Ground — Mankavu',
  'Community ground seed venue for football and volleyball.',
  'Mankavu Junction (test address)',
  'Kozhikode',
  'Kerala',
  'India',
  11.2201, 75.8015,
  '["parking"]'::jsonb,
  '["football","volleyball"]'::jsonb,
  'community_added'
);

-- Demo auth users + games are seeded in 20260327000001_seed_demo_data.sql
-- (requires auth.users inserts for host profiles)
