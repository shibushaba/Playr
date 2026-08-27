-- PLAYR performance: evidence-based indexes + discovery RPC scope fix
-- Audit: remote EXPLAIN on engine tick paths, discovery, notifications, chat, my games.
-- Does NOT change game-engine semantics, RLS, or RPC contracts (get_nearby_games return shape unchanged).

-- ---------------------------------------------------------------------------
-- 1. Remove exact duplicate partial index (same table, columns, predicate)
--    notifications_user_unread_idx ≡ notifications_user_unread_partial_idx
--    Keep _partial_idx (added in hardening migration); drop the older duplicate.
-- ---------------------------------------------------------------------------

drop index if exists public.notifications_user_unread_idx;

-- ---------------------------------------------------------------------------
-- 2. Engine tick: expired reservations
--    Query: cleanup_expired_reservations / expire_reservations_for_game
--    EXPLAIN (remote, 16 rows): Seq Scan on game_players filtering status + expires_at
-- ---------------------------------------------------------------------------

create index if not exists idx_game_players_reserved_expires
  on public.game_players (reservation_expires_at)
  where status = 'reserved' and reservation_expires_at is not null;

-- ---------------------------------------------------------------------------
-- 3. Engine tick: open games past confirmation deadline
--    Query: process_open_game_confirmations
--    EXPLAIN (remote): Seq Scan on games WHERE status='open' AND deadline <= now()
-- ---------------------------------------------------------------------------

create index if not exists idx_games_open_confirmation_deadline
  on public.games (confirmation_deadline)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- 4. Engine tick: lifecycle + reminders scan confirmed/live games by schedule
--    Query: process_game_lifecycle, process_game_reminders (status = 'confirmed')
--    EXPLAIN (remote): Seq Scan on games WHERE status = 'confirmed'
-- ---------------------------------------------------------------------------

create index if not exists idx_games_confirmed_live_schedule
  on public.games (game_date, start_time)
  where status in ('confirmed', 'live');

-- ---------------------------------------------------------------------------
-- 5. My Games / participation lookups
--    Query: listMyGames, participationForGames — user_id + status IN (...)
--    EXPLAIN (remote): Seq Scan on game_players
-- ---------------------------------------------------------------------------

create index if not exists idx_game_players_user_active_status
  on public.game_players (user_id, status)
  where status in ('confirmed', 'reserved', 'waitlisted', 'attended');

-- ---------------------------------------------------------------------------
-- 6. Discovery: venue → games join (missing FK support on games.venue_id)
--    Query: get_nearby_games join on g.venue_id after PostGIS venue filter
--    EXPLAIN (remote): nested loop games → venues; no index on games.venue_id
-- ---------------------------------------------------------------------------

create index if not exists idx_games_venue_public_active
  on public.games (venue_id, game_date, start_time)
  where visibility = 'public'
    and status in ('open', 'confirmed')
    and venue_id is not null;

-- ---------------------------------------------------------------------------
-- 7. Discovery RPC: scope capacity aggregation to nearby candidates only
--    Before: capacity CTE grouped ALL game_players (~44ms overhead at 16 rows;
--            scales linearly with total participation).
--    After: aggregate only game_players for games at nearby venues.
--    Return type and filters unchanged.
-- ---------------------------------------------------------------------------

create or replace function public.get_nearby_games(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision default 10000,
  p_sport_id uuid default null,
  p_game_date date default null,
  p_date_from date default null,
  p_date_to date default null,
  p_time_bucket text default null,
  p_search text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  description text,
  host_id uuid,
  group_id uuid,
  sport_id uuid,
  venue_id uuid,
  game_date date,
  start_time time,
  end_time time,
  minimum_players integer,
  maximum_players integer,
  player_share numeric,
  visibility public.game_visibility,
  status public.game_status,
  confirmation_deadline timestamptz,
  venue_name text,
  venue_city text,
  venue_address text,
  venue_status public.venue_status,
  venue_latitude double precision,
  venue_longitude double precision,
  sport_name text,
  sport_slug text,
  sport_icon text,
  host_display_name text,
  host_username text,
  host_avatar_url text,
  confirmed_count integer,
  waitlist_count integer,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography as geog
  ),
  nearby_venues as (
    select
      v.id,
      v.name,
      v.city,
      v.address,
      v.status,
      v.latitude,
      v.longitude,
      v.location,
      st_distance(v.location, origin.geog) as distance_meters
    from public.venues v
    cross join origin
    where v.location is not null
      and st_dwithin(v.location, origin.geog, p_radius_meters)
  ),
  candidates as (
    select
      g.id,
      g.title,
      g.description,
      g.host_id,
      g.group_id,
      g.sport_id,
      g.venue_id,
      g.game_date,
      g.start_time,
      g.end_time,
      g.minimum_players,
      g.maximum_players,
      g.player_share,
      g.visibility,
      g.status,
      g.confirmation_deadline,
      nv.name as venue_name,
      nv.city as venue_city,
      nv.address as venue_address,
      nv.status as venue_status,
      nv.latitude as venue_latitude,
      nv.longitude as venue_longitude,
      nv.distance_meters,
      rg.auto_open_missing_spots
    from public.games g
    join nearby_venues nv on nv.id = g.venue_id
    left join public.recurring_groups rg on rg.id = g.group_id
    where g.visibility = 'public'
      and g.status in ('open', 'confirmed')
      and (g.member_priority_until is null or g.member_priority_until <= timezone('utc', now()))
      and (p_sport_id is null or g.sport_id = p_sport_id)
      and (p_game_date is null or g.game_date = p_game_date)
      and (p_date_from is null or g.game_date >= p_date_from)
      and (p_date_to is null or g.game_date <= p_date_to)
      and (
        p_time_bucket is null
        or p_time_bucket = 'any'
        or (p_time_bucket = 'morning' and g.start_time >= time '05:00' and g.start_time < time '12:00')
        or (p_time_bucket = 'afternoon' and g.start_time >= time '12:00' and g.start_time < time '17:00')
        or (p_time_bucket = 'evening' and g.start_time >= time '17:00')
      )
  ),
  capacity as (
    select
      gp.game_id,
      count(*) filter (
        where gp.status in ('confirmed', 'attended')
           or (
             gp.status = 'reserved'
             and gp.reservation_expires_at is not null
             and gp.reservation_expires_at > timezone('utc', now())
           )
      )::integer as confirmed_count,
      count(*) filter (where gp.status = 'waitlisted')::integer as waitlist_count
    from public.game_players gp
    where gp.game_id in (select c.id from candidates c)
    group by gp.game_id
  )
  select
    c.id,
    c.title,
    c.description,
    c.host_id,
    c.group_id,
    c.sport_id,
    c.venue_id,
    c.game_date,
    c.start_time,
    c.end_time,
    c.minimum_players,
    c.maximum_players,
    c.player_share,
    c.visibility,
    c.status,
    c.confirmation_deadline,
    c.venue_name,
    c.venue_city,
    c.venue_address,
    c.venue_status,
    c.venue_latitude,
    c.venue_longitude,
    s.name as sport_name,
    s.slug as sport_slug,
    s.icon as sport_icon,
    p.display_name as host_display_name,
    p.username as host_username,
    p.avatar_url as host_avatar_url,
    coalesce(cap.confirmed_count, 0) as confirmed_count,
    coalesce(cap.waitlist_count, 0) as waitlist_count,
    c.distance_meters
  from candidates c
  join public.sports s on s.id = c.sport_id
  left join public.profiles p on p.id = c.host_id
  left join capacity cap on cap.game_id = c.id
  where (
      c.group_id is null
      or c.auto_open_missing_spots is not true
      or coalesce(cap.confirmed_count, 0) < c.maximum_players
    )
    and (
      p_search is null
      or length(trim(p_search)) = 0
      or c.title ilike '%' || trim(p_search) || '%'
      or c.venue_name ilike '%' || trim(p_search) || '%'
      or s.name ilike '%' || trim(p_search) || '%'
    )
  order by
    case when c.status = 'open' then 0 else 1 end,
    c.distance_meters asc,
    c.game_date asc,
    c.start_time asc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.get_nearby_games(
  double precision,
  double precision,
  double precision,
  uuid,
  date,
  date,
  date,
  text,
  text,
  integer,
  integer
) to anon, authenticated;
