-- Pilot fix: game invite short_code must not authorize or reveal game details.
-- Share links use invite_token; short_code remains display-only for games.
-- Group invites keep short_code matching (human code-entry UX on Group Details).

create or replace function public.validate_game_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  inv public.game_invites%rowtype;
  g public.games%rowtype;
  sport_name text;
  venue_name text;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('valid', false, 'reason', 'MISSING_TOKEN');
  end if;

  -- Token is the only authority (do not match short_code).
  select * into inv
  from public.game_invites
  where invite_token = trim(p_token);

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'NOT_FOUND');
  end if;

  if inv.status = 'revoked' then
    return jsonb_build_object('valid', false, 'reason', 'REVOKED');
  end if;

  if inv.status = 'expired'
     or (inv.expires_at is not null and inv.expires_at <= timezone('utc', now())) then
    return jsonb_build_object('valid', false, 'reason', 'EXPIRED', 'invite_id', inv.id);
  end if;

  if inv.status = 'accepted' then
    return jsonb_build_object(
      'valid', false,
      'reason', 'ALREADY_ACCEPTED',
      'invite_id', inv.id,
      'game_id', inv.game_id
    );
  end if;

  if inv.status = 'declined' then
    return jsonb_build_object('valid', false, 'reason', 'DECLINED');
  end if;

  if inv.status <> 'pending' then
    return jsonb_build_object('valid', false, 'reason', 'INVALID_STATUS');
  end if;

  select * into g from public.games where id = inv.game_id;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'GAME_NOT_FOUND');
  end if;

  select s.name into sport_name from public.sports s where s.id = g.sport_id;
  select v.name into venue_name from public.venues v where v.id = g.venue_id;

  return jsonb_build_object(
    'valid', true,
    'invite_id', inv.id,
    'short_code', inv.short_code,
    'expires_at', inv.expires_at,
    'game', jsonb_build_object(
      'id', g.id,
      'title', g.title,
      'game_date', g.game_date,
      'start_time', g.start_time,
      'end_time', g.end_time,
      'status', g.status,
      'visibility', g.visibility,
      'minimum_players', g.minimum_players,
      'maximum_players', g.maximum_players,
      'sport_name', sport_name,
      'venue_name', venue_name,
      'host_id', g.host_id,
      'group_id', g.group_id
    )
  );
end;
$$;
