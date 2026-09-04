-- Hosts can delete (cancel) a draft/open game until 3 hours before kickoff.
-- After confirmation_deadline, the listing stays — same lock as roster confirmation.

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
      if current_setting('playr.allow_status_publish', true) <> 'true' then
        perform public.raise_playr_error(
          'USE_PUBLISH_RPC',
          'Use publish to open the game.'
        );
      end if;
    elsif new.status = 'cancelled'
       and old.status in ('draft', 'open')
       and new.host_id = auth.uid() then
      if old.confirmation_deadline <= timezone('utc', now()) then
        perform public.raise_playr_error(
          'GAME_DELETE_CLOSED',
          'Games can''t be deleted within 3 hours of kickoff.'
        );
      end if;
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

create or replace function public.host_delete_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.games%rowtype;
  row_out public.games;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select * into g
  from public.games
  where id = p_game_id
  for update;

  if not found then
    perform public.raise_playr_error('GAME_NOT_FOUND', 'Game not found.');
  end if;

  if g.host_id is distinct from uid then
    perform public.raise_playr_error('FORBIDDEN', 'Only the host can delete this game.');
  end if;

  if g.status not in ('draft', 'open') then
    perform public.raise_playr_error(
      'GAME_DELETE_CLOSED',
      'This game can no longer be deleted.'
    );
  end if;

  if g.confirmation_deadline <= timezone('utc', now()) then
    perform public.raise_playr_error(
      'GAME_DELETE_CLOSED',
      'Games can''t be deleted within 3 hours of kickoff.'
    );
  end if;

  update public.games
  set status = 'cancelled'
  where id = g.id
    and status = g.status
  returning * into row_out;

  if not found then
    perform public.raise_playr_error(
      'GAME_DELETE_CLOSED',
      'This game can no longer be deleted.'
    );
  end if;

  perform public.log_game_event(
    g.id,
    'game_cancelled',
    uid,
    jsonb_build_object('reason', 'host_deleted', 'previous_status', g.status)
  );

  return row_out;
end;
$$;

grant execute on function public.host_delete_game(uuid) to authenticated;

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
        case
          when old.status in ('draft', 'open')
            and new.confirmation_deadline > timezone('utc', now())
          then coalesce(new.title, 'Your game') || ' was cancelled by the host.'
          else coalesce(new.title, 'Your game')
            || ' was cancelled because the minimum number of players wasn''t reached.'
        end,
        'game_cancelled'
      );
    end if;
  end if;
  return new;
end;
$$;
