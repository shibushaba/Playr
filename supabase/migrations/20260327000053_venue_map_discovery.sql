-- Venue map location + discovery areas from real data

-- ---------------------------------------------------------------------------
-- map_url column (nullable for legacy venues; required for new creates via RPC)
-- ---------------------------------------------------------------------------

alter table public.venues
  add column if not exists map_url text;

alter table public.venues
  drop constraint if exists venues_lat_range;
alter table public.venues
  add constraint venues_lat_range check (
    latitude is null or (latitude >= -90 and latitude <= 90)
  );

alter table public.venues
  drop constraint if exists venues_lng_range;
alter table public.venues
  add constraint venues_lng_range check (
    longitude is null or (longitude >= -180 and longitude <= 180)
  );

-- Column grants: include map_url (phone still omitted)
revoke select on table public.venues from anon;
revoke select on table public.venues from authenticated;

grant select (
  id, name, description, address, city, state, country,
  latitude, longitude, location, map_url, sports, facilities, opening_hours,
  website, image_url, status, created_by, claimed_by, created_at, updated_at
) on table public.venues to anon;

grant select (
  id, name, description, address, city, state, country,
  latitude, longitude, location, map_url, sports, facilities, opening_hours,
  website, image_url, status, created_by, claimed_by, created_at, updated_at
) on table public.venues to authenticated;

grant update (
  name, description, address, city, state, country,
  latitude, longitude, map_url, sports, facilities, opening_hours,
  phone, website, image_url, status, updated_at
) on table public.venues to authenticated;

grant insert on table public.venues to authenticated;

-- ---------------------------------------------------------------------------
-- create_venue — validated insert (map location required)
-- ---------------------------------------------------------------------------

create or replace function public.create_venue(
  p_name text,
  p_latitude double precision,
  p_longitude double precision,
  p_map_url text,
  p_address text default null,
  p_city text default null,
  p_state text default null,
  p_country text default 'India',
  p_sports jsonb default '[]'::jsonb,
  p_description text default null,
  p_force_create boolean default false
)
returns public.venues
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  url text;
  row_out public.venues;
  similar_count integer;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    perform public.raise_playr_error('INVALID_VENUE', 'Enter a venue name.');
  end if;

  if p_latitude is null or p_longitude is null then
    perform public.raise_playr_error('MAP_LOCATION_REQUIRED', 'Select the venue location on the map.');
  end if;

  if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    perform public.raise_playr_error('INVALID_COORDINATES', 'Map coordinates are invalid.');
  end if;

  if p_city is null or length(trim(p_city)) = 0 then
    perform public.raise_playr_error('INVALID_VENUE', 'City or area is required.');
  end if;

  url := trim(coalesce(p_map_url, ''));
  if length(url) = 0 then
    perform public.raise_playr_error('MAP_URL_REQUIRED', 'Map location is required.');
  end if;

  if url !~* '^https?://' then
    perform public.raise_playr_error('INVALID_MAP_URL', 'Map link must be an http(s) URL.');
  end if;

  if url ~* '^(javascript|data|file|vbscript):' then
    perform public.raise_playr_error('INVALID_MAP_URL', 'Map link is not allowed.');
  end if;

  if not coalesce(p_force_create, false) then
    select count(*) into similar_count
    from public.venues v
    where v.location is not null
      and st_dwithin(
        v.location,
        st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
        80
      )
      and lower(trim(v.name)) = lower(trim(p_name));

    if similar_count > 0 then
      perform public.raise_playr_error(
        'SIMILAR_VENUE_EXISTS',
        'A similar venue already exists nearby.'
      );
    end if;
  end if;

  insert into public.venues (
    name, description, address, city, state, country,
    latitude, longitude, map_url, sports, status, created_by
  ) values (
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    trim(p_city),
    nullif(trim(coalesce(p_state, '')), ''),
    coalesce(nullif(trim(p_country), ''), 'India'),
    p_latitude,
    p_longitude,
    url,
    coalesce(p_sports, '[]'::jsonb),
    'community_added',
    uid
  )
  returning * into row_out;

  return row_out;
end;
$$;

grant execute on function public.create_venue(
  text, double precision, double precision, text, text, text, text, text, jsonb, text, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- find_similar_venues — soft duplicate warning (~80 m)
-- ---------------------------------------------------------------------------

create or replace function public.find_similar_venues(
  p_latitude double precision,
  p_longitude double precision,
  p_name text default null,
  p_radius_meters double precision default 80
)
returns table (
  id uuid,
  name text,
  address text,
  city text,
  distance_meters double precision,
  map_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.name,
    v.address,
    v.city,
    st_distance(
      v.location,
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography
    ) as distance_meters,
    v.map_url
  from public.venues v
  where v.location is not null
    and p_latitude is not null
    and p_longitude is not null
    and (
      v.status in ('community_added', 'verified')
      or v.created_by = auth.uid()
    )
    and st_dwithin(
      v.location,
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
      greatest(20, least(coalesce(p_radius_meters, 80), 150))
    )
    and (
      p_name is null
      or length(trim(p_name)) = 0
      or lower(v.name) like '%' || lower(trim(p_name)) || '%'
      or lower(trim(p_name)) like '%' || lower(left(v.name, 24)) || '%'
    )
  order by distance_meters asc
  limit 5;
$$;

grant execute on function public.find_similar_venues(
  double precision, double precision, text, double precision
) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- get_available_discovery_areas — only cities with games or venues
-- ---------------------------------------------------------------------------

create or replace function public.get_available_discovery_areas()
returns table (
  id text,
  name text,
  state text,
  country text,
  latitude double precision,
  longitude double precision,
  game_count integer,
  venue_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with venue_cities as (
    select
      trim(v.city) as city,
      max(v.state) as state,
      max(v.country) as country,
      avg(v.latitude) filter (where v.latitude is not null) as latitude,
      avg(v.longitude) filter (where v.longitude is not null) as longitude,
      count(*)::integer as venue_count
    from public.venues v
    where v.city is not null
      and length(trim(v.city)) > 0
      and v.location is not null
      and v.status in ('community_added', 'verified')
    group by trim(v.city)
  ),
  game_cities as (
    select
      trim(v.city) as city,
      avg(v.latitude) filter (where v.latitude is not null) as latitude,
      avg(v.longitude) filter (where v.longitude is not null) as longitude,
      max(v.state) as state,
      max(v.country) as country,
      count(*)::integer as game_count
    from public.games g
    join public.venues v on v.id = g.venue_id
    where g.visibility = 'public'
      and g.status in ('open', 'confirmed', 'live')
      and v.city is not null
      and length(trim(v.city)) > 0
    group by trim(v.city)
  ),
  all_cities as (
    select city from venue_cities
    union
    select city from game_cities
  )
  select
    md5(lower(ac.city)) as id,
    ac.city as name,
    coalesce(vc.state, gc.state) as state,
    coalesce(vc.country, gc.country, 'India') as country,
    coalesce(vc.latitude, gc.latitude) as latitude,
    coalesce(vc.longitude, gc.longitude) as longitude,
    coalesce(gc.game_count, 0) as game_count,
    coalesce(vc.venue_count, 0) as venue_count
  from all_cities ac
  left join venue_cities vc on vc.city = ac.city
  left join game_cities gc on gc.city = ac.city
  where coalesce(gc.game_count, 0) > 0 or coalesce(vc.venue_count, 0) > 0
  order by coalesce(gc.game_count, 0) desc, coalesce(vc.venue_count, 0) desc, ac.city asc;
$$;

grant execute on function public.get_available_discovery_areas() to anon, authenticated;

-- Include map_url on nearby venue discovery (must drop — OUT row type changed)
drop function if exists public.get_nearby_venues(
  double precision, double precision, double precision, integer, integer, text
);

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
  map_url text,
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
    v.map_url,
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

grant execute on function public.get_nearby_venues(
  double precision, double precision, double precision, integer, integer, text
) to anon, authenticated;
