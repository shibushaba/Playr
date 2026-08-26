-- Ensure host is on the roster when a game is created
create or replace function public.ensure_host_player(p_game_id uuid)
returns public.game_players
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.games%rowtype;
  row_out public.game_players;
begin
  if uid is null then
    raise exception 'Please sign in.';
  end if;

  select * into g from public.games where id = p_game_id;
  if not found then
    raise exception 'Game not found.';
  end if;

  if g.host_id <> uid then
    raise exception 'Only the host can claim the host roster seat.';
  end if;

  select * into row_out
  from public.game_players
  where game_id = p_game_id and user_id = uid
  order by created_at desc
  limit 1;

  if found then
    update public.game_players
    set
      role = 'host',
      status = 'confirmed',
      reservation_expires_at = null,
      cancelled_at = null
    where id = row_out.id
    returning * into row_out;
  else
    insert into public.game_players (
      game_id, user_id, role, status, reservation_expires_at
    ) values (
      p_game_id, uid, 'host', 'confirmed', null
    )
    returning * into row_out;
  end if;

  return row_out;
end;
$$;

grant execute on function public.ensure_host_player(uuid) to authenticated;
