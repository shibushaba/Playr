-- Allow logged-out discovery of public open/confirmed games (primary product path)
create policy games_select_anon_public
on public.games for select
to anon
using (
  visibility = 'public'
  and status in ('open', 'confirmed')
);

grant select on table public.games to anon;

create policy venues_select_anon_public
on public.venues for select
to anon
using (status in ('community_added', 'verified'));

grant select on table public.venues to anon;

-- Public sports already granted; allow anon to read sport joins used by games
-- (already have sports_select_anon)

-- Counts need game_players — expose only aggregate-safe info via RPC for anon.
-- For list UI counts, authenticated path uses game_players; for anon use get_game_player_count.
grant execute on function public.get_game_player_count(uuid) to anon;
