-- 101% hardening: race-safe join_game, recurring occurrences as draft (host confirms each)

-- ---------------------------------------------------------------------------
-- 1. join_game — atomic reserve with expiry sweep + post-insert capacity check
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
  consent_at timestamptz;
  capacity integer;
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

  if g.status = 'cancelled' then
    raise exception 'GAME_CANCELLED' using errcode = 'P0001';
  end if;

  if g.status = 'confirmed' then
    raise exception 'GAME_CONFIRMED' using errcode = 'P0001';
  end if;

  if g.status in ('live', 'completed', 'draft') then
    raise exception 'GAME_CLOSED' using errcode = 'P0001';
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

  perform public.expire_reservations_for_game(p_game_id);

  if exists (
    select 1
    from public.game_players gp
    where gp.game_id = p_game_id
      and gp.user_id = uid
      and gp.status in ('reserved', 'confirmed', 'waitlisted', 'attended', 'no_show')
  ) then
    raise exception 'ALREADY_JOINED' using errcode = 'P0001';
  end if;

  capacity := public.get_game_player_count(p_game_id);
  if capacity >= g.maximum_players then
    raise exception 'GAME_FULL' using errcode = 'P0001';
  end if;

  expires_at := least(
    timezone('utc', now()) + interval '8 minutes',
    g.confirmation_deadline
  );
  consent_at := timezone('utc', now());

  insert into public.game_players (
    game_id, user_id, role, status, reservation_expires_at, contact_consent_at
  ) values (
    p_game_id, uid, 'player', 'reserved', expires_at, consent_at
  )
  returning * into row_out;

  if public.get_game_player_count(p_game_id) > g.maximum_players then
    delete from public.game_players where id = row_out.id;
    raise exception 'GAME_FULL' using errcode = 'P0001';
  end if;

  perform public.log_game_event(
    p_game_id,
    'player_reserved',
    uid,
    jsonb_build_object(
      'game_player_id', row_out.id,
      'reservation_expires_at', row_out.reservation_expires_at
    )
  );

  return row_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Recurring generation — draft occurrences; host confirms booking per game
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
  v_phone text;
  booking_ok boolean;
begin
  start_local := (timezone('Asia/Kolkata', now()))::date;
  end_local := start_local + greatest(1, coalesce(p_horizon_days, 14));

  for grp in
    select *
    from public.recurring_groups
    where is_active = true
  loop
    v_phone := null;
    booking_ok := false;

    if grp.venue_id is not null then
      select v.phone into v_phone
      from public.venues v
      where v.id = grp.venue_id;

      booking_ok := public.is_valid_e164(v_phone);
    end if;

    d := start_local;
    while d <= end_local loop
      if grp.ends_on is not null and d > grp.ends_on then
        exit;
      end if;

      if public.weekday_matches_config(d, grp.recurrence_type, grp.recurrence_config) then
        if grp.venue_id is null or not booking_ok then
          d := d + 1;
          continue;
        end if;

        end_time := (grp.start_time + make_interval(mins => grp.duration_minutes))::time;

        if grp.visibility = 'invite_only' then
          vis := 'invite_only'::public.game_visibility;
          priority_until := null;
        elsif grp.visibility = 'private' then
          vis := 'private'::public.game_visibility;
          priority_until := null;
        elsif grp.auto_open_missing_spots then
          vis := 'public'::public.game_visibility;
          if coalesce(grp.regular_member_priority_hours, 0) > 0 then
            priority_until := timezone('utc', now())
              + make_interval(hours => grp.regular_member_priority_hours);
          else
            priority_until := null;
          end if;
        else
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
          'draft',
          'pending',
          priority_until
        )
        on conflict (group_id, game_date, start_time) where group_id is not null
        do nothing
        returning id into new_game_id;

        if new_game_id is not null then
          perform public.ensure_host_player_for_system(new_game_id, grp.host_id);
          perform public.log_game_event(
            new_game_id,
            'recurring_occurrence_created',
            grp.host_id,
            jsonb_build_object(
              'source', 'recurring_group',
              'group_id', grp.id,
              'venue_id', grp.venue_id,
              'game_date', d,
              'start_time', grp.start_time,
              'end_time', end_time
            )
          );
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
-- 3. One-time cleanup: auto-opened recurring games with no player joins yet
-- ---------------------------------------------------------------------------

update public.games g
set
  status = 'draft',
  venue_confirmation = 'pending',
  venue_booking_confirmed_at = null,
  venue_booking_confirmed_by = null
where g.group_id is not null
  and g.status = 'open'
  and g.venue_booking_confirmed_at is not null
  and not exists (
    select 1
    from public.game_players gp
    where gp.game_id = g.id
      and gp.role = 'player'
      and gp.status in ('reserved', 'confirmed', 'attended')
  );
