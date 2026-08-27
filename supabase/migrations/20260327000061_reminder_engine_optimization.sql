-- Semantics-preserving process_game_reminders: prefilter confirmed games to kickoff windows
-- before per-row reminder logic. Reservation-expiring path unchanged.

create or replace function public.process_game_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc', now());
  today_ist date := (timezone('Asia/Kolkata', now_utc))::date;
  r record;
  kickoff timestamptz;
  n_24h integer := 0;
  n_3h integer := 0;
  n_30m integer := 0;
  n_res integer := 0;
  title text;
  body text;
begin
  -- Only confirmed games whose kickoff falls in a reminder window (same OR logic as before).
  -- Conservative IST date bounds: 24h window needs at most today + 2 calendar days.
  for r in
    select g.*
    from public.games g
    where g.status = 'confirmed'
      and g.game_date >= today_ist
      and g.game_date <= today_ist + 2
      and (
        public.game_start_at(g.game_date, g.start_time)
          between now_utc + interval '23 hours 30 minutes'
              and now_utc + interval '24 hours 30 minutes'
        or public.game_start_at(g.game_date, g.start_time)
          between now_utc + interval '2 hours 45 minutes'
              and now_utc + interval '3 hours 15 minutes'
        or public.game_start_at(g.game_date, g.start_time)
          between now_utc + interval '25 minutes'
              and now_utc + interval '35 minutes'
      )
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

    if kickoff between now_utc + interval '2 hours 45 minutes'
                   and now_utc + interval '3 hours 15 minutes' then
      title := 'Game in 3 hours';
      body := coalesce(r.title, 'Your game') || ' starts in about 3 hours.';
      n_3h := n_3h + public.notify_game_participants(
        r.id, 'game_reminder_3h', title, body, 'game_reminder_3h'
      );
    end if;

    if kickoff between now_utc + interval '25 minutes'
                   and now_utc + interval '35 minutes' then
      title := 'Game starts soon';
      body := coalesce(r.title, 'Your game') || ' starts in about 30 minutes.';
      n_30m := n_30m + public.notify_game_participants(
        r.id, 'game_starting', title, body, 'game_starting'
      );
    end if;
  end loop;

  -- Reservation expiring in ~2 minutes (narrow 1.5–2.5 min) — unchanged
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

grant execute on function public.process_game_reminders() to service_role;
