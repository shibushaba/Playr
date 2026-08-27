-- publish_game RPC was blocked by protect_game_mutations (draft→open always rejected).
-- Allow draft→open only when publish_game sets a transaction-local bypass flag.

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

  perform set_config('playr.allow_status_publish', 'true', true);

  update public.games
  set status = 'open',
      updated_at = timezone('utc', now())
  where id = p_game_id
  returning * into row_out;

  perform public.log_game_event(
    p_game_id,
    'game_created',
    uid,
    jsonb_build_object('published', true)
  );

  return row_out;
end;
$$;

revoke all on function public.publish_game(uuid) from public;
grant execute on function public.publish_game(uuid) to authenticated;
