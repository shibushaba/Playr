-- Demo users, groups, and games for local/dev
-- Passwords for demo users: PlayrDemo123!
-- These are clearly fictional test accounts for Kozhikode MVP development.

create extension if not exists pgcrypto;

-- Helper to upsert a confirmed auth user with password
create or replace function public.playr_seed_demo_user(
  p_id uuid,
  p_email text,
  p_password text,
  p_display_name text,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', p_display_name, 'username', p_username),
    timezone('utc', now()),
    timezone('utc', now()),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    p_id,
    p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email',
    p_id::text,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict do nothing;

  update public.profiles
  set
    display_name = p_display_name,
    username = p_username,
    bio = 'PLAYR demo player in Kozhikode (test account).',
    home_latitude = 11.2588,
    home_longitude = 75.7804
  where id = p_id;
end;
$$;

select public.playr_seed_demo_user(
  '33333333-3333-3333-3333-333333333301',
  'host.demo@playr.test',
  'PlayrDemo123!',
  'Ayaan Host',
  'ayaan_host'
);

select public.playr_seed_demo_user(
  '33333333-3333-3333-3333-333333333302',
  'player.demo@playr.test',
  'PlayrDemo123!',
  'Meera Player',
  'meera_plays'
);

select public.playr_seed_demo_user(
  '33333333-3333-3333-3333-333333333303',
  'cricket.demo@playr.test',
  'PlayrDemo123!',
  'Rahul Nets',
  'rahul_nets'
);

-- Recurring group template
insert into public.recurring_groups (
  id, name, description, host_id, sport_id, venue_id,
  visibility, recurrence_type, recurrence_config, start_time, duration_minutes,
  minimum_players, maximum_players, player_share
) values (
  '44444444-4444-4444-4444-444444444401',
  'Kallai Evening Football',
  'Weekly pickup football template. Each occurrence is its own game.',
  '33333333-3333-3333-3333-333333333301',
  '11111111-1111-1111-1111-111111111101',
  '22222222-2222-2222-2222-222222222201',
  'public',
  'weekly',
  '{"days":["fri"]}'::jsonb,
  '19:00',
  90,
  10,
  14,
  100.00
) on conflict (id) do nothing;

-- Games relative to current date in Asia/Kolkata
insert into public.games (
  id, host_id, group_id, sport_id, venue_id, title, description,
  game_date, start_time, end_time,
  minimum_players, maximum_players, player_share,
  visibility, status, venue_confirmation
) values
(
  '55555555-5555-5555-5555-555555555501',
  '33333333-3333-3333-3333-333333333301',
  '44444444-4444-4444-4444-444444444401',
  '11111111-1111-1111-1111-111111111101',
  '22222222-2222-2222-2222-222222222201',
  'Football tonight — Kallai turf',
  'Open 7v7. Host books the venue. Player share is offline only.',
  (timezone('Asia/Kolkata', now()))::date,
  '20:00',
  '21:30',
  10, 14, 120.00,
  'public', 'open', 'confirmed'
),
(
  '55555555-5555-5555-5555-555555555502',
  '33333333-3333-3333-3333-333333333301',
  null,
  '11111111-1111-1111-1111-111111111101',
  '22222222-2222-2222-2222-222222222205',
  'Football tomorrow — Mankavu',
  'Casual football. Spots fill fast.',
  ((timezone('Asia/Kolkata', now()))::date + 1),
  '18:30',
  '20:00',
  8, 12, 80.00,
  'public', 'open', 'pending'
),
(
  '55555555-5555-5555-5555-555555555503',
  '33333333-3333-3333-3333-333333333303',
  null,
  '11111111-1111-1111-1111-111111111102',
  '22222222-2222-2222-2222-222222222203',
  'Cricket nets this weekend',
  'Weekend net practice. Bring your own bat if you can.',
  ((timezone('Asia/Kolkata', now()))::date + ((6 - extract(dow from timezone('Asia/Kolkata', now()))::int + 7) % 7)),
  '07:30',
  '09:30',
  6, 12, 100.00,
  'public', 'confirmed', 'confirmed'
),
(
  '55555555-5555-5555-5555-555555555504',
  '33333333-3333-3333-3333-333333333302',
  null,
  '11111111-1111-1111-1111-111111111103',
  '22222222-2222-2222-2222-222222222202',
  'Badminton tomorrow evening',
  'Doubles rotation. Intermediate welcome.',
  ((timezone('Asia/Kolkata', now()))::date + 1),
  '19:00',
  '21:00',
  4, 8, 150.00,
  'public', 'open', 'pending'
),
(
  '55555555-5555-5555-5555-555555555505',
  '33333333-3333-3333-3333-333333333301',
  null,
  '11111111-1111-1111-1111-111111111101',
  '22222222-2222-2222-2222-222222222201',
  'Nearly full football (test)',
  'Seed game used to test full / waitlist behaviour.',
  ((timezone('Asia/Kolkata', now()))::date + 2),
  '21:00',
  '22:30',
  8, 8, 110.00,
  'public', 'open', 'pending'
),
(
  '55555555-5555-5555-5555-555555555506',
  '33333333-3333-3333-3333-333333333303',
  null,
  '11111111-1111-1111-1111-111111111104',
  '22222222-2222-2222-2222-222222222204',
  'Cancelled basketball (test)',
  'Seed cancelled game.',
  ((timezone('Asia/Kolkata', now()))::date + 3),
  '17:00',
  '18:30',
  6, 10, null,
  'public', 'cancelled', 'pending'
),
(
  '55555555-5555-5555-5555-555555555507',
  '33333333-3333-3333-3333-333333333301',
  null,
  '11111111-1111-1111-1111-111111111101',
  '22222222-2222-2222-2222-222222222201',
  'Private invite football (test)',
  'Invite-only seed game — should not appear in public discovery.',
  ((timezone('Asia/Kolkata', now()))::date + 1),
  '22:00',
  '23:00',
  8, 10, 140.00,
  'invite_only', 'open', 'pending'
)
on conflict (id) do nothing;

-- Host rows + participants for nearly-full game
insert into public.game_players (game_id, user_id, role, status) values
  ('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333301', 'host', 'confirmed'),
  ('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333302', 'player', 'confirmed'),
  ('55555555-5555-5555-5555-555555555502', '33333333-3333-3333-3333-333333333301', 'host', 'confirmed'),
  ('55555555-5555-5555-5555-555555555503', '33333333-3333-3333-3333-333333333303', 'host', 'confirmed'),
  ('55555555-5555-5555-5555-555555555503', '33333333-3333-3333-3333-333333333301', 'player', 'confirmed'),
  ('55555555-5555-5555-5555-555555555504', '33333333-3333-3333-3333-333333333302', 'host', 'confirmed'),
  ('55555555-5555-5555-5555-555555555505', '33333333-3333-3333-3333-333333333301', 'host', 'confirmed'),
  ('55555555-5555-5555-5555-555555555505', '33333333-3333-3333-3333-333333333302', 'player', 'confirmed'),
  ('55555555-5555-5555-5555-555555555505', '33333333-3333-3333-3333-333333333303', 'player', 'confirmed'),
  ('55555555-5555-5555-5555-555555555507', '33333333-3333-3333-3333-333333333301', 'host', 'confirmed')
on conflict do nothing;

-- Fill nearly-full game to capacity using duplicate-safe loop of demo users only (already 3).
-- Mark remaining capacity conceptually: maximum_players = 8 but only 3 confirmed in seed;
-- add waitlist example is enough. Update max to 3 to simulate full:
update public.games
set maximum_players = 3, minimum_players = 2
where id = '55555555-5555-5555-5555-555555555505';

drop function if exists public.playr_seed_demo_user(uuid, text, text, text, text);
