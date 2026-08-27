-- Community contributions, admin moderation, post-game feedback, audit logging

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

do $$ begin
  alter type public.venue_status add value if not exists 'rejected';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.venue_status add value if not exists 'archived';
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.edit_request_status as enum (
    'pending', 'approved', 'rejected', 'cancelled', 'needs_info'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.moderation_action_type as enum (
    'venue_verified',
    'venue_rejected',
    'venue_archived',
    'venue_edit_approved',
    'venue_edit_rejected',
    'venue_edit_needs_info',
    'report_resolved',
    'report_dismissed',
    'report_escalated',
    'user_suspended',
    'user_unsuspended',
    'feedback_hidden'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.notification_type add value if not exists 'venue_submitted';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.notification_type add value if not exists 'venue_verified';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.notification_type add value if not exists 'venue_rejected';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.notification_type add value if not exists 'venue_edit_approved';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.notification_type add value if not exists 'venue_edit_rejected';
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Schema extensions
-- ---------------------------------------------------------------------------

alter table public.venues
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles (id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references public.profiles (id) on delete set null,
  add column if not exists admin_notes text;

alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles (id) on delete set null;

create table if not exists public.playr_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.venue_edit_requests (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  proposed_changes jsonb not null default '{}'::jsonb,
  reason text,
  status public.edit_request_status not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  admin_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint venue_edit_requests_changes_nonempty check (
    jsonb_typeof(proposed_changes) = 'object'
    and proposed_changes <> '{}'::jsonb
  )
);

create index if not exists venue_edit_requests_status_created_idx
  on public.venue_edit_requests (status, created_at desc);

create index if not exists venue_edit_requests_venue_idx
  on public.venue_edit_requests (venue_id);

create table if not exists public.game_experience_feedback (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete set null,
  overall_rating smallint not null check (overall_rating between 1 and 5),
  comment text,
  tags jsonb not null default '[]'::jsonb,
  is_hidden boolean not null default false,
  hidden_at timestamptz,
  hidden_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (game_id, user_id)
);

create index if not exists game_experience_feedback_game_idx
  on public.game_experience_feedback (game_id);

create index if not exists game_experience_feedback_venue_idx
  on public.game_experience_feedback (venue_id)
  where venue_id is not null and not is_hidden;

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete cascade,
  action public.moderation_action_type not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists moderation_actions_created_idx
  on public.moderation_actions (created_at desc);

create index if not exists moderation_actions_admin_idx
  on public.moderation_actions (admin_id, created_at desc);

create index if not exists venues_status_created_idx
  on public.venues (status, created_at desc);

drop trigger if exists venue_edit_requests_set_updated_at on public.venue_edit_requests;
create trigger venue_edit_requests_set_updated_at
before update on public.venue_edit_requests
for each row execute function public.set_updated_at();

drop trigger if exists game_experience_feedback_set_updated_at on public.game_experience_feedback;
create trigger game_experience_feedback_set_updated_at
before update on public.game_experience_feedback
for each row execute function public.set_updated_at();

-- Seed admin allowlist (users must exist in auth.users — create via Supabase Auth, not in code)
insert into public.playr_admins (user_id, email)
select u.id, u.email
from auth.users u
where lower(u.email) in (
  lower('admin@gmail.com'),
  lower('shibushabas23@gmail.com')
)
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------

alter table public.playr_admins enable row level security;
alter table public.venue_edit_requests enable row level security;
alter table public.game_experience_feedback enable row level security;
alter table public.moderation_actions enable row level security;

revoke all on table public.playr_admins from anon, authenticated;
revoke all on table public.moderation_actions from anon, authenticated;

-- Users can read their own edit requests
create policy venue_edit_requests_select_own
on public.venue_edit_requests for select
to authenticated
using (submitted_by = auth.uid());

create policy venue_edit_requests_insert_own
on public.venue_edit_requests for insert
to authenticated
with check (submitted_by = auth.uid());

-- Users can read their own game feedback only
create policy game_experience_feedback_select_own
on public.game_experience_feedback for select
to authenticated
using (user_id = auth.uid());

revoke insert, update, delete on table public.venue_edit_requests from authenticated;
revoke insert, update, delete on table public.game_experience_feedback from authenticated;

grant select on table public.venue_edit_requests to authenticated;
grant select on table public.game_experience_feedback to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_playr_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.playr_admins a
    where a.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

create or replace function public.assert_playr_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_playr_admin() then
    perform public.raise_playr_error('FORBIDDEN', 'Admin access required.');
  end if;
end;
$$;

create or replace function public.profile_is_suspended(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = coalesce(p_user_id, auth.uid())
      and p.suspended_at is not null
  );
$$;

create or replace function public.log_moderation_action(
  p_action public.moderation_action_type,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mid uuid;
begin
  if uid is null then
    return null;
  end if;
  insert into public.moderation_actions (admin_id, action, entity_type, entity_id, metadata)
  values (uid, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into mid;
  return mid;
end;
$$;

create or replace function public.user_participated_in_game(
  p_game_id uuid,
  p_user_id uuid default auth.uid()
)
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
      and gp.status = 'attended'
  )
  or exists (
    select 1
    from public.check_ins c
    where c.game_id = p_game_id
      and c.user_id = p_user_id
  );
$$;

-- Strengthen venue verification protection
create or replace function public.protect_venue_verification()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_playr_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status
       and new.status in ('verified', 'rejected', 'archived') then
      raise exception 'Only moderators can change venue verification status';
    end if;
    if new.verified_at is distinct from old.verified_at
       or new.verified_by is distinct from old.verified_by
       or new.rejected_at is distinct from old.rejected_at
       or new.rejected_by is distinct from old.rejected_by then
      raise exception 'Only moderators can change venue verification metadata';
    end if;
  end if;

  if tg_op = 'INSERT' and new.status = 'verified' then
    raise exception 'Only moderators can create verified venues';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Public / user RPCs
-- ---------------------------------------------------------------------------

create or replace function public.check_is_playr_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_playr_admin();
$$;

grant execute on function public.check_is_playr_admin() to authenticated;

create or replace function public.submit_venue_edit_request(
  p_venue_id uuid,
  p_proposed_changes jsonb,
  p_reason text default null
)
returns public.venue_edit_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v public.venues;
  row_out public.venue_edit_requests;
  allowed_keys text[] := array[
    'name', 'address', 'phone', 'sports', 'latitude', 'longitude',
    'map_url', 'description', 'opening_hours', 'city', 'state'
  ];
  k text;
  normalized_phone text;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  if public.profile_is_suspended(uid) then
    perform public.raise_playr_error('ACCOUNT_SUSPENDED', 'Your account is suspended.');
  end if;

  select * into v from public.venues where id = p_venue_id;
  if v.id is null then
    perform public.raise_playr_error('NOT_FOUND', 'Venue not found.');
  end if;

  if v.status not in ('community_added', 'verified') then
    perform public.raise_playr_error('INVALID_VENUE', 'This venue cannot be edited.');
  end if;

  if p_proposed_changes is null
     or jsonb_typeof(p_proposed_changes) <> 'object'
     or p_proposed_changes = '{}'::jsonb then
    perform public.raise_playr_error('INVALID_INPUT', 'Propose at least one change.');
  end if;

  for k in select jsonb_object_keys(p_proposed_changes)
  loop
    if not (k = any (allowed_keys)) then
      perform public.raise_playr_error('INVALID_INPUT', format('Field %s cannot be edited.', k));
    end if;
  end loop;

  if p_proposed_changes ? 'phone' then
    normalized_phone := public.normalize_phone_e164(p_proposed_changes ->> 'phone');
    if not public.is_valid_e164(normalized_phone) then
      perform public.raise_playr_error('INVALID_PHONE', 'Enter a valid venue phone number.');
    end if;
    p_proposed_changes := jsonb_set(p_proposed_changes, '{phone}', to_jsonb(normalized_phone), true);
  end if;

  if exists (
    select 1
    from public.venue_edit_requests r
    where r.venue_id = p_venue_id
      and r.submitted_by = uid
      and r.status = 'pending'
  ) then
    perform public.raise_playr_error('PENDING_EDIT_EXISTS', 'You already have a pending edit for this venue.');
  end if;

  insert into public.venue_edit_requests (venue_id, submitted_by, proposed_changes, reason)
  values (p_venue_id, uid, p_proposed_changes, nullif(trim(coalesce(p_reason, '')), ''))
  returning * into row_out;

  return row_out;
end;
$$;

grant execute on function public.submit_venue_edit_request(uuid, jsonb, text) to authenticated;

create or replace function public.get_game_feedback_state(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.games;
  existing public.game_experience_feedback;
begin
  if uid is null then
    return jsonb_build_object('eligible', false, 'reason', 'unauthenticated');
  end if;

  select * into g from public.games where id = p_game_id;
  if g.id is null then
    return jsonb_build_object('eligible', false, 'reason', 'not_found');
  end if;

  if g.status <> 'completed' then
    return jsonb_build_object('eligible', false, 'reason', 'game_not_completed');
  end if;

  if not public.user_participated_in_game(p_game_id, uid) then
    return jsonb_build_object('eligible', false, 'reason', 'not_participant');
  end if;

  select * into existing
  from public.game_experience_feedback f
  where f.game_id = p_game_id and f.user_id = uid;

  if existing.id is not null then
    return jsonb_build_object(
      'eligible', true,
      'submitted', true,
      'rating', existing.overall_rating,
      'comment', existing.comment,
      'tags', existing.tags
    );
  end if;

  return jsonb_build_object('eligible', true, 'submitted', false);
end;
$$;

grant execute on function public.get_game_feedback_state(uuid) to authenticated;

create or replace function public.submit_game_experience_feedback(
  p_game_id uuid,
  p_overall_rating smallint,
  p_comment text default null,
  p_tags jsonb default '[]'::jsonb
)
returns public.game_experience_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.games;
  row_out public.game_experience_feedback;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  if public.profile_is_suspended(uid) then
    perform public.raise_playr_error('ACCOUNT_SUSPENDED', 'Your account is suspended.');
  end if;

  select * into g from public.games where id = p_game_id;
  if g.id is null then
    perform public.raise_playr_error('NOT_FOUND', 'Game not found.');
  end if;

  if g.status <> 'completed' then
    perform public.raise_playr_error('GAME_NOT_COMPLETED', 'Feedback is available after the game completes.');
  end if;

  if not public.user_participated_in_game(p_game_id, uid) then
    perform public.raise_playr_error('NOT_ELIGIBLE', 'Only players who participated can leave feedback.');
  end if;

  if p_overall_rating is null or p_overall_rating < 1 or p_overall_rating > 5 then
    perform public.raise_playr_error('INVALID_RATING', 'Choose a rating from 1 to 5 stars.');
  end if;

  insert into public.game_experience_feedback (
    game_id, user_id, venue_id, overall_rating, comment, tags
  ) values (
    p_game_id,
    uid,
    g.venue_id,
    p_overall_rating,
    nullif(trim(coalesce(p_comment, '')), ''),
    coalesce(p_tags, '[]'::jsonb)
  )
  on conflict (game_id, user_id) do nothing
  returning * into row_out;

  if row_out.id is null then
    perform public.raise_playr_error('ALREADY_SUBMITTED', 'You already submitted feedback for this game.');
  end if;

  return row_out;
end;
$$;

grant execute on function public.submit_game_experience_feedback(uuid, smallint, text, jsonb) to authenticated;

create or replace function public.get_venue_rating_summary(p_venue_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'review_count', count(*)::integer,
    'average_rating', case when count(*) >= 3 then round(avg(f.overall_rating)::numeric, 1) else null end,
    'display',
      case
        when count(*) = 0 then 'none'
        when count(*) < 3 then 'insufficient'
        else 'rated'
      end
  )
  from public.game_experience_feedback f
  where f.venue_id = p_venue_id
    and not f.is_hidden;
$$;

grant execute on function public.get_venue_rating_summary(uuid) to anon, authenticated;

-- Notify on venue creation
create or replace function public.create_venue(
  p_name text,
  p_latitude double precision,
  p_longitude double precision,
  p_map_url text,
  p_phone text,
  p_address text default null,
  p_city text default null,
  p_state text default null,
  p_country text default 'India',
  p_sports jsonb default '[]'::jsonb,
  p_description text default null,
  p_force_create boolean default false
)
returns public.venues
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  url text;
  row_out public.venues;
  similar_count integer;
  normalized_phone text;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  if public.profile_is_suspended(uid) then
    perform public.raise_playr_error('ACCOUNT_SUSPENDED', 'Your account is suspended.');
  end if;

  if not public.profile_has_verified_phone(uid) then
    perform public.raise_playr_error(
      'PHONE_VERIFICATION_REQUIRED',
      'Verify your phone before adding a venue.'
    );
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    perform public.raise_playr_error('INVALID_VENUE', 'Enter a venue name.');
  end if;

  normalized_phone := public.normalize_phone_e164(p_phone);
  if not public.is_valid_e164(normalized_phone) then
    perform public.raise_playr_error('INVALID_PHONE', 'Enter a valid venue phone number.');
  end if;

  if p_latitude is null or p_longitude is null then
    perform public.raise_playr_error('MAP_LOCATION_REQUIRED', 'Select the venue location on the map.');
  end if;

  if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    perform public.raise_playr_error('INVALID_COORDINATES', 'Map coordinates are invalid.');
  end if;

  if p_city is null or length(trim(p_city)) = 0 then
    perform public.raise_playr_error('INVALID_VENUE', 'City or area is required.');
  end if;

  url := trim(coalesce(p_map_url, ''));
  if length(url) = 0 then
    perform public.raise_playr_error('MAP_URL_REQUIRED', 'Map location is required.');
  end if;

  if url !~* '^https?://' then
    perform public.raise_playr_error('INVALID_MAP_URL', 'Map link must be an http(s) URL.');
  end if;

  if url ~* '^(javascript|data|file|vbscript):' then
    perform public.raise_playr_error('INVALID_MAP_URL', 'Map link is not allowed.');
  end if;

  if not coalesce(p_force_create, false) then
    select count(*) into similar_count
    from public.venues v
    where v.location is not null
      and st_dwithin(
        v.location,
        st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
        80
      )
      and lower(trim(v.name)) = lower(trim(p_name));

    if similar_count > 0 then
      perform public.raise_playr_error(
        'SIMILAR_VENUE_EXISTS',
        'A similar venue already exists nearby.'
      );
    end if;
  end if;

  insert into public.venues (
    name, description, address, city, state, country,
    latitude, longitude, map_url, phone, sports, status, created_by
  ) values (
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    trim(p_city),
    nullif(trim(coalesce(p_state, '')), ''),
    coalesce(nullif(trim(p_country), ''), 'India'),
    p_latitude,
    p_longitude,
    url,
    normalized_phone,
    coalesce(p_sports, '[]'::jsonb),
    'community_added',
    uid
  )
  returning * into row_out;

  perform public.create_notification(
    uid,
    'venue_submitted',
    'Venue submitted',
    'Your venue has been submitted for PLAYR review.',
    null,
    null,
    null,
    'venue_submitted:' || row_out.id::text
  );

  return row_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Admin RPCs
-- ---------------------------------------------------------------------------

create or replace function public.admin_get_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ist_today date := (timezone('Asia/Kolkata', now()))::date;
  week_start date := ist_today - 6;
begin
  perform public.assert_playr_admin();

  return jsonb_build_object(
    'games_today', (
      select count(*)::integer from public.games g
      where g.game_date = ist_today
        and g.status not in ('draft')
    ),
    'games_this_week', (
      select count(*)::integer from public.games g
      where g.game_date between week_start and ist_today
        and g.status not in ('draft')
    ),
    'completed_games', (
      select count(*)::integer from public.games g where g.status = 'completed'
    ),
    'cancelled_games', (
      select count(*)::integer from public.games g where g.status = 'cancelled'
    ),
    'players', (select count(*)::integer from public.profiles),
    'venues_total', (select count(*)::integer from public.venues),
    'venues_verified', (
      select count(*)::integer from public.venues v where v.status = 'verified'
    ),
    'venues_community', (
      select count(*)::integer from public.venues v where v.status = 'community_added'
    ),
    'pending_venue_reviews', (
      select count(*)::integer from public.venues v where v.status = 'community_added'
    ),
    'pending_edit_requests', (
      select count(*)::integer from public.venue_edit_requests r where r.status = 'pending'
    ),
    'open_reports', (
      select count(*)::integer from public.reports r where r.status in ('open', 'reviewing')
    ),
    'feedback_count', (
      select count(*)::integer from public.game_experience_feedback
    )
  );
end;
$$;

create or replace function public.admin_list_venue_review_queue(
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_playr_admin();

  return coalesce(
    (
      select jsonb_agg(row_to_json(x) order by x.created_at desc)
      from (
        select
          v.id,
          v.name,
          v.address,
          v.city,
          v.state,
          v.latitude,
          v.longitude,
          v.map_url,
          v.phone,
          v.sports,
          v.status,
          v.created_at,
          v.created_by,
          p.display_name as submitter_name,
          p.username as submitter_username,
          (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', nv.id,
              'name', nv.name,
              'status', nv.status,
              'distance_meters', round(st_distance(
                v.location,
                nv.location
              ))::integer
            ) order by st_distance(v.location, nv.location)), '[]'::jsonb)
            from public.venues nv
            where nv.id <> v.id
              and nv.location is not null
              and v.location is not null
              and st_dwithin(v.location, nv.location, 200)
            limit 5
          ) as nearby_venues
        from public.venues v
        left join public.profiles p on p.id = v.created_by
        where v.status = 'community_added'
        order by v.created_at desc
        limit greatest(1, least(coalesce(p_limit, 50), 100))
        offset greatest(coalesce(p_offset, 0), 0)
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.admin_verify_venue(
  p_venue_id uuid,
  p_notes text default null
)
returns public.venues
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_out public.venues;
begin
  perform public.assert_playr_admin();

  update public.venues v
  set
    status = 'verified',
    verified_at = timezone('utc', now()),
    verified_by = uid,
    rejected_at = null,
    rejected_by = null,
    admin_notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), v.admin_notes),
    updated_at = timezone('utc', now())
  where v.id = p_venue_id
    and v.status = 'community_added'
  returning * into row_out;

  if row_out.id is null then
    perform public.raise_playr_error('ALREADY_REVIEWED', 'This venue was already reviewed.');
  end if;

  perform public.log_moderation_action(
    'venue_verified', 'venue', p_venue_id,
    jsonb_build_object('notes', p_notes)
  );

  if row_out.created_by is not null then
    perform public.create_notification(
      row_out.created_by,
      'venue_verified',
      'Venue verified',
      row_out.name || ' is now verified on PLAYR.',
      null,
      null,
      uid,
      'venue_verified:' || row_out.id::text
    );
  end if;

  return row_out;
end;
$$;

create or replace function public.admin_reject_venue(
  p_venue_id uuid,
  p_notes text default null
)
returns public.venues
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_out public.venues;
begin
  perform public.assert_playr_admin();

  update public.venues v
  set
    status = 'rejected',
    rejected_at = timezone('utc', now()),
    rejected_by = uid,
    admin_notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), v.admin_notes),
    updated_at = timezone('utc', now())
  where v.id = p_venue_id
    and v.status = 'community_added'
  returning * into row_out;

  if row_out.id is null then
    perform public.raise_playr_error('ALREADY_REVIEWED', 'This venue was already reviewed.');
  end if;

  perform public.log_moderation_action(
    'venue_rejected', 'venue', p_venue_id,
    jsonb_build_object('notes', p_notes)
  );

  if row_out.created_by is not null then
    perform public.create_notification(
      row_out.created_by,
      'venue_rejected',
      'Venue not approved',
      'Your venue submission needs changes before it can appear on PLAYR.',
      null,
      null,
      uid,
      'venue_rejected:' || row_out.id::text
    );
  end if;

  return row_out;
end;
$$;

create or replace function public.admin_archive_venue(
  p_venue_id uuid,
  p_notes text default null
)
returns public.venues
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_out public.venues;
begin
  perform public.assert_playr_admin();

  update public.venues v
  set
    status = 'archived',
    admin_notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), v.admin_notes),
    updated_at = timezone('utc', now())
  where v.id = p_venue_id
    and v.status in ('community_added', 'verified', 'rejected')
  returning * into row_out;

  if row_out.id is null then
    perform public.raise_playr_error('NOT_FOUND', 'Venue not found or already archived.');
  end if;

  perform public.log_moderation_action(
    'venue_archived', 'venue', p_venue_id,
    jsonb_build_object('notes', p_notes)
  );

  return row_out;
end;
$$;

create or replace function public.admin_list_venue_edit_requests(
  p_status public.edit_request_status default 'pending',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_playr_admin();

  return coalesce(
    (
      select jsonb_agg(row_to_json(x) order by x.created_at desc)
      from (
        select
          r.id,
          r.venue_id,
          r.submitted_by,
          r.proposed_changes,
          r.reason,
          r.status,
          r.created_at,
          v.name as venue_name,
          v.address as venue_address,
          v.phone as venue_phone,
          v.sports as venue_sports,
          v.map_url as venue_map_url,
          v.description as venue_description,
          v.latitude as venue_latitude,
          v.longitude as venue_longitude,
          p.display_name as submitter_name
        from public.venue_edit_requests r
        join public.venues v on v.id = r.venue_id
        left join public.profiles p on p.id = r.submitted_by
        where r.status = coalesce(p_status, r.status)
        order by r.created_at desc
        limit greatest(1, least(coalesce(p_limit, 50), 100))
        offset greatest(coalesce(p_offset, 0), 0)
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.admin_approve_venue_edit(
  p_request_id uuid,
  p_notes text default null
)
returns public.venue_edit_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  req public.venue_edit_requests;
  v public.venues;
  changes jsonb;
  k text;
  val text;
begin
  perform public.assert_playr_admin();

  select * into req
  from public.venue_edit_requests r
  where r.id = p_request_id
  for update;

  if req.id is null then
    perform public.raise_playr_error('NOT_FOUND', 'Edit request not found.');
  end if;

  if req.status <> 'pending' then
    perform public.raise_playr_error('ALREADY_REVIEWED', 'This edit request was already reviewed.');
  end if;

  select * into v from public.venues where id = req.venue_id for update;

  changes := req.proposed_changes;

  if changes ? 'name' then
    update public.venues set name = trim(changes ->> 'name') where id = v.id;
  end if;
  if changes ? 'address' then
    update public.venues set address = nullif(trim(changes ->> 'address'), '') where id = v.id;
  end if;
  if changes ? 'city' then
    update public.venues set city = nullif(trim(changes ->> 'city'), '') where id = v.id;
  end if;
  if changes ? 'state' then
    update public.venues set state = nullif(trim(changes ->> 'state'), '') where id = v.id;
  end if;
  if changes ? 'phone' then
    update public.venues set phone = changes ->> 'phone' where id = v.id;
  end if;
  if changes ? 'map_url' then
    update public.venues set map_url = changes ->> 'map_url' where id = v.id;
  end if;
  if changes ? 'description' then
    update public.venues set description = nullif(trim(changes ->> 'description'), '') where id = v.id;
  end if;
  if changes ? 'sports' then
    update public.venues set sports = changes -> 'sports' where id = v.id;
  end if;
  if changes ? 'opening_hours' then
    update public.venues set opening_hours = changes -> 'opening_hours' where id = v.id;
  end if;
  if changes ? 'latitude' and changes ? 'longitude' then
    update public.venues
    set latitude = (changes ->> 'latitude')::double precision,
        longitude = (changes ->> 'longitude')::double precision
    where id = v.id;
  end if;

  update public.venue_edit_requests
  set status = 'approved',
      reviewed_at = timezone('utc', now()),
      reviewed_by = uid,
      admin_notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_request_id
  returning * into req;

  perform public.log_moderation_action(
    'venue_edit_approved', 'venue_edit_request', p_request_id,
    jsonb_build_object('venue_id', v.id, 'changes', changes)
  );

  perform public.create_notification(
    req.submitted_by,
    'venue_edit_approved',
    'Venue edit approved',
    'Your proposed changes to ' || v.name || ' are now live.',
    null,
    null,
    uid,
    'venue_edit_approved:' || p_request_id::text
  );

  return req;
end;
$$;

create or replace function public.admin_reject_venue_edit(
  p_request_id uuid,
  p_notes text default null
)
returns public.venue_edit_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  req public.venue_edit_requests;
  vname text;
begin
  perform public.assert_playr_admin();

  update public.venue_edit_requests r
  set status = 'rejected',
      reviewed_at = timezone('utc', now()),
      reviewed_by = uid,
      admin_notes = nullif(trim(coalesce(p_notes, '')), '')
  where r.id = p_request_id
    and r.status = 'pending'
  returning * into req;

  if req.id is null then
    perform public.raise_playr_error('ALREADY_REVIEWED', 'This edit request was already reviewed.');
  end if;

  select name into vname from public.venues where id = req.venue_id;

  perform public.log_moderation_action(
    'venue_edit_rejected', 'venue_edit_request', p_request_id,
    jsonb_build_object('notes', p_notes)
  );

  perform public.create_notification(
    req.submitted_by,
    'venue_edit_rejected',
    'Venue edit not approved',
    coalesce(
      nullif(trim(coalesce(p_notes, '')), ''),
      'Your proposed changes to ' || coalesce(vname, 'the venue') || ' were not approved.'
    ),
    null,
    null,
    uid,
    'venue_edit_rejected:' || p_request_id::text
  );

  return req;
end;
$$;

create or replace function public.admin_list_reports(
  p_status public.report_status default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_playr_admin();

  return coalesce(
    (
      select jsonb_agg(row_to_json(x) order by x.created_at desc)
      from (
        select
          r.id,
          r.reason,
          r.description,
          r.status,
          r.created_at,
          r.game_id,
          r.venue_id,
          r.reported_user_id,
          rp.display_name as reporter_name,
          up.display_name as reported_user_name
        from public.reports r
        join public.profiles rp on rp.id = r.reporter_id
        left join public.profiles up on up.id = r.reported_user_id
        where p_status is null or r.status = p_status
        order by r.created_at desc
        limit greatest(1, least(coalesce(p_limit, 50), 100))
        offset greatest(coalesce(p_offset, 0), 0)
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.admin_update_report(
  p_report_id uuid,
  p_status public.report_status,
  p_notes text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_out public.reports;
  action public.moderation_action_type;
begin
  perform public.assert_playr_admin();

  if p_status not in ('resolved', 'dismissed', 'reviewing') then
    perform public.raise_playr_error('INVALID_STATUS', 'Invalid report status.');
  end if;

  update public.reports r
  set status = p_status,
      updated_at = timezone('utc', now())
  where r.id = p_report_id
    and r.status in ('open', 'reviewing')
  returning * into row_out;

  if row_out.id is null then
    perform public.raise_playr_error('ALREADY_REVIEWED', 'This report was already closed.');
  end if;

  action := case p_status
    when 'resolved' then 'report_resolved'::public.moderation_action_type
    when 'dismissed' then 'report_dismissed'::public.moderation_action_type
    else 'report_escalated'::public.moderation_action_type
  end;

  perform public.log_moderation_action(
    action, 'report', p_report_id,
    jsonb_build_object('notes', p_notes, 'status', p_status)
  );

  return row_out;
end;
$$;

create or replace function public.admin_suspend_user(
  p_user_id uuid,
  p_notes text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_out public.profiles;
begin
  perform public.assert_playr_admin();

  if p_user_id = uid then
    perform public.raise_playr_error('INVALID_INPUT', 'You cannot suspend yourself.');
  end if;

  update public.profiles p
  set suspended_at = timezone('utc', now()),
      suspended_by = uid
  where p.id = p_user_id
    and p.suspended_at is null
  returning * into row_out;

  if row_out.id is null then
    perform public.raise_playr_error('ALREADY_SUSPENDED', 'User is already suspended or not found.');
  end if;

  perform public.log_moderation_action(
    'user_suspended', 'profile', p_user_id,
    jsonb_build_object('notes', p_notes)
  );

  return row_out;
end;
$$;

create or replace function public.admin_unsuspend_user(
  p_user_id uuid,
  p_notes text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_out public.profiles;
begin
  perform public.assert_playr_admin();

  update public.profiles p
  set suspended_at = null,
      suspended_by = null
  where p.id = p_user_id
    and p.suspended_at is not null
  returning * into row_out;

  if row_out.id is null then
    perform public.raise_playr_error('NOT_SUSPENDED', 'User is not suspended.');
  end if;

  perform public.log_moderation_action(
    'user_unsuspended', 'profile', p_user_id,
    jsonb_build_object('notes', p_notes)
  );

  return row_out;
end;
$$;

create or replace function public.admin_list_moderation_actions(
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_playr_admin();

  return coalesce(
    (
      select jsonb_agg(row_to_json(x) order by x.created_at desc)
      from (
        select
          m.id,
          m.action,
          m.entity_type,
          m.entity_id,
          m.metadata,
          m.created_at,
          p.display_name as admin_name
        from public.moderation_actions m
        join public.profiles p on p.id = m.admin_id
        order by m.created_at desc
        limit greatest(1, least(coalesce(p_limit, 50), 100))
        offset greatest(coalesce(p_offset, 0), 0)
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.admin_list_game_feedback(
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_playr_admin();

  return coalesce(
    (
      select jsonb_agg(row_to_json(x) order by x.created_at desc)
      from (
        select
          f.id,
          f.game_id,
          f.overall_rating,
          f.comment,
          f.tags,
          f.is_hidden,
          f.created_at,
          f.venue_id,
          p.display_name as author_name,
          g.title as game_title
        from public.game_experience_feedback f
        join public.profiles p on p.id = f.user_id
        join public.games g on g.id = f.game_id
        order by f.created_at desc
        limit greatest(1, least(coalesce(p_limit, 50), 100))
        offset greatest(coalesce(p_offset, 0), 0)
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.admin_hide_game_feedback(
  p_feedback_id uuid,
  p_notes text default null
)
returns public.game_experience_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_out public.game_experience_feedback;
begin
  perform public.assert_playr_admin();

  update public.game_experience_feedback f
  set is_hidden = true,
      hidden_at = timezone('utc', now()),
      hidden_by = uid
  where f.id = p_feedback_id
    and not f.is_hidden
  returning * into row_out;

  if row_out.id is null then
    perform public.raise_playr_error('NOT_FOUND', 'Feedback not found or already hidden.');
  end if;

  perform public.log_moderation_action(
    'feedback_hidden', 'game_experience_feedback', p_feedback_id,
    jsonb_build_object('notes', p_notes)
  );

  return row_out;
end;
$$;

create or replace function public.admin_search_users(
  p_query text,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_playr_admin();

  if p_query is null or length(trim(p_query)) < 2 then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(row_to_json(x))
      from (
        select
          p.id,
          p.display_name,
          p.username,
          p.created_at,
          p.suspended_at,
          (
            select count(*)::integer
            from public.game_players gp
            where gp.user_id = p.id
          ) as games_joined,
          (
            select count(*)::integer
            from public.games g
            where g.host_id = p.id
          ) as games_hosted
        from public.profiles p
        where p.display_name ilike '%' || trim(p_query) || '%'
           or p.username ilike '%' || trim(p_query) || '%'
        order by p.created_at desc
        limit greatest(1, least(coalesce(p_limit, 20), 50))
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.admin_get_overview() to authenticated;
grant execute on function public.admin_list_venue_review_queue(integer, integer) to authenticated;
grant execute on function public.admin_verify_venue(uuid, text) to authenticated;
grant execute on function public.admin_reject_venue(uuid, text) to authenticated;
grant execute on function public.admin_archive_venue(uuid, text) to authenticated;
grant execute on function public.admin_list_venue_edit_requests(public.edit_request_status, integer, integer) to authenticated;
grant execute on function public.admin_approve_venue_edit(uuid, text) to authenticated;
grant execute on function public.admin_reject_venue_edit(uuid, text) to authenticated;
grant execute on function public.admin_list_reports(public.report_status, integer, integer) to authenticated;
grant execute on function public.admin_update_report(uuid, public.report_status, text) to authenticated;
grant execute on function public.admin_suspend_user(uuid, text) to authenticated;
grant execute on function public.admin_unsuspend_user(uuid, text) to authenticated;
grant execute on function public.admin_list_moderation_actions(integer, integer) to authenticated;
grant execute on function public.admin_list_game_feedback(integer, integer) to authenticated;
grant execute on function public.admin_hide_game_feedback(uuid, text) to authenticated;
grant execute on function public.admin_search_users(text, integer) to authenticated;

grant execute on function public.is_playr_admin(uuid) to service_role;
grant execute on function public.log_moderation_action(public.moderation_action_type, text, uuid, jsonb) to service_role;
