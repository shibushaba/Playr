-- PLAYR Step 6: Recurring Groups + Invitations + Notifications
-- Members, RSVPs, invite tokens, in-app notifications, priority windows,
-- reminder processing, and discovery/join updates.

-- ---------------------------------------------------------------------------
-- 1. Schema alterations
-- ---------------------------------------------------------------------------

alter table public.recurring_groups
  add column if not exists regular_member_priority_hours integer not null default 6
    check (regular_member_priority_hours >= 0 and regular_member_priority_hours <= 72);

alter table public.recurring_groups
  add column if not exists ends_on date;

alter table public.games
  add column if not exists member_priority_until timestamptz;

create index if not exists games_member_priority_until_idx
  on public.games (member_priority_until)
  where member_priority_until is not null;

-- ---------------------------------------------------------------------------
-- 2. Enums (create if not exists)
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.group_member_role as enum ('host', 'co_host', 'member');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.group_member_status as enum ('active', 'left', 'invited');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.invite_status as enum ('pending', 'accepted', 'declined', 'expired', 'revoked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.game_rsvp_response as enum ('in', 'maybe', 'out');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_type as enum (
    'game_confirmed',
    'game_cancelled',
    'reservation_expiring',
    'waitlist_spot',
    'game_starting',
    'game_reminder_24h',
    'game_reminder_3h',
    'group_invite',
    'game_invite',
    'group_game_created',
    'host_message',
    'attendance_issue'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.recurring_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.recurring_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_member_role not null default 'member',
  status public.group_member_status not null default 'active',
  joined_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (group_id, user_id)
);

create index if not exists recurring_group_members_group_idx
  on public.recurring_group_members (group_id);
create index if not exists recurring_group_members_user_idx
  on public.recurring_group_members (user_id);
create index if not exists recurring_group_members_active_idx
  on public.recurring_group_members (group_id, status)
  where status = 'active';

create table if not exists public.game_rsvps (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  response public.game_rsvp_response not null,
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (game_id, user_id)
);

create index if not exists game_rsvps_game_idx on public.game_rsvps (game_id);
create index if not exists game_rsvps_user_idx on public.game_rsvps (user_id);

drop trigger if exists game_rsvps_set_updated_at on public.game_rsvps;
create trigger game_rsvps_set_updated_at
before update on public.game_rsvps
for each row execute function public.set_updated_at();

create table if not exists public.game_invites (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  invited_user_id uuid references public.profiles (id) on delete set null,
  invite_token text not null,
  short_code text,
  status public.invite_status not null default 'pending',
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  constraint game_invites_token_unique unique (invite_token)
);

create unique index if not exists game_invites_short_code_uidx
  on public.game_invites (short_code)
  where short_code is not null;

create index if not exists game_invites_game_idx on public.game_invites (game_id);
create index if not exists game_invites_invited_user_idx on public.game_invites (invited_user_id);
create index if not exists game_invites_status_idx on public.game_invites (status);

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.recurring_groups (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  invited_user_id uuid references public.profiles (id) on delete set null,
  invite_token text not null,
  short_code text,
  status public.invite_status not null default 'pending',
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  constraint group_invites_token_unique unique (invite_token)
);

create unique index if not exists group_invites_short_code_uidx
  on public.group_invites (short_code)
  where short_code is not null;

create index if not exists group_invites_group_idx on public.group_invites (group_id);
create index if not exists group_invites_invited_user_idx on public.group_invites (invited_user_id);
create index if not exists group_invites_status_idx on public.group_invites (status);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  game_id uuid references public.games (id) on delete set null,
  group_id uuid references public.recurring_groups (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists notifications_user_dedupe_uidx
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- 4. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.generate_invite_token()
returns text
language sql
volatile
as $$
  select encode(extensions.gen_random_bytes(24), 'hex');
$$;

create or replace function public.generate_short_code()
returns text
language sql
volatile
as $$
  select 'PLAYR-' || upper(substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 4));
$$;

create or replace function public.is_active_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.recurring_group_members m
    where m.group_id = p_group_id
      and m.user_id = p_user_id
      and m.status = 'active'
  );
$$;

create or replace function public.is_group_host_or_cohost(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.recurring_group_members m
    where m.group_id = p_group_id
      and m.user_id = p_user_id
      and m.status = 'active'
      and m.role in ('host', 'co_host')
  )
  or exists (
    select 1
    from public.recurring_groups g
    where g.id = p_group_id
      and g.host_id = p_user_id
  );
$$;

create or replace function public.create_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text default null,
  p_game_id uuid default null,
  p_group_id uuid default null,
  p_actor_id uuid default null,
  p_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nid uuid;
begin
  if p_user_id is null or p_title is null or length(trim(p_title)) = 0 then
    return null;
  end if;

  if p_dedupe_key is not null then
    insert into public.notifications (
      user_id, type, title, body, game_id, group_id, actor_id, dedupe_key
    ) values (
      p_user_id, p_type, p_title, p_body, p_game_id, p_group_id, p_actor_id, p_dedupe_key
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null
    do nothing
    returning id into nid;
  else
    insert into public.notifications (
      user_id, type, title, body, game_id, group_id, actor_id, dedupe_key
    ) values (
      p_user_id, p_type, p_title, p_body, p_game_id, p_group_id, p_actor_id, null
    )
    returning id into nid;
  end if;

  return nid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Ensure group host is always an active member
-- ---------------------------------------------------------------------------

create or replace function public.ensure_group_host_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.recurring_group_members (group_id, user_id, role, status, joined_at)
  values (new.id, new.host_id, 'host', 'active', timezone('utc', now()))
  on conflict (group_id, user_id) do update
  set role = 'host',
      status = 'active',
      joined_at = coalesce(public.recurring_group_members.joined_at, excluded.joined_at);
  return new;
end;
$$;

drop trigger if exists recurring_groups_ensure_host_member on public.recurring_groups;
create trigger recurring_groups_ensure_host_member
after insert on public.recurring_groups
for each row execute function public.ensure_group_host_member();

-- Backfill existing hosts
insert into public.recurring_group_members (group_id, user_id, role, status, joined_at)
select g.id, g.host_id, 'host'::public.group_member_role, 'active'::public.group_member_status, g.created_at
from public.recurring_groups g
on conflict (group_id, user_id) do update
set role = 'host',
    status = 'active';

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------

alter table public.recurring_group_members enable row level security;
alter table public.game_rsvps enable row level security;
alter table public.game_invites enable row level security;
alter table public.group_invites enable row level security;
alter table public.notifications enable row level security;

-- Groups: public OR host OR active member
drop policy if exists groups_select on public.recurring_groups;
create policy groups_select
on public.recurring_groups for select
to authenticated
using (
  visibility = 'public'
  or host_id = auth.uid()
  or public.is_active_group_member(id, auth.uid())
);

drop policy if exists groups_select_anon_public on public.recurring_groups;
create policy groups_select_anon_public
on public.recurring_groups for select
to anon
using (visibility = 'public' and is_active = true);

-- Members: visible to fellow members, or anyone for public groups; no client writes
drop policy if exists recurring_group_members_select on public.recurring_group_members;
create policy recurring_group_members_select
on public.recurring_group_members for select
to authenticated
using (
  public.is_active_group_member(group_id, auth.uid())
  or exists (
    select 1 from public.recurring_groups g
    where g.id = group_id
      and g.visibility = 'public'
  )
);

drop policy if exists recurring_group_members_select_anon on public.recurring_group_members;
create policy recurring_group_members_select_anon
on public.recurring_group_members for select
to anon
using (
  exists (
    select 1 from public.recurring_groups g
    where g.id = group_id
      and g.visibility = 'public'
      and g.is_active = true
  )
);

-- RSVPs: game host/participants/group members can read; writes via RPC only
drop policy if exists game_rsvps_select on public.game_rsvps;
create policy game_rsvps_select
on public.game_rsvps for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_game_host_or_cohost(game_id, auth.uid())
  or public.is_active_participant(game_id, auth.uid())
  or exists (
    select 1 from public.games g
    where g.id = game_id
      and g.group_id is not null
      and public.is_active_group_member(g.group_id, auth.uid())
  )
);

-- Game invites: inviter, invitee, game host/cohost
drop policy if exists game_invites_select on public.game_invites;
create policy game_invites_select
on public.game_invites for select
to authenticated
using (
  invited_by = auth.uid()
  or invited_user_id = auth.uid()
  or public.is_game_host_or_cohost(game_id, auth.uid())
);

-- Group invites: inviter, invitee, group host/cohost
drop policy if exists group_invites_select on public.group_invites;
create policy group_invites_select
on public.group_invites for select
to authenticated
using (
  invited_by = auth.uid()
  or invited_user_id = auth.uid()
  or public.is_group_host_or_cohost(group_id, auth.uid())
);

-- Notifications: own rows only; no client insert
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select on table public.recurring_group_members to authenticated, anon;
grant select on table public.game_rsvps to authenticated;
grant select on table public.game_invites to authenticated;
grant select on table public.group_invites to authenticated;
grant select, update on table public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Priority / access helpers
-- ---------------------------------------------------------------------------

create or replace function public.can_join_with_priority(p_game_id uuid, p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
begin
  if p_user_id is null or p_game_id is null then
    return false;
  end if;

  select * into g from public.games where id = p_game_id;
  if not found then
    return false;
  end if;

  -- No priority window, or window expired
  if g.member_priority_until is null
     or g.member_priority_until <= timezone('utc', now()) then
    return true;
  end if;

  -- Host always allowed during priority window
  if g.host_id = p_user_id then
    return true;
  end if;

  -- Active group members only while priority is active
  if g.group_id is not null
     and public.is_active_group_member(g.group_id, p_user_id) then
    return true;
  end if;

  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Group membership RPCs
-- ---------------------------------------------------------------------------

create or replace function public.join_public_group(p_group_id uuid)
returns public.recurring_group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  grp public.recurring_groups%rowtype;
  row_out public.recurring_group_members;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select * into grp from public.recurring_groups where id = p_group_id;
  if not found then
    perform public.raise_playr_error('GROUP_NOT_FOUND', 'Group not found.');
  end if;

  if not grp.is_active then
    perform public.raise_playr_error('GROUP_PAUSED', 'This group is paused.');
  end if;

  if grp.visibility <> 'public' then
    perform public.raise_playr_error('FORBIDDEN', 'This group is not open to public join.');
  end if;

  insert into public.recurring_group_members (group_id, user_id, role, status, joined_at)
  values (p_group_id, uid, 'member', 'active', timezone('utc', now()))
  on conflict (group_id, user_id) do update
  set status = 'active',
      role = case
        when public.recurring_group_members.role = 'host' then 'host'::public.group_member_role
        when public.recurring_group_members.role = 'co_host' then 'co_host'::public.group_member_role
        else 'member'::public.group_member_role
      end,
      joined_at = coalesce(public.recurring_group_members.joined_at, excluded.joined_at)
  returning * into row_out;

  return row_out;
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
    perform public.raise_playr_error('FORBIDDEN', 'The host cannot leave the group.');
  end if;

  update public.recurring_group_members
  set status = 'left',
      role = 'member'
  where id = row_out.id
  returning * into row_out;

  return row_out;
end;
$$;

create or replace function public.set_group_member_role(
  p_group_id uuid,
  p_user_id uuid,
  p_role public.group_member_role
)
returns public.recurring_group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  grp public.recurring_groups%rowtype;
  row_out public.recurring_group_members;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select * into grp from public.recurring_groups where id = p_group_id;
  if not found then
    perform public.raise_playr_error('GROUP_NOT_FOUND', 'Group not found.');
  end if;

  if grp.host_id <> uid then
    perform public.raise_playr_error('FORBIDDEN', 'Only the host can change member roles.');
  end if;

  if p_role = 'host' then
    perform public.raise_playr_error('FORBIDDEN', 'Use ownership transfer to change the host.');
  end if;

  if p_user_id = grp.host_id then
    perform public.raise_playr_error('FORBIDDEN', 'Cannot change the host role this way.');
  end if;

  update public.recurring_group_members
  set role = p_role,
      status = 'active'
  where group_id = p_group_id
    and user_id = p_user_id
    and status = 'active'
  returning * into row_out;

  if not found then
    perform public.raise_playr_error('NOT_A_MEMBER', 'Active member not found.');
  end if;

  return row_out;
end;
$$;

create or replace function public.remove_group_member(
  p_group_id uuid,
  p_user_id uuid
)
returns public.recurring_group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  grp public.recurring_groups%rowtype;
  row_out public.recurring_group_members;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select * into grp from public.recurring_groups where id = p_group_id;
  if not found then
    perform public.raise_playr_error('GROUP_NOT_FOUND', 'Group not found.');
  end if;

  if grp.host_id <> uid then
    perform public.raise_playr_error('FORBIDDEN', 'Only the host can remove members.');
  end if;

  if p_user_id = grp.host_id or p_user_id = uid then
    perform public.raise_playr_error('FORBIDDEN', 'Cannot remove the group host.');
  end if;

  update public.recurring_group_members
  set status = 'left',
      role = 'member'
  where group_id = p_group_id
    and user_id = p_user_id
    and status = 'active'
  returning * into row_out;

  if not found then
    perform public.raise_playr_error('NOT_A_MEMBER', 'Active member not found.');
  end if;

  return row_out;
end;
$$;

create or replace function public.update_recurring_group(
  p_group_id uuid,
  p_name text default null,
  p_description text default null,
  p_venue_id uuid default null,
  p_visibility public.group_visibility default null,
  p_recurrence_type public.recurrence_type default null,
  p_recurrence_config jsonb default null,
  p_start_time time default null,
  p_duration_minutes integer default null,
  p_minimum_players integer default null,
  p_maximum_players integer default null,
  p_player_share numeric default null,
  p_auto_open_missing_spots boolean default null,
  p_regular_member_priority_hours integer default null,
  p_ends_on date default null,
  p_clear_ends_on boolean default false,
  p_clear_venue boolean default false
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

  update public.recurring_groups g
  set
    name = coalesce(p_name, g.name),
    description = case when p_description is null then g.description else p_description end,
    venue_id = case
      when p_clear_venue then null
      when p_venue_id is null then g.venue_id
      else p_venue_id
    end,
    visibility = coalesce(p_visibility, g.visibility),
    recurrence_type = coalesce(p_recurrence_type, g.recurrence_type),
    recurrence_config = coalesce(p_recurrence_config, g.recurrence_config),
    start_time = coalesce(p_start_time, g.start_time),
    duration_minutes = coalesce(p_duration_minutes, g.duration_minutes),
    minimum_players = coalesce(p_minimum_players, g.minimum_players),
    maximum_players = coalesce(p_maximum_players, g.maximum_players),
    player_share = case when p_player_share is null then g.player_share else p_player_share end,
    auto_open_missing_spots = coalesce(p_auto_open_missing_spots, g.auto_open_missing_spots),
    regular_member_priority_hours = coalesce(p_regular_member_priority_hours, g.regular_member_priority_hours),
    ends_on = case
      when p_clear_ends_on then null
      when p_ends_on is null then g.ends_on
      else p_ends_on
    end
  where g.id = p_group_id
    and g.host_id = uid
  returning * into row_out;

  if not found then
    perform public.raise_playr_error('FORBIDDEN', 'Only the group host can update settings.');
  end if;

  if row_out.maximum_players < row_out.minimum_players then
    perform public.raise_playr_error('INVALID_CAPACITY', 'Maximum players must be >= minimum.');
  end if;

  return row_out;
end;
$$;

create or replace function public.get_group_health(p_group_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sample_size integer := 0;
  completed_n integer := 0;
  cancelled_n integer := 0;
  rate numeric;
  label text;
begin
  select
    count(*)::integer,
    count(*) filter (where status = 'completed')::integer,
    count(*) filter (where status = 'cancelled')::integer
  into sample_size, completed_n, cancelled_n
  from (
    select g.status
    from public.games g
    where g.group_id = p_group_id
      and g.status in ('completed', 'cancelled')
    order by g.game_date desc, g.start_time desc
    limit 10
  ) recent;

  if sample_size < 3 then
    return jsonb_build_object(
      'status', 'healthy',
      'label', 'Healthy',
      'sample_size', sample_size,
      'completion_rate', null,
      'reason', 'insufficient_history'
    );
  end if;

  rate := completed_n::numeric / nullif(sample_size, 0);

  if rate >= 0.90 then
    label := 'healthy';
  elsif rate >= 0.60 then
    label := 'needs_players';
  else
    label := 'frequently_cancelled';
  end if;

  return jsonb_build_object(
    'status', label,
    'label', case label
      when 'healthy' then 'Healthy'
      when 'needs_players' then 'Needs Players'
      else 'Frequently Cancelled'
    end,
    'sample_size', sample_size,
    'completed', completed_n,
    'cancelled', cancelled_n,
    'completion_rate', round(rate, 3)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Invites
-- ---------------------------------------------------------------------------

create or replace function public.create_game_invite(
  p_game_id uuid,
  p_invited_user_id uuid default null,
  p_expires_in_hours integer default 168
)
returns public.game_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.games%rowtype;
  row_out public.game_invites;
  token text;
  code text;
  tries integer := 0;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select * into g from public.games where id = p_game_id;
  if not found then
    perform public.raise_playr_error('GAME_NOT_FOUND', 'Game not found.');
  end if;

  if not (
    g.host_id = uid
    or public.is_game_host_or_cohost(p_game_id, uid)
    or (g.group_id is not null and public.is_group_host_or_cohost(g.group_id, uid))
  ) then
    perform public.raise_playr_error('FORBIDDEN', 'Only hosts can create game invites.');
  end if;

  token := public.generate_invite_token();
  loop
    tries := tries + 1;
    code := public.generate_short_code();
    exit when not exists (select 1 from public.game_invites where short_code = code)
      and not exists (select 1 from public.group_invites where short_code = code);
    if tries > 20 then
      perform public.raise_playr_error('INVITE_CODE_FAILED', 'Could not allocate invite code.');
    end if;
  end loop;

  insert into public.game_invites (
    game_id, invited_by, invited_user_id, invite_token, short_code, status, expires_at
  ) values (
    p_game_id,
    uid,
    p_invited_user_id,
    token,
    code,
    'pending',
    timezone('utc', now()) + make_interval(hours => greatest(1, coalesce(p_expires_in_hours, 168)))
  )
  returning * into row_out;

  if p_invited_user_id is not null then
    perform public.create_notification(
      p_invited_user_id,
      'game_invite',
      'You were invited to a game',
      coalesce(g.title, 'Game invite'),
      p_game_id,
      g.group_id,
      uid,
      'game_invite:' || row_out.id::text
    );
  end if;

  return row_out;
end;
$$;

create or replace function public.create_group_invite(
  p_group_id uuid,
  p_invited_user_id uuid default null,
  p_expires_in_hours integer default 168
)
returns public.group_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  grp public.recurring_groups%rowtype;
  row_out public.group_invites;
  token text;
  code text;
  tries integer := 0;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select * into grp from public.recurring_groups where id = p_group_id;
  if not found then
    perform public.raise_playr_error('GROUP_NOT_FOUND', 'Group not found.');
  end if;

  if not public.is_group_host_or_cohost(p_group_id, uid) then
    perform public.raise_playr_error('FORBIDDEN', 'Only hosts or co-hosts can invite.');
  end if;

  token := public.generate_invite_token();
  loop
    tries := tries + 1;
    code := public.generate_short_code();
    exit when not exists (select 1 from public.group_invites where short_code = code)
      and not exists (select 1 from public.game_invites where short_code = code);
    if tries > 20 then
      perform public.raise_playr_error('INVITE_CODE_FAILED', 'Could not allocate invite code.');
    end if;
  end loop;

  insert into public.group_invites (
    group_id, invited_by, invited_user_id, invite_token, short_code, status, expires_at
  ) values (
    p_group_id,
    uid,
    p_invited_user_id,
    token,
    code,
    'pending',
    timezone('utc', now()) + make_interval(hours => greatest(1, coalesce(p_expires_in_hours, 168)))
  )
  returning * into row_out;

  if p_invited_user_id is not null then
    perform public.create_notification(
      p_invited_user_id,
      'group_invite',
      'You were invited to a group',
      coalesce(grp.name, 'Group invite'),
      null,
      p_group_id,
      uid,
      'group_invite:' || row_out.id::text
    );
  end if;

  return row_out;
end;
$$;

create or replace function public.revoke_game_invite(p_invite_id uuid)
returns public.game_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_out public.game_invites;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  update public.game_invites gi
  set status = 'revoked'
  where gi.id = p_invite_id
    and gi.status = 'pending'
    and (
      gi.invited_by = uid
      or public.is_game_host_or_cohost(gi.game_id, uid)
    )
  returning * into row_out;

  if not found then
    perform public.raise_playr_error('FORBIDDEN', 'Invite not found or cannot be revoked.');
  end if;

  return row_out;
end;
$$;

create or replace function public.revoke_group_invite(p_invite_id uuid)
returns public.group_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_out public.group_invites;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  update public.group_invites gi
  set status = 'revoked'
  where gi.id = p_invite_id
    and gi.status = 'pending'
    and (
      gi.invited_by = uid
      or public.is_group_host_or_cohost(gi.group_id, uid)
    )
  returning * into row_out;

  if not found then
    perform public.raise_playr_error('FORBIDDEN', 'Invite not found or cannot be revoked.');
  end if;

  return row_out;
end;
$$;

create or replace function public.validate_game_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  inv public.game_invites%rowtype;
  g public.games%rowtype;
  sport_name text;
  venue_name text;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('valid', false, 'reason', 'MISSING_TOKEN');
  end if;

  select * into inv
  from public.game_invites
  where invite_token = trim(p_token)
     or short_code = upper(trim(p_token));

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'NOT_FOUND');
  end if;

  if inv.status = 'revoked' then
    return jsonb_build_object('valid', false, 'reason', 'REVOKED');
  end if;

  if inv.status = 'expired'
     or (inv.expires_at is not null and inv.expires_at <= timezone('utc', now())) then
    return jsonb_build_object('valid', false, 'reason', 'EXPIRED', 'invite_id', inv.id);
  end if;

  if inv.status = 'accepted' then
    return jsonb_build_object('valid', false, 'reason', 'ALREADY_ACCEPTED', 'invite_id', inv.id, 'game_id', inv.game_id);
  end if;

  if inv.status = 'declined' then
    return jsonb_build_object('valid', false, 'reason', 'DECLINED');
  end if;

  if inv.status <> 'pending' then
    return jsonb_build_object('valid', false, 'reason', 'INVALID_STATUS');
  end if;

  select * into g from public.games where id = inv.game_id;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'GAME_NOT_FOUND');
  end if;

  select s.name into sport_name from public.sports s where s.id = g.sport_id;
  select v.name into venue_name from public.venues v where v.id = g.venue_id;

  return jsonb_build_object(
    'valid', true,
    'invite_id', inv.id,
    'short_code', inv.short_code,
    'expires_at', inv.expires_at,
    'game', jsonb_build_object(
      'id', g.id,
      'title', g.title,
      'game_date', g.game_date,
      'start_time', g.start_time,
      'end_time', g.end_time,
      'status', g.status,
      'visibility', g.visibility,
      'minimum_players', g.minimum_players,
      'maximum_players', g.maximum_players,
      'sport_name', sport_name,
      'venue_name', venue_name,
      'host_id', g.host_id,
      'group_id', g.group_id
    )
  );
end;
$$;

create or replace function public.validate_group_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  inv public.group_invites%rowtype;
  grp public.recurring_groups%rowtype;
  sport_name text;
  venue_name text;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('valid', false, 'reason', 'MISSING_TOKEN');
  end if;

  select * into inv
  from public.group_invites
  where invite_token = trim(p_token)
     or short_code = upper(trim(p_token));

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'NOT_FOUND');
  end if;

  if inv.status = 'revoked' then
    return jsonb_build_object('valid', false, 'reason', 'REVOKED');
  end if;

  if inv.status = 'expired'
     or (inv.expires_at is not null and inv.expires_at <= timezone('utc', now())) then
    return jsonb_build_object('valid', false, 'reason', 'EXPIRED', 'invite_id', inv.id);
  end if;

  if inv.status = 'accepted' then
    return jsonb_build_object('valid', false, 'reason', 'ALREADY_ACCEPTED', 'invite_id', inv.id, 'group_id', inv.group_id);
  end if;

  if inv.status <> 'pending' then
    return jsonb_build_object('valid', false, 'reason', 'INVALID_STATUS');
  end if;

  select * into grp from public.recurring_groups where id = inv.group_id;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'GROUP_NOT_FOUND');
  end if;

  select s.name into sport_name from public.sports s where s.id = grp.sport_id;
  select v.name into venue_name from public.venues v where v.id = grp.venue_id;

  return jsonb_build_object(
    'valid', true,
    'invite_id', inv.id,
    'short_code', inv.short_code,
    'expires_at', inv.expires_at,
    'group', jsonb_build_object(
      'id', grp.id,
      'name', grp.name,
      'description', grp.description,
      'visibility', grp.visibility,
      'is_active', grp.is_active,
      'start_time', grp.start_time,
      'duration_minutes', grp.duration_minutes,
      'minimum_players', grp.minimum_players,
      'maximum_players', grp.maximum_players,
      'sport_name', sport_name,
      'venue_name', venue_name,
      'host_id', grp.host_id
    )
  );
end;
$$;

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
    perform public.raise_playr_error(coalesce(validation->>'reason', 'INVALID_INVITE'), 'Invite is not valid.');
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
    perform public.raise_playr_error(coalesce(validation->>'reason', 'INVALID_INVITE'), 'Invite is not valid.');
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

-- ---------------------------------------------------------------------------
-- 10. RSVP
-- ---------------------------------------------------------------------------

create or replace function public.set_game_rsvp(
  p_game_id uuid,
  p_response public.game_rsvp_response,
  p_contact_consent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.games%rowtype;
  rsvp_row public.game_rsvps;
  player_row public.game_players;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select * into g from public.games where id = p_game_id;
  if not found then
    perform public.raise_playr_error('GAME_NOT_FOUND', 'Game not found.');
  end if;

  if g.group_id is null or not public.is_active_group_member(g.group_id, uid) then
    if g.host_id <> uid then
      perform public.raise_playr_error('FORBIDDEN', 'Only group members can RSVP.');
    end if;
  end if;

  insert into public.game_rsvps (game_id, user_id, response)
  values (p_game_id, uid, p_response)
  on conflict (game_id, user_id) do update
  set response = excluded.response,
      updated_at = timezone('utc', now())
  returning * into rsvp_row;

  if p_response = 'in' then
    -- Use normal join/reservation flow (does not bypass 8-minute hold)
    begin
      player_row := public.join_game(p_game_id, coalesce(p_contact_consent, false));
    exception
      when others then
        if sqlerrm like '%ALREADY_JOINED%' then
          select * into player_row
          from public.game_players
          where game_id = p_game_id
            and user_id = uid
            and status in ('reserved', 'confirmed', 'waitlisted', 'attended', 'no_show')
          order by created_at desc
          limit 1;
        else
          raise;
        end if;
    end;
  elsif p_response = 'out' then
    begin
      perform public.cancel_game_participation(p_game_id);
    exception
      when others then
        null; -- no active participation is fine
    end;
  end if;

  return jsonb_build_object(
    'rsvp', to_jsonb(rsvp_row),
    'participation', to_jsonb(player_row)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Notifications mark-read
-- ---------------------------------------------------------------------------

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n integer := 0;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  if p_ids is null then
    update public.notifications
    set read_at = timezone('utc', now())
    where user_id = uid
      and read_at is null;
  else
    update public.notifications
    set read_at = timezone('utc', now())
    where user_id = uid
      and read_at is null
      and id = any (p_ids);
  end if;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Replace join_game with member priority check
-- ---------------------------------------------------------------------------

drop function if exists public.join_game(uuid);
drop function if exists public.join_game(uuid, boolean);

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
  has_invite boolean := false;
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

  -- Visibility gating
  if g.visibility = 'private' then
    if g.host_id <> uid
       and (g.group_id is null or not public.is_active_group_member(g.group_id, uid)) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
  elsif g.visibility = 'invite_only' then
    select exists (
      select 1 from public.game_invites gi
      where gi.game_id = p_game_id
        and gi.status in ('pending', 'accepted')
        and (gi.invited_user_id is null or gi.invited_user_id = uid)
        and (gi.expires_at is null or gi.expires_at > timezone('utc', now()))
        and (
          gi.status = 'accepted'
          or gi.invited_user_id = uid
        )
    ) into has_invite;

    if g.host_id <> uid
       and not has_invite
       and (g.group_id is null or not public.is_active_group_member(g.group_id, uid)) then
      raise exception 'INVITE_REQUIRED' using errcode = 'P0001';
    end if;
  end if;

  if not public.can_join_with_priority(p_game_id, uid) then
    raise exception 'MEMBER_PRIORITY' using errcode = 'P0001';
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

-- ---------------------------------------------------------------------------
-- 13. Replace generate_recurring_games
-- ---------------------------------------------------------------------------

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
  vis public.game_visibility;
  priority_until timestamptz;
begin
  start_local := (timezone('Asia/Kolkata', now()))::date;
  end_local := start_local + greatest(1, coalesce(p_horizon_days, 14));

  for grp in
    select *
    from public.recurring_groups
    where is_active = true
  loop
    d := start_local;
    while d <= end_local loop
      if grp.ends_on is not null and d > grp.ends_on then
        exit;
      end if;

      if public.weekday_matches_config(d, grp.recurrence_type, grp.recurrence_config) then
        end_time := (grp.start_time + make_interval(mins => grp.duration_minutes))::time;

        -- Visibility + member priority based on group settings
        if grp.visibility = 'invite_only' then
          vis := 'invite_only'::public.game_visibility;
          priority_until := null;
        elsif grp.visibility = 'private' then
          vis := 'private'::public.game_visibility;
          priority_until := null;
        elsif grp.auto_open_missing_spots then
          -- public + auto_open => public after member priority window
          vis := 'public'::public.game_visibility;
          if coalesce(grp.regular_member_priority_hours, 0) > 0 then
            priority_until := timezone('utc', now())
              + make_interval(hours => grp.regular_member_priority_hours);
          else
            priority_until := null;
          end if;
        else
          -- public without auto_open => keep private to members
          vis := 'private'::public.game_visibility;
          priority_until := null;
        end if;

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
          venue_confirmation,
          member_priority_until
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
          vis,
          'open',
          'pending',
          priority_until
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

-- ---------------------------------------------------------------------------
-- 14. Replace get_nearby_games (exclude priority window + auto_open capacity)
-- ---------------------------------------------------------------------------

create or replace function public.get_nearby_games(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision default 10000,
  p_sport_id uuid default null,
  p_game_date date default null,
  p_date_from date default null,
  p_date_to date default null,
  p_time_bucket text default null,
  p_search text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  description text,
  host_id uuid,
  group_id uuid,
  sport_id uuid,
  venue_id uuid,
  game_date date,
  start_time time,
  end_time time,
  minimum_players integer,
  maximum_players integer,
  player_share numeric,
  visibility public.game_visibility,
  status public.game_status,
  confirmation_deadline timestamptz,
  venue_name text,
  venue_city text,
  venue_address text,
  venue_status public.venue_status,
  venue_latitude double precision,
  venue_longitude double precision,
  sport_name text,
  sport_slug text,
  sport_icon text,
  host_display_name text,
  host_username text,
  host_avatar_url text,
  confirmed_count integer,
  waitlist_count integer,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography as geog
  ),
  capacity as (
    select
      gp.game_id,
      count(*) filter (
        where gp.status in ('confirmed', 'attended')
           or (
             gp.status = 'reserved'
             and gp.reservation_expires_at is not null
             and gp.reservation_expires_at > timezone('utc', now())
           )
      )::integer as confirmed_count,
      count(*) filter (where gp.status = 'waitlisted')::integer as waitlist_count
    from public.game_players gp
    group by gp.game_id
  )
  select
    g.id,
    g.title,
    g.description,
    g.host_id,
    g.group_id,
    g.sport_id,
    g.venue_id,
    g.game_date,
    g.start_time,
    g.end_time,
    g.minimum_players,
    g.maximum_players,
    g.player_share,
    g.visibility,
    g.status,
    g.confirmation_deadline,
    v.name as venue_name,
    v.city as venue_city,
    v.address as venue_address,
    v.status as venue_status,
    v.latitude as venue_latitude,
    v.longitude as venue_longitude,
    s.name as sport_name,
    s.slug as sport_slug,
    s.icon as sport_icon,
    p.display_name as host_display_name,
    p.username as host_username,
    p.avatar_url as host_avatar_url,
    coalesce(c.confirmed_count, 0) as confirmed_count,
    coalesce(c.waitlist_count, 0) as waitlist_count,
    st_distance(v.location, origin.geog) as distance_meters
  from public.games g
  join public.venues v on v.id = g.venue_id
  join public.sports s on s.id = g.sport_id
  left join public.profiles p on p.id = g.host_id
  left join capacity c on c.game_id = g.id
  left join public.recurring_groups rg on rg.id = g.group_id
  cross join origin
  where g.visibility = 'public'
    and g.status in ('open', 'confirmed')
    and v.location is not null
    and st_dwithin(v.location, origin.geog, p_radius_meters)
    and (g.member_priority_until is null or g.member_priority_until <= timezone('utc', now()))
    and (
      g.group_id is null
      or rg.auto_open_missing_spots is not true
      or coalesce(c.confirmed_count, 0) < g.maximum_players
    )
    and (p_sport_id is null or g.sport_id = p_sport_id)
    and (p_game_date is null or g.game_date = p_game_date)
    and (p_date_from is null or g.game_date >= p_date_from)
    and (p_date_to is null or g.game_date <= p_date_to)
    and (
      p_time_bucket is null
      or p_time_bucket = 'any'
      or (p_time_bucket = 'morning' and g.start_time >= time '05:00' and g.start_time < time '12:00')
      or (p_time_bucket = 'afternoon' and g.start_time >= time '12:00' and g.start_time < time '17:00')
      or (p_time_bucket = 'evening' and g.start_time >= time '17:00')
    )
    and (
      p_search is null
      or length(trim(p_search)) = 0
      or g.title ilike '%' || trim(p_search) || '%'
      or v.name ilike '%' || trim(p_search) || '%'
      or s.name ilike '%' || trim(p_search) || '%'
    )
  order by
    case when g.status = 'open' then 0 else 1 end,
    distance_meters asc,
    g.game_date asc,
    g.start_time asc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- ---------------------------------------------------------------------------
-- 15. Notifications: participants, reminders, triggers
-- ---------------------------------------------------------------------------

create or replace function public.notify_game_participants(
  p_game_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text default null,
  p_dedupe_prefix text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  g public.games%rowtype;
  dk text;
begin
  select * into g from public.games where id = p_game_id;
  if not found then
    return 0;
  end if;

  for r in
    select distinct gp.user_id
    from public.game_players gp
    where gp.game_id = p_game_id
      and gp.status in ('reserved', 'confirmed', 'waitlisted', 'attended')
  loop
    dk := case
      when p_dedupe_prefix is not null then p_dedupe_prefix || ':' || p_game_id::text || ':' || r.user_id::text
      else null
    end;

    if public.create_notification(
      r.user_id,
      p_type,
      p_title,
      p_body,
      p_game_id,
      g.group_id,
      null,
      dk
    ) is not null then
      n := n + 1;
    elsif dk is not null then
      -- conflict (already notified) counts as handled
      null;
    end if;
  end loop;

  return n;
end;
$$;

create or replace function public.process_game_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc', now());
  r record;
  kickoff timestamptz;
  n_24h integer := 0;
  n_3h integer := 0;
  n_30m integer := 0;
  n_res integer := 0;
  title text;
  body text;
begin
  -- 24h reminders (narrow window ~23.5h–24.5h)
  for r in
    select g.*
    from public.games g
    where g.status = 'confirmed'
  loop
    kickoff := public.game_start_at(r.game_date, r.start_time);
    if kickoff between now_utc + interval '23 hours 30 minutes'
                   and now_utc + interval '24 hours 30 minutes' then
      title := 'Game tomorrow';
      body := coalesce(r.title, 'Your game') || ' is tomorrow.';
      n_24h := n_24h + public.notify_game_participants(
        r.id, 'game_reminder_24h', title, body, 'game_reminder_24h'
      );
    end if;

    -- 3h reminders (narrow ~2.75h–3.25h)
    if kickoff between now_utc + interval '2 hours 45 minutes'
                   and now_utc + interval '3 hours 15 minutes' then
      title := 'Game in 3 hours';
      body := coalesce(r.title, 'Your game') || ' starts in about 3 hours.';
      n_3h := n_3h + public.notify_game_participants(
        r.id, 'game_reminder_3h', title, body, 'game_reminder_3h'
      );
    end if;

    -- 30m starting soon (narrow ~25m–35m)
    if kickoff between now_utc + interval '25 minutes'
                   and now_utc + interval '35 minutes' then
      title := 'Game starts soon';
      body := coalesce(r.title, 'Your game') || ' starts in about 30 minutes.';
      n_30m := n_30m + public.notify_game_participants(
        r.id, 'game_starting', title, body, 'game_starting'
      );
    end if;
  end loop;

  -- Reservation expiring in ~2 minutes (narrow 1.5–2.5 min)
  for r in
    select gp.id as game_player_id, gp.user_id, gp.game_id, gp.reservation_expires_at, g.title, g.group_id
    from public.game_players gp
    join public.games g on g.id = gp.game_id
    where gp.status = 'reserved'
      and gp.reservation_expires_at is not null
      and gp.reservation_expires_at between now_utc + interval '90 seconds'
                                        and now_utc + interval '150 seconds'
  loop
    if public.create_notification(
      r.user_id,
      'reservation_expiring',
      'Your spot expires in 2 minutes',
      coalesce(r.title, 'Game') || ' — confirm before your reservation expires.',
      r.game_id,
      r.group_id,
      null,
      'reservation_expiring:' || r.game_player_id::text
    ) is not null then
      n_res := n_res + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'reminder_24h', n_24h,
    'reminder_3h', n_3h,
    'reminder_30m', n_30m,
    'reservation_expiring', n_res,
    'ran_at', now_utc
  );
end;
$$;

create or replace function public.trg_games_status_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'confirmed' then
      perform public.notify_game_participants(
        new.id,
        'game_confirmed',
        'Your game is confirmed',
        coalesce(new.title, 'Game') || ' is confirmed.',
        'game_confirmed'
      );
    elsif new.status = 'cancelled' then
      perform public.notify_game_participants(
        new.id,
        'game_cancelled',
        'Game cancelled',
        coalesce(new.title, 'Your game')
          || ' was cancelled because the minimum number of players wasn''t reached.',
        'game_cancelled'
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists games_status_notify on public.games;
create trigger games_status_notify
after update of status on public.games
for each row execute function public.trg_games_status_notify();

create or replace function public.trg_waitlist_promotion_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
begin
  if tg_op = 'UPDATE'
     and old.status = 'waitlisted'
     and new.status in ('reserved', 'confirmed') then
    select * into g from public.games where id = new.game_id;
    perform public.create_notification(
      new.user_id,
      'waitlist_spot',
      'You got a spot',
      'You got a spot in ' || coalesce(g.title, 'tonight''s game') || '.',
      new.game_id,
      g.group_id,
      null,
      'waitlist_spot:' || new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists game_players_waitlist_notify on public.game_players;
create trigger game_players_waitlist_notify
after update of status on public.game_players
for each row execute function public.trg_waitlist_promotion_notify();

-- ---------------------------------------------------------------------------
-- 16. Replace run_playr_engine_tick
-- ---------------------------------------------------------------------------

create or replace function public.run_playr_engine_tick()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expired integer := 0;
  confirmed integer := 0;
  lifecycle integer := 0;
  generated integer := 0;
  reminders jsonb := '{}'::jsonb;
begin
  -- Prefer newer names; fall back to existing engine processors
  begin
    expired := public.expire_all_stale_reservations();
  exception
    when undefined_function then
      begin
        expired := public.cleanup_expired_reservations();
      exception when others then
        expired := 0;
      end;
    when others then
      begin
        expired := public.cleanup_expired_reservations();
      exception when others then
        expired := 0;
      end;
  end;

  begin
    confirmed := public.process_confirmation_deadlines();
  exception
    when undefined_function then
      begin
        confirmed := public.process_open_game_confirmations();
      exception when others then
        confirmed := 0;
      end;
    when others then
      begin
        confirmed := public.process_open_game_confirmations();
      exception when others then
        confirmed := 0;
      end;
  end;

  begin
    lifecycle := public.process_game_lifecycle();
  exception when others then
    lifecycle := 0;
  end;

  begin
    generated := public.generate_recurring_games(14);
  exception when others then
    generated := 0;
  end;

  begin
    reminders := public.process_game_reminders();
  exception when others then
    reminders := jsonb_build_object('error', sqlerrm);
  end;

  return jsonb_build_object(
    'expired_reservations', expired,
    'confirmation_transitions', confirmed,
    'lifecycle_transitions', lifecycle,
    'recurring_generated', generated,
    'reminders', reminders,
    'ran_at', timezone('utc', now())
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 17. Grants
-- ---------------------------------------------------------------------------

grant execute on function public.generate_invite_token() to authenticated, service_role;
grant execute on function public.generate_short_code() to authenticated, service_role;
grant execute on function public.is_active_group_member(uuid, uuid) to authenticated, anon, service_role;
grant execute on function public.is_group_host_or_cohost(uuid, uuid) to authenticated, anon, service_role;
grant execute on function public.create_notification(uuid, public.notification_type, text, text, uuid, uuid, uuid, text) to service_role;
grant execute on function public.can_join_with_priority(uuid, uuid) to authenticated, service_role;

grant execute on function public.join_public_group(uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.set_group_member_role(uuid, uuid, public.group_member_role) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.update_recurring_group(
  uuid, text, text, uuid, public.group_visibility, public.recurrence_type, jsonb,
  time, integer, integer, integer, numeric, boolean, integer, date, boolean, boolean
) to authenticated;
grant execute on function public.get_group_health(uuid) to authenticated, anon;

grant execute on function public.create_game_invite(uuid, uuid, integer) to authenticated;
grant execute on function public.create_group_invite(uuid, uuid, integer) to authenticated;
grant execute on function public.revoke_game_invite(uuid) to authenticated;
grant execute on function public.revoke_group_invite(uuid) to authenticated;
grant execute on function public.validate_game_invite(text) to authenticated, anon;
grant execute on function public.validate_group_invite(text) to authenticated, anon;
grant execute on function public.accept_game_invite(text) to authenticated;
grant execute on function public.accept_group_invite(text) to authenticated;

grant execute on function public.set_game_rsvp(uuid, public.game_rsvp_response, boolean) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.join_game(uuid, boolean) to authenticated;

grant execute on function public.generate_recurring_games(integer) to service_role;
grant execute on function public.get_nearby_games(
  double precision, double precision, double precision, uuid, date, date, date, text, text, integer, integer
) to authenticated, anon;
grant execute on function public.notify_game_participants(uuid, public.notification_type, text, text, text) to service_role;
grant execute on function public.process_game_reminders() to service_role;
grant execute on function public.run_playr_engine_tick() to service_role;
