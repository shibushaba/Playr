-- Master spec hardening: venue insert RPC-only, group phone gate, recurring booking

-- ---------------------------------------------------------------------------
-- 1. Venues: force create_venue RPC (no direct client INSERT)
-- ---------------------------------------------------------------------------

drop policy if exists venues_insert_auth on public.venues;

-- ---------------------------------------------------------------------------
-- 2. Pilot OTP exposure off by default
-- ---------------------------------------------------------------------------

update public.playr_settings
set value = coalesce(value, '{}'::jsonb)
  || jsonb_build_object('expose_phone_verification_codes', false)
where key = 'trust';

insert into public.playr_settings (key, value)
select 'trust', '{"expose_phone_verification_codes": false}'::jsonb
where not exists (select 1 from public.playr_settings where key = 'trust');

-- ---------------------------------------------------------------------------
-- 3. Recurring groups: verified phone required to create
-- ---------------------------------------------------------------------------

drop policy if exists groups_insert_host on public.recurring_groups;

create policy groups_insert_host
on public.recurring_groups for insert
to authenticated
with check (
  host_id = auth.uid()
  and public.profile_has_verified_phone(auth.uid())
);

-- ---------------------------------------------------------------------------
-- 4. Recurring game generation: venue phone + host-declared booking on open
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
          venue_booking_confirmed_at,
          venue_booking_confirmed_by,
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
          'confirmed',
          timezone('utc', now()),
          grp.host_id,
          priority_until
        )
        on conflict (group_id, game_date, start_time) where group_id is not null
        do nothing
        returning id into new_game_id;

        if new_game_id is not null then
          perform public.ensure_host_player_for_system(new_game_id, grp.host_id);
          perform public.log_game_event(
            new_game_id,
            'venue_booking_confirmed',
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
