-- Location-based discovery with PostGIS
-- Keeps lat/lng columns for UI compatibility; adds geography for efficient queries

create extension if not exists postgis;

-- Geography point on venues (WGS84)
alter table public.venues
  add column if not exists location geography(Point, 4326);

-- Backfill from existing lat/lng
update public.venues
set location = st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
where latitude is not null
  and longitude is not null
  and location is null;

create index if not exists venues_location_gix
  on public.venues
  using gist (location);

-- Keep location in sync when lat/lng change
create or replace function public.venues_sync_location()
returns trigger
language plpgsql
as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  else
    new.location := null;
  end if;
  return new;
end;
$$;

drop trigger if exists venues_sync_location on public.venues;
create trigger venues_sync_location
before insert or update of latitude, longitude
on public.venues
for each row execute function public.venues_sync_location();

-- ---------------------------------------------------------------------------
-- get_nearby_venues
-- ---------------------------------------------------------------------------

create or replace function public.get_nearby_venues(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision default 10000,
  p_limit integer default 20,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  id uuid,
  name text,
  description text,
  address text,
  city text,
  state text,
  country text,
  latitude double precision,
  longitude double precision,
  status public.venue_status,
  sports jsonb,
  facilities jsonb,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography as geog
  )
  select
    v.id,
    v.name,
    v.description,
    v.address,
    v.city,
    v.state,
    v.country,
    v.latitude,
    v.longitude,
    v.status,
    v.sports,
    v.facilities,
    st_distance(v.location, origin.geog) as distance_meters
  from public.venues v
  cross join origin
  where v.location is not null
    and (
      v.status in ('community_added', 'verified')
      or v.created_by = auth.uid()
    )
    and st_dwithin(v.location, origin.geog, p_radius_meters)
    and (
      p_search is null
      or length(trim(p_search)) = 0
      or v.name ilike '%' || trim(p_search) || '%'
      or coalesce(v.city, '') ilike '%' || trim(p_search) || '%'
      or coalesce(v.address, '') ilike '%' || trim(p_search) || '%'
    )
  order by distance_meters asc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- ---------------------------------------------------------------------------
-- get_nearby_games
-- Public discovery only: open/confirmed + public visibility
-- Never returns phone numbers or player precise locations
-- ---------------------------------------------------------------------------

create or replace function public.get_nearby_games(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision default 10000,
  p_sport_id uuid default null,
  p_game_date date default null,
  p_date_from date default null,
  p_date_to date default null,
  p_time_bucket text default null, -- morning | afternoon | evening | any
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
    group by gp.game_id
  )
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
    v.name as venue_name,
    v.city as venue_city,
    v.address as venue_address,
    v.status as venue_status,
    v.latitude as venue_latitude,
    v.longitude as venue_longitude,
    s.name as sport_name,
    s.slug as sport_slug,
    s.icon as sport_icon,
    p.display_name as host_display_name,
    p.username as host_username,
    p.avatar_url as host_avatar_url,
    coalesce(c.confirmed_count, 0) as confirmed_count,
    coalesce(c.waitlist_count, 0) as waitlist_count,
    st_distance(v.location, origin.geog) as distance_meters
  from public.games g
  join public.venues v on v.id = g.venue_id
  join public.sports s on s.id = g.sport_id
  left join public.profiles p on p.id = g.host_id
  left join capacity c on c.game_id = g.id
  cross join origin
  where g.visibility = 'public'
    and g.status in ('open', 'confirmed')
    and v.location is not null
    and st_dwithin(v.location, origin.geog, p_radius_meters)
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
    and (
      p_search is null
      or length(trim(p_search)) = 0
      or g.title ilike '%' || trim(p_search) || '%'
      or v.name ilike '%' || trim(p_search) || '%'
      or s.name ilike '%' || trim(p_search) || '%'
    )
  order by
    case when g.status = 'open' then 0 else 1 end,
    distance_meters asc,
    g.game_date asc,
    g.start_time asc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.get_nearby_venues(double precision, double precision, double precision, integer, integer, text)
  to authenticated, anon;
grant execute on function public.get_nearby_games(
  double precision, double precision, double precision, uuid, date, date, date, text, text, integer, integer
) to authenticated, anon;

-- India seed cities (centroids for manual area selection — not user tracking)
create table if not exists public.discovery_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text,
  country text not null default 'India',
  latitude double precision not null,
  longitude double precision not null,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists discovery_areas_active_idx on public.discovery_areas (is_active, sort_order);

alter table public.discovery_areas enable row level security;

create policy discovery_areas_select
on public.discovery_areas for select
to anon, authenticated
using (is_active = true);

grant select on table public.discovery_areas to anon, authenticated;

insert into public.discovery_areas (name, state, latitude, longitude, sort_order) values
  ('Kozhikode', 'Kerala', 11.2588, 75.7804, 10),
  ('Kannur', 'Kerala', 11.8745, 75.3704, 20),
  ('Kochi', 'Kerala', 9.9312, 76.2673, 30),
  ('Thiruvananthapuram', 'Kerala', 8.5241, 76.9366, 40),
  ('Thrissur', 'Kerala', 10.5276, 76.2144, 50),
  ('Bengaluru', 'Karnataka', 12.9716, 77.5946, 60),
  ('Chennai', 'Tamil Nadu', 13.0827, 80.2707, 70),
  ('Hyderabad', 'Telangana', 17.3850, 78.4867, 80),
  ('Mumbai', 'Maharashtra', 19.0760, 72.8777, 90),
  ('Pune', 'Maharashtra', 18.5204, 73.8567, 100),
  ('Delhi', 'Delhi', 28.6139, 77.2090, 110),
  ('Ahmedabad', 'Gujarat', 23.0225, 72.5714, 120)
on conflict do nothing;

-- Ensure seed venues have coordinates (already set in earlier seed)
update public.venues
set location = st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
where latitude is not null and longitude is not null;
