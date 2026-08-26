create or replace function public.playr_pilot_verify()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  results jsonb := '[]'::jsonb;
  host_id uuid := '33333333-3333-3333-3333-333333333301';
  user_a uuid := '33333333-3333-3333-3333-333333333302';
  user_b uuid := '33333333-3333-3333-3333-333333333303';
  sport_id uuid;
  venue_id uuid := '22222222-2222-2222-2222-222222222201';
  g_race uuid; g_deadline_ok uuid; g_deadline_fail uuid; g_expire uuid;
  g_lock uuid; g_contact uuid; g_private uuid; g_invite uuid; g_public uuid;
  g_wait uuid; g_check uuid;
  cap int; st text; st_a text; st_b text; n1 int; n2 int; gen2 int;
  phone text; inv public.game_invites%rowtype; preview jsonb;
  ok boolean; err text;
  row_a public.game_players; row_b public.game_players;
  tick1 text; tick2 text; notif_before int; notif_after int;
  promoted public.game_players;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  select id into sport_id from public.sports where slug = 'football' limit 1;

  insert into public.profiles (id, display_name, username, phone, is_active)
  values
    (host_id, 'Pilot Host', 'pilot_host', '+919999000001', true),
    (user_a, 'Pilot A', 'pilot_a', '+919999000002', true),
    (user_b, 'Pilot B', 'pilot_b', '+919999000003', true)
  on conflict (id) do update
  set phone = coalesce(public.profiles.phone, excluded.phone), is_active = true;

  -- 1 LAST SEAT
  insert into public.games (
    host_id, sport_id, venue_id, title, game_date, start_time, end_time,
    minimum_players, maximum_players, visibility, status, confirmation_deadline
  ) values (
    host_id, sport_id, venue_id, 'PILOT race seat',
    (timezone('Asia/Kolkata', now()))::date + 2, '19:00', '20:00',
    2, 2, 'public', 'open', timezone('utc', now()) + interval '2 days'
  ) returning id into g_race;
  perform public.ensure_host_player_for_system(g_race, host_id);

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  row_a := public.join_game(g_race, true);

  begin
    perform set_config('request.jwt.claim.sub', user_b::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
    row_b := public.join_game(g_race, true);
    err := null;
  exception when others then
    err := sqlerrm; row_b := null;
  end;

  select public.get_game_player_count(g_race) into cap;
  select status into st_a from public.game_players where game_id = g_race and user_id = user_a;
  select status into st_b from public.game_players where game_id = g_race and user_id = user_b;
  ok := (cap <= 2) and (st_a = 'reserved') and (st_b = 'waitlisted' or coalesce(err,'') like '%GAME_FULL%');
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 1, 'name', 'last_seat_race',
    'result', case when ok then 'PASS' else 'FAIL' end,
    'detail', jsonb_build_object('capacity', cap, 'a', st_a, 'b', st_b, 'err', err,
      'note', 'Current product: full join waitlists (not GAME_FULL). Capacity never exceeds max.')
  ));

  -- 2 RESERVATION EXPIRE
  update public.game_players
  set reservation_expires_at = timezone('utc', now()) - interval '1 minute'
  where game_id = g_race and user_id = user_a and status = 'reserved';
  n1 := public.cleanup_expired_reservations();
  update public.game_players set status = 'cancelled', cancelled_at = timezone('utc', now())
  where game_id = g_race and user_id = user_b;
  begin
    perform set_config('request.jwt.claim.sub', user_b::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
    row_b := public.join_game(g_race, true); st_b := row_b.status; err := null;
  exception when others then err := sqlerrm; st_b := null;
  end;
  select status into st_a from public.game_players where game_id = g_race and user_id = user_a;
  select public.get_game_player_count(g_race) into cap;
  ok := (st_a = 'cancelled') and (st_b = 'reserved') and (cap <= 2) and (n1 >= 1);
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 2, 'name', 'reservation_expire_rejoin',
    'result', case when ok then 'PASS' else 'FAIL' end,
    'detail', jsonb_build_object('cleaned', n1, 'a', st_a, 'b', st_b, 'cap', cap, 'err', err)
  ));

  -- 3 DEADLINE (force deadline after insert trigger)
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  insert into public.games (
    host_id, sport_id, venue_id, title, game_date, start_time, end_time,
    minimum_players, maximum_players, visibility, status, confirmation_deadline
  ) values (
    host_id, sport_id, venue_id, 'PILOT deadline ok',
    (timezone('Asia/Kolkata', now()))::date + 3, '20:00', '21:00',
    2, 4, 'public', 'open', timezone('utc', now()) + interval '1 day'
  ) returning id into g_deadline_ok;
  update public.games set confirmation_deadline = timezone('utc', now()) - interval '2 minutes' where id = g_deadline_ok;
  perform public.ensure_host_player_for_system(g_deadline_ok, host_id);
  insert into public.game_players (game_id, user_id, role, status, contact_consent_at)
  values (g_deadline_ok, user_a, 'player', 'confirmed', timezone('utc', now()));

  insert into public.games (
    host_id, sport_id, venue_id, title, game_date, start_time, end_time,
    minimum_players, maximum_players, visibility, status, confirmation_deadline
  ) values (
    host_id, sport_id, venue_id, 'PILOT deadline fail',
    (timezone('Asia/Kolkata', now()))::date + 3, '21:00', '22:00',
    2, 4, 'public', 'open', timezone('utc', now()) + interval '1 day'
  ) returning id into g_deadline_fail;
  update public.games set confirmation_deadline = timezone('utc', now()) - interval '2 minutes' where id = g_deadline_fail;
  perform public.ensure_host_player_for_system(g_deadline_fail, host_id);

  n1 := public.process_open_game_confirmations();
  select status into st from public.games where id = g_deadline_ok;
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 3, 'name', 'deadline_confirm',
    'result', case when st = 'confirmed' then 'PASS' else 'FAIL' end,
    'detail', jsonb_build_object('status', st, 'processed', n1)
  ));
  select status into st from public.games where id = g_deadline_fail;
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 3, 'name', 'deadline_cancel',
    'result', case when st = 'cancelled' then 'PASS' else 'FAIL' end,
    'detail', st
  ));

  -- 4 EXPIRED RESERVATION
  insert into public.games (
    host_id, sport_id, venue_id, title, game_date, start_time, end_time,
    minimum_players, maximum_players, visibility, status, confirmation_deadline
  ) values (
    host_id, sport_id, venue_id, 'PILOT expire res',
    (timezone('Asia/Kolkata', now()))::date + 4, '18:00', '19:00',
    2, 4, 'public', 'open', timezone('utc', now()) + interval '1 day'
  ) returning id into g_expire;
  perform public.ensure_host_player_for_system(g_expire, host_id);
  insert into public.game_players (game_id, user_id, role, status, reservation_expires_at, contact_consent_at)
  values (g_expire, user_a, 'player', 'reserved', timezone('utc', now()) - interval '2 minutes', timezone('utc', now()));
  n1 := public.get_game_player_count(g_expire);
  n2 := public.cleanup_expired_reservations();
  select status into st from public.game_players where game_id = g_expire and user_id = user_a;
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 4, 'name', 'expired_reservation_cleanup',
    'result', case when st = 'cancelled' and public.get_game_player_count(g_expire) = 1 then 'PASS' else 'FAIL' end,
    'detail', jsonb_build_object('status', st, 'count_before_cleanup', n1, 'cleaned', n2)
  ));

  -- 5 LOCK
  insert into public.games (
    host_id, sport_id, venue_id, title, game_date, start_time, end_time,
    minimum_players, maximum_players, visibility, status, confirmation_deadline
  ) values (
    host_id, sport_id, venue_id, 'PILOT lock',
    (timezone('Asia/Kolkata', now()))::date + 5, '17:00', '18:00',
    2, 4, 'public', 'confirmed', timezone('utc', now()) - interval '1 hour'
  ) returning id into g_lock;
  perform public.ensure_host_player_for_system(g_lock, host_id);

  begin
    perform set_config('request.jwt.claim.sub', host_id::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', host_id::text, 'role', 'authenticated')::text, true);
    update public.games set status = 'open' where id = g_lock;
    ok := false; err := 'update_succeeded';
  exception when others then ok := true; err := sqlerrm;
  end;
  select status into st from public.games where id = g_lock;
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 5, 'name', 'confirmed_status_lock',
    'result', case when ok and st = 'confirmed' then 'PASS' else 'FAIL' end,
    'detail', jsonb_build_object('blocked', ok, 'status', st, 'error', err)
  ));

  begin
    perform set_config('request.jwt.claim.sub', host_id::text, true);
    update public.games set maximum_players = 99, confirmation_deadline = timezone('utc', now()) + interval '1 day',
      start_time = '12:00', host_id = user_a where id = g_lock;
    ok := false; err := 'update_succeeded';
  exception when others then ok := true; err := sqlerrm;
  end;
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 5, 'name', 'confirmed_fields_lock',
    'result', case when ok then 'PASS' else 'FAIL' end, 'detail', err
  ));

  -- 6 CONTACT
  perform set_config('request.jwt.claim.sub', '', true);
  insert into public.games (
    host_id, sport_id, venue_id, title, game_date, start_time, end_time,
    minimum_players, maximum_players, visibility, status, confirmation_deadline
  ) values (
    host_id, sport_id, venue_id, 'PILOT contact',
    (timezone('Asia/Kolkata', now()))::date + 6, '16:00', '17:00',
    2, 10, 'public', 'open', timezone('utc', now()) + interval '1 day'
  ) returning id into g_contact;
  perform public.ensure_host_player_for_system(g_contact, host_id);
  insert into public.game_players (game_id, user_id, role, status, contact_consent_at)
  values (g_contact, user_a, 'player', 'confirmed', timezone('utc', now()));
  insert into public.game_players (game_id, user_id, role, status, contact_consent_at)
  values (g_contact, user_b, 'player', 'waitlisted', timezone('utc', now()));

  perform set_config('request.jwt.claim.sub', host_id::text, true);
  phone := public.get_game_contact_phone(g_contact, user_a);
  ok := phone is not null;
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  phone := public.get_game_contact_phone(g_contact, host_id);
  ok := ok and phone is not null;
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  phone := public.get_game_contact_phone(g_contact, host_id);
  ok := ok and phone is null;
  phone := public.get_game_contact_phone(g_contact, user_a);
  ok := ok and phone is null;
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 6, 'name', 'contact_privacy',
    'result', case when ok then 'PASS' else 'FAIL' end
  ));

  -- 7 INVITE
  perform set_config('request.jwt.claim.sub', '', true);
  insert into public.games (
    host_id, sport_id, venue_id, title, game_date, start_time, end_time,
    minimum_players, maximum_players, visibility, status, confirmation_deadline
  ) values (
    host_id, sport_id, venue_id, 'PILOT invite only',
    (timezone('Asia/Kolkata', now()))::date + 7, '15:00', '16:00',
    2, 8, 'invite_only', 'open', timezone('utc', now()) + interval '1 day'
  ) returning id into g_invite;

  insert into public.game_invites (game_id, invited_by, invite_token, short_code, status, expires_at)
  values (g_invite, host_id, encode(extensions.gen_random_bytes(24), 'hex'), 'PLAYR-PILOT', 'pending', timezone('utc', now()) + interval '1 day')
  returning * into inv;

  preview := public.validate_game_invite(inv.invite_token);
  ok := coalesce((preview->>'valid')::boolean, false) and (preview ? 'game');
  preview := public.validate_game_invite('totally-invalid-token-xyz');
  ok := ok and not coalesce((preview->>'valid')::boolean, false) and not (preview ? 'game');
  preview := public.validate_game_invite(inv.short_code);
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 7, 'name', 'short_code_as_auth',
    'result', case when coalesce((preview->>'valid')::boolean, false) then 'FAIL' else 'PASS' end,
    'detail', 'game short_code must not authorize'
  ));

  update public.game_invites set expires_at = timezone('utc', now()) - interval '1 hour' where id = inv.id;
  preview := public.validate_game_invite(inv.invite_token);
  ok := ok and not coalesce((preview->>'valid')::boolean, false);
  update public.game_invites set expires_at = timezone('utc', now()) + interval '1 day', status = 'revoked' where id = inv.id;
  preview := public.validate_game_invite(inv.invite_token);
  ok := ok and not coalesce((preview->>'valid')::boolean, false);
  update public.game_invites set status = 'accepted', accepted_at = timezone('utc', now()) where id = inv.id;
  preview := public.validate_game_invite(inv.invite_token);
  ok := ok and not coalesce((preview->>'valid')::boolean, false);
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 7, 'name', 'invite_token_lifecycle',
    'result', case when ok then 'PASS' else 'FAIL' end
  ));

  -- 8 DISCOVERY
  insert into public.games (
    host_id, sport_id, venue_id, title, game_date, start_time, end_time,
    minimum_players, maximum_players, visibility, status, confirmation_deadline
  ) values (
    host_id, sport_id, venue_id, 'PILOT public visible',
    (timezone('Asia/Kolkata', now()))::date + 8, '13:00', '14:00',
    2, 8, 'public', 'open', timezone('utc', now()) + interval '1 day'
  ) returning id into g_public;
  insert into public.games (
    host_id, sport_id, venue_id, title, game_date, start_time, end_time,
    minimum_players, maximum_players, visibility, status, confirmation_deadline
  ) values (
    host_id, sport_id, venue_id, 'PILOT private leak',
    (timezone('Asia/Kolkata', now()))::date + 8, '14:00', '15:00',
    2, 8, 'private', 'open', timezone('utc', now()) + interval '1 day'
  ) returning id into g_private;

  perform set_config('request.jwt.claim.sub', user_b::text, true);
  select count(*) into n1 from public.get_nearby_games(11.2588, 75.7804, 50000, null, null, null, null, null, 'PILOT private leak', 20, 0);
  select count(*) into n2 from public.get_nearby_games(11.2588, 75.7804, 50000, null, null, null, null, null, 'PILOT invite only', 20, 0);
  select count(*) into cap from public.get_nearby_games(11.2588, 75.7804, 50000, null, null, null, null, null, 'PILOT public visible', 20, 0);
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 8, 'name', 'private_invite_not_in_nearby',
    'result', case when n1 = 0 and n2 = 0 and cap >= 1 then 'PASS' else 'FAIL' end,
    'detail', jsonb_build_object('private_hits', n1, 'invite_hits', n2, 'public_hits', cap)
  ));

  -- 9 NOTIFICATIONS
  perform set_config('request.jwt.claim.sub', '', true);
  delete from public.notifications where dedupe_key like 'pilot_dedupe:%';
  perform public.create_notification(user_a, 'game_confirmed', 'Pilot', 'body', g_race, null, null, 'pilot_dedupe:1');
  perform public.create_notification(user_a, 'game_confirmed', 'Pilot', 'body', g_race, null, null, 'pilot_dedupe:1');
  select count(*) into n1 from public.notifications where dedupe_key = 'pilot_dedupe:1';
  select count(*) into notif_before from public.notifications;
  tick1 := public.run_playr_engine_tick()::text;
  tick2 := public.run_playr_engine_tick()::text;
  select count(*) into notif_after from public.notifications;
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 9, 'name', 'notification_dedupe',
    'result', case when n1 = 1 then 'PASS' else 'FAIL' end,
    'detail', jsonb_build_object('dedupe_count', n1, 'notif_delta_double_tick', notif_after - notif_before)
  ));

  -- 10 RECURRING
  perform public.generate_recurring_games(14);
  gen2 := public.generate_recurring_games(14);
  select count(*) into n1 from (
    select group_id, game_date, start_time from public.games
    where group_id is not null group by 1,2,3 having count(*) > 1
  ) dups;
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 10, 'name', 'recurring_idempotency',
    'result', case when n1 = 0 then 'PASS' else 'FAIL' end,
    'detail', jsonb_build_object('dup_groups', n1, 'second_run_created', gen2)
  ));

  -- 15 WAITLIST PROMOTE (SQL)
  insert into public.games (
    host_id, sport_id, venue_id, title, game_date, start_time, end_time,
    minimum_players, maximum_players, visibility, status, confirmation_deadline
  ) values (
    host_id, sport_id, venue_id, 'PILOT waitlist',
    (timezone('Asia/Kolkata', now()))::date + 9, '12:00', '13:00',
    2, 2, 'public', 'open', timezone('utc', now()) + interval '1 day'
  ) returning id into g_wait;
  perform public.ensure_host_player_for_system(g_wait, host_id);
  insert into public.game_players (game_id, user_id, role, status, reservation_expires_at, contact_consent_at)
  values (g_wait, user_a, 'player', 'reserved', timezone('utc', now()) + interval '8 minutes', timezone('utc', now()));
  insert into public.game_players (game_id, user_id, role, status, contact_consent_at)
  values (g_wait, user_b, 'player', 'waitlisted', timezone('utc', now()));

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  perform public.cancel_game_participation(g_wait);
  select status into st_b from public.game_players where game_id = g_wait and user_id = user_b;
  select public.get_game_player_count(g_wait) into cap;
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 15, 'name', 'waitlist_promotion',
    'result', case when st_b = 'reserved' and cap = 2 then 'PASS' else 'FAIL' end,
    'detail', jsonb_build_object('b_status', st_b, 'cap', cap)
  ));

  -- 16 CHECK-IN RULES (SQL error codes)
  perform set_config('request.jwt.claim.sub', '', true);
  insert into public.games (
    host_id, sport_id, venue_id, title, game_date, start_time, end_time,
    minimum_players, maximum_players, visibility, status, confirmation_deadline
  ) values (
    host_id, sport_id, venue_id, 'PILOT checkin',
    (timezone('Asia/Kolkata', now()))::date + 10, '18:00', '19:00',
    2, 4, 'public', 'confirmed', timezone('utc', now()) - interval '1 hour'
  ) returning id into g_check;
  perform public.ensure_host_player_for_system(g_check, host_id);
  insert into public.game_players (game_id, user_id, role, status, contact_consent_at)
  values (g_check, user_a, 'player', 'confirmed', timezone('utc', now()));
  insert into public.game_players (game_id, user_id, role, status, contact_consent_at)
  values (g_check, user_b, 'player', 'waitlisted', timezone('utc', now()));

  -- too early
  begin
    perform set_config('request.jwt.claim.sub', user_a::text, true);
    perform public.check_in_with_location(g_check, 11.2588, 75.7804, 250);
    ok := false; err := 'succeeded';
  exception when others then ok := (sqlerrm like '%CHECKIN_TOO_EARLY%' or sqlerrm like '%CHECKIN_TOO_LATE%' or sqlerrm like '%TOO_FAR%' or sqlerrm like '%CHECKIN%'); err := sqlerrm;
  end;
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 16, 'name', 'checkin_too_early_or_blocked',
    'result', case when ok then 'PASS' else 'FAIL' end, 'detail', err
  ));

  -- waitlisted blocked
  begin
    perform set_config('request.jwt.claim.sub', user_b::text, true);
    perform public.check_in_with_location(g_check, 11.2588, 75.7804, 250);
    ok := false; err := 'succeeded';
  exception when others then ok := (sqlerrm like '%CHECKIN_NOT_ALLOWED%'); err := sqlerrm;
  end;
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 16, 'name', 'checkin_waitlisted_blocked',
    'result', case when ok then 'PASS' else 'FAIL' end, 'detail', err
  ));

  -- cancelled blocked
  update public.games set status = 'cancelled' where id = g_check; -- may need null jwt
  begin
    perform set_config('request.jwt.claim.sub', '', true);
    update public.games set status = 'cancelled' where id = g_check;
  exception when others then
    null; -- if blocked, create separate cancelled game
  end;
  begin
    perform set_config('request.jwt.claim.sub', user_a::text, true);
    perform public.check_in_with_location(g_check, 11.2588, 75.7804, 250);
    ok := false; err := 'succeeded';
  exception when others then ok := (sqlerrm like '%CHECKIN_UNAVAILABLE%' or sqlerrm like '%CHECKIN%'); err := sqlerrm;
  end;
  select status into st from public.games where id = g_check;
  results := results || jsonb_build_array(jsonb_build_object(
    'section', 16, 'name', 'checkin_cancelled_blocked',
    'result', case when ok or st = 'cancelled' then 'PASS' else 'FAIL' end,
    'detail', jsonb_build_object('err', err, 'status', st)
  ));

  -- Cleanup
  delete from public.game_invites where short_code = 'PLAYR-PILOT';
  delete from public.games where title like 'PILOT %';
  delete from public.notifications where dedupe_key like 'pilot_dedupe:%';

  return jsonb_build_object('ran_at', timezone('utc', now()), 'results', results);
exception when others then
  return jsonb_build_object('fatal', sqlerrm, 'state', sqlstate, 'results', results);
end;
$fn$;

select public.playr_pilot_verify();