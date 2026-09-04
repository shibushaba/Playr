-- Venue business phones are public booking contacts, not player personal numbers.
-- Discovery previously omitted `phone`, which hid turf numbers and blocked Host
-- on seeded venues (created_by is null, so get_venue_contact_phone was FORBIDDEN).

grant select (phone) on table public.venues to anon;
grant select (phone) on table public.venues to authenticated;

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
  phone text,
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
    v.phone,
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

create or replace function public.get_venue_contact_phone(p_venue_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  phone text;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select v.phone into phone
  from public.venues v
  where v.id = p_venue_id
    and (
      v.status in ('community_added', 'verified')
      or v.created_by = uid
    );

  return phone;
end;
$$;

grant execute on function public.get_venue_contact_phone(uuid) to authenticated;

notify pgrst, 'reload schema';
