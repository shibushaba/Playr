-- PLAYR trust: profile verification, venue phone, venue booking confirmation

-- ---------------------------------------------------------------------------
-- 1. Profile verification columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists phone_verified_at timestamptz,
  add column if not exists email_verified_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Game venue booking confirmation
-- ---------------------------------------------------------------------------

alter table public.games
  add column if not exists venue_booking_confirmed_at timestamptz,
  add column if not exists venue_booking_confirmed_by uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 3. Phone verification challenges
-- ---------------------------------------------------------------------------

create table if not exists public.phone_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  phone_e164 text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists phone_verification_challenges_user_idx
  on public.phone_verification_challenges (user_id, created_at desc);

alter table public.phone_verification_challenges enable row level security;

-- No direct client access — RPC only
create policy phone_challenges_deny_all
  on public.phone_verification_challenges for all
  using (false);

-- Pilot: expose OTP codes in RPC responses when enabled (disable in production)
create table if not exists public.playr_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);

insert into public.playr_settings (key, value)
values ('trust', '{"expose_phone_verification_codes": true}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Extend game_events types
-- ---------------------------------------------------------------------------

alter table public.game_events drop constraint if exists game_events_type_check;

alter table public.game_events add constraint game_events_type_check check (
  event_type in (
    'game_created', 'player_reserved', 'player_confirmed', 'player_cancelled',
    'player_waitlisted', 'player_promoted', 'reservation_expired',
    'game_confirmed', 'game_cancelled', 'game_started', 'game_completed',
    'player_checked_in', 'attendance_marked', 'attendance_disputed',
    'venue_booking_confirmed', 'venue_booking_invalidated', 'profile_verified'
  )
);

-- ---------------------------------------------------------------------------
-- 5. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.normalize_phone_e164(
  p_phone text,
  p_default_country text default '91'
)
returns text
language plpgsql
immutable
as $$
declare
  raw text;
  digits text;
begin
  raw := trim(coalesce(p_phone, ''));
  if raw = '' then
    return null;
  end if;

  digits := regexp_replace(raw, '[^0-9+]', '', 'g');
  if digits = '' then
    return null;
  end if;

  if digits ~ '^\+' then
    digits := regexp_replace(digits, '^\+', '');
    if length(digits) < 8 or length(digits) > 15 then
      return null;
    end if;
    return '+' || digits;
  end if;

  if length(digits) = 10 then
    return '+' || p_default_country || digits;
  end if;

  if length(digits) >= 11 and length(digits) <= 15 then
    return '+' || digits;
  end if;

  return null;
end;
$$;

create or replace function public.is_valid_e164(p_phone text)
returns boolean
language sql
immutable
as $$
  select p_phone is not null and p_phone ~ '^\+[1-9][0-9]{7,14}$';
$$;

create or replace function public.sync_profile_email_verified(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  confirmed timestamptz;
begin
  select u.email_confirmed_at into confirmed
  from auth.users u
  where u.id = p_user_id;

  if confirmed is not null then
    update public.profiles
    set email_verified_at = coalesce(email_verified_at, confirmed),
        updated_at = timezone('utc', now())
    where id = p_user_id;
  end if;
end;
$$;

create or replace function public.profile_has_verified_phone(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.phone is not null
      and public.is_valid_e164(p.phone)
      and p.phone_verified_at is not null
  );
$$;

create or replace function public.profile_has_verified_email(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.email_verified_at is not null
  );
$$;

create or replace function public.expose_phone_verification_codes()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (value->>'expose_phone_verification_codes')::boolean
     from public.playr_settings where key = 'trust'),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. get_my_profile — sync email verification on read
-- ---------------------------------------------------------------------------

create or replace function public.get_my_profile()
returns public.profiles
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is not null then
    perform public.sync_profile_email_verified(uid);
  end if;
  return (select p from public.profiles p where p.id = uid);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Phone verification RPCs
-- ---------------------------------------------------------------------------

create or replace function public.request_phone_verification(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  normalized text;
  code text;
  code_hash text;
  challenge_id uuid;
  expose_code boolean;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  normalized := public.normalize_phone_e164(p_phone);
  if not public.is_valid_e164(normalized) then
    perform public.raise_playr_error('INVALID_PHONE', 'Enter a valid phone number.');
  end if;

  code := lpad((floor(random() * 1000000))::text, 6, '0');
  code_hash := encode(digest(code, 'sha256'), 'hex');

  insert into public.phone_verification_challenges (
    user_id, phone_e164, code_hash, expires_at
  ) values (
    uid, normalized, code_hash, timezone('utc', now()) + interval '10 minutes'
  )
  returning id into challenge_id;

  expose_code := public.expose_phone_verification_codes();

  return jsonb_build_object(
    'challenge_id', challenge_id,
    'phone', normalized,
    'expires_at', (timezone('utc', now()) + interval '10 minutes'),
    'dev_code', case when expose_code then code else null end
  );
end;
$$;

create or replace function public.confirm_phone_verification(
  p_code text,
  p_challenge_id uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  challenge public.phone_verification_challenges%rowtype;
  submitted_hash text;
  row_out public.profiles;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  if p_code is null or length(trim(p_code)) <> 6 then
    perform public.raise_playr_error('INVALID_CODE', 'Enter the 6-digit code.');
  end if;

  submitted_hash := encode(digest(trim(p_code), 'sha256'), 'hex');

  select * into challenge
  from public.phone_verification_challenges c
  where c.user_id = uid
    and c.verified_at is null
    and c.expires_at > timezone('utc', now())
    and (p_challenge_id is null or c.id = p_challenge_id)
  order by c.created_at desc
  limit 1;

  if not found then
    perform public.raise_playr_error('CODE_EXPIRED', 'That code expired. Request a new one.');
  end if;

  if challenge.attempts >= 5 then
    perform public.raise_playr_error('TOO_MANY_ATTEMPTS', 'Too many attempts. Request a new code.');
  end if;

  update public.phone_verification_challenges
  set attempts = attempts + 1
  where id = challenge.id;

  if challenge.code_hash <> submitted_hash then
    perform public.raise_playr_error('INVALID_CODE', 'That code is incorrect.');
  end if;

  update public.phone_verification_challenges
  set verified_at = timezone('utc', now())
  where id = challenge.id;

  update public.profiles
  set phone = challenge.phone_e164,
      phone_verified_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = uid
  returning * into row_out;

  perform public.log_game_event(
    null,
    'profile_verified',
    uid,
    jsonb_build_object('kind', 'phone')
  );

  return row_out;
exception
  when others then
    if sqlstate = 'P0001' then
      raise;
    end if;
    perform public.raise_playr_error('VERIFICATION_FAILED', 'Could not verify phone.');
end;
$$;

grant execute on function public.request_phone_verification(text) to authenticated;
grant execute on function public.confirm_phone_verification(text, uuid) to authenticated;

-- Fix log_game_event for profile_verified without game_id — allow null game_id
alter table public.game_events alter column game_id drop not null;

-- ---------------------------------------------------------------------------
-- 8. Venue contact for authorized hosts
-- ---------------------------------------------------------------------------

create or replace function public.get_venue_contact_phone(p_venue_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  phone text;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select v.phone into phone
  from public.venues v
  where v.id = p_venue_id;

  if phone is null then
    return null;
  end if;

  -- Host creating/editing a draft game, venue creator, or host of a game at this venue
  if exists (
    select 1 from public.venues v where v.id = p_venue_id and v.created_by = uid
  ) or exists (
    select 1 from public.games g
    where g.venue_id = p_venue_id
      and g.host_id = uid
      and g.status in ('draft', 'open', 'confirmed', 'live')
  ) then
    return phone;
  end if;

  perform public.raise_playr_error('FORBIDDEN', 'Venue contact is not available.');
end;
$$;

grant execute on function public.get_venue_contact_phone(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. create_venue — require phone
-- ---------------------------------------------------------------------------

drop function if exists public.create_venue(
  text, double precision, double precision, text, text, text, text, text, jsonb, text, boolean
);

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

  return row_out;
end;
$$;

grant execute on function public.create_venue(
  text, double precision, double precision, text, text, text, text, text, text, jsonb, text, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Venue booking confirmation + publish
-- ---------------------------------------------------------------------------

create or replace function public.confirm_game_venue_booking(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.games%rowtype;
  v_phone text;
  row_out public.games;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select * into g from public.games where id = p_game_id for update;
  if not found then
    perform public.raise_playr_error('GAME_NOT_FOUND', 'Game not found.');
  end if;

  if g.host_id <> uid and not public.is_game_co_host(p_game_id, uid) then
    perform public.raise_playr_error('FORBIDDEN', 'Only the host can confirm venue booking.');
  end if;

  if g.status not in ('draft', 'open') then
    perform public.raise_playr_error('GAME_CLOSED', 'This game cannot be edited.');
  end if;

  if g.venue_id is null then
    perform public.raise_playr_error('VENUE_REQUIRED', 'Select a venue first.');
  end if;

  select v.phone into v_phone from public.venues v where v.id = g.venue_id;
  if v_phone is null or not public.is_valid_e164(v_phone) then
    perform public.raise_playr_error('VENUE_CONTACT_REQUIRED', 'Venue phone is missing.');
  end if;

  update public.games
  set venue_booking_confirmed_at = timezone('utc', now()),
      venue_booking_confirmed_by = uid,
      venue_confirmation = 'confirmed',
      updated_at = timezone('utc', now())
  where id = p_game_id
  returning * into row_out;

  perform public.log_game_event(
    p_game_id,
    'venue_booking_confirmed',
    uid,
    jsonb_build_object(
      'venue_id', g.venue_id,
      'game_date', g.game_date,
      'start_time', g.start_time,
      'end_time', g.end_time
    )
  );

  return row_out;
end;
$$;

create or replace function public.publish_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.games%rowtype;
  v_phone text;
  row_out public.games;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  perform public.sync_profile_email_verified(uid);

  if not exists (
    select 1 from public.profiles p
    where p.id = uid
      and p.display_name is not null
      and length(trim(p.display_name)) > 0
  ) then
    perform public.raise_playr_error('PROFILE_INCOMPLETE', 'Add your display name.');
  end if;

  if not public.profile_has_verified_phone(uid) then
    perform public.raise_playr_error(
      'PHONE_VERIFICATION_REQUIRED',
      'Verify your phone before hosting.'
    );
  end if;

  if not public.profile_has_verified_email(uid) then
    perform public.raise_playr_error(
      'EMAIL_VERIFICATION_REQUIRED',
      'Confirm your email before hosting.'
    );
  end if;

  select * into g from public.games where id = p_game_id for update;
  if not found then
    perform public.raise_playr_error('GAME_NOT_FOUND', 'Game not found.');
  end if;

  if g.host_id <> uid then
    perform public.raise_playr_error('FORBIDDEN', 'Only the host can publish.');
  end if;

  if g.status <> 'draft' then
    perform public.raise_playr_error('GAME_CLOSED', 'Only draft games can be published.');
  end if;

  if g.venue_id is null then
    perform public.raise_playr_error('VENUE_REQUIRED', 'Select a venue.');
  end if;

  select v.phone into v_phone from public.venues v where v.id = g.venue_id;
  if v_phone is null or not public.is_valid_e164(v_phone) then
    perform public.raise_playr_error('VENUE_CONTACT_REQUIRED', 'Venue phone is required.');
  end if;

  if g.venue_booking_confirmed_at is null then
    perform public.raise_playr_error(
      'VENUE_BOOKING_REQUIRED',
      'Confirm venue booking before publishing.'
    );
  end if;

  update public.games
  set status = 'open',
      updated_at = timezone('utc', now())
  where id = p_game_id
  returning * into row_out;

  perform public.log_game_event(p_game_id, 'game_created', uid, jsonb_build_object('published', true));

  return row_out;
end;
$$;

grant execute on function public.confirm_game_venue_booking(uuid) to authenticated;
grant execute on function public.publish_game(uuid) to authenticated;

-- Co-host helper if missing
create or replace function public.is_game_co_host(p_game_id uuid, p_user_id uuid)
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
      and gp.role = 'co_host'
      and gp.status in ('confirmed', 'reserved', 'attended')
  );
$$;

-- ---------------------------------------------------------------------------
-- 11. Invalidate booking on schedule/venue change
-- ---------------------------------------------------------------------------

create or replace function public.invalidate_venue_booking_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.venue_booking_confirmed_at is not null
     and (
       new.venue_id is distinct from old.venue_id
       or new.game_date is distinct from old.game_date
       or new.start_time is distinct from old.start_time
       or new.end_time is distinct from old.end_time
     ) then
    new.venue_booking_confirmed_at := null;
    new.venue_booking_confirmed_by := null;
    new.venue_confirmation := 'pending';

    perform public.log_game_event(
      old.id,
      'venue_booking_invalidated',
      auth.uid(),
      jsonb_build_object(
        'venue_id', old.venue_id,
        'game_date', old.game_date,
        'start_time', old.start_time,
        'end_time', old.end_time
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists games_invalidate_venue_booking on public.games;
create trigger games_invalidate_venue_booking
before update on public.games
for each row execute function public.invalidate_venue_booking_on_change();

-- ---------------------------------------------------------------------------
-- 12. Block client draft→open; drafts only on insert
-- ---------------------------------------------------------------------------

drop policy if exists games_insert_host on public.games;

create policy games_insert_host
on public.games for insert
to authenticated
with check (host_id = auth.uid() and status = 'draft');

create or replace function public.protect_game_mutations()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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
    if new.status = 'open' and old.status = 'draft' then
      perform public.raise_playr_error(
        'USE_PUBLISH_RPC',
        'Use publish to open the game.'
      );
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
-- 13. join_game — require verified phone + display name
-- ---------------------------------------------------------------------------

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

  perform public.sync_profile_email_verified(uid);

  if not coalesce(p_contact_consent, false) then
    raise exception 'CONTACT_CONSENT_REQUIRED' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = uid
      and p.display_name is not null
      and length(trim(p.display_name)) > 0
  ) then
    raise exception 'PROFILE_INCOMPLETE' using errcode = 'P0001';
  end if;

  if not public.profile_has_verified_phone(uid) then
    raise exception 'PHONE_VERIFICATION_REQUIRED' using errcode = 'P0001';
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
