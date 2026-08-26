import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { isSafeHttpUrl } from '@/lib/maps'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { VenueRecord } from '@/types/domain'
import { parseStringArray } from '@/types/domain'

/** Columns granted to clients — never use `*` (phone is restricted). */
export const venuePublicSelect =
  'id, name, description, address, city, state, country, latitude, longitude, map_url, sports, facilities, opening_hours, website, image_url, status, created_by, claimed_by, created_at, updated_at'

export interface SimilarVenue {
  id: string
  name: string
  address: string | null
  city: string | null
  distanceMeters: number
  mapUrl: string | null
}

function mapVenue(
  row: Tables<'venues'> | Record<string, unknown>,
  distanceKm?: number,
): VenueRecord {
  const r = row as Tables<'venues'> & { map_url?: string | null }
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    address: r.address,
    city: r.city,
    state: r.state,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
    mapUrl: r.map_url ?? null,
    status: r.status,
    sports: parseStringArray(r.sports),
    facilities: parseStringArray(r.facilities),
    distanceKm,
  }
}

export async function listVenues(options?: {
  city?: string
  includePendingOwn?: boolean
}): Promise<VenueRecord[]> {
  let query = supabase.from('venues').select(venuePublicSelect).order('name')

  if (options?.city) {
    query = query.eq('city', options.city)
  }

  const { data, error } = await query
  if (error) {
    logDevError('listVenues', error)
    throw new AppError("Couldn't load venues. Try again.")
  }

  return (data ?? []).map((v) => mapVenue(v))
}

export async function getVenue(id: string): Promise<VenueRecord | null> {
  const { data, error } = await supabase
    .from('venues')
    .select(venuePublicSelect)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    logDevError('getVenue', error)
    throw new AppError("Couldn't load venue. Try again.")
  }
  return data ? mapVenue(data) : null
}

export async function findSimilarVenues(input: {
  latitude: number
  longitude: number
  name?: string
  radiusMeters?: number
}): Promise<SimilarVenue[]> {
  const { data, error } = await supabase.rpc('find_similar_venues', {
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_name: input.name ?? undefined,
    p_radius_meters: input.radiusMeters ?? 80,
  })

  if (error) {
    logDevError('findSimilarVenues', error)
    return []
  }

  return ((data ?? []) as Array<{
    id: string
    name: string
    address: string | null
    city: string | null
    distance_meters: number
    map_url: string | null
  }>).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    distanceMeters: row.distance_meters,
    mapUrl: row.map_url,
  }))
}

export async function createVenue(input: {
  name: string
  latitude: number
  longitude: number
  mapUrl: string
  phone: string
  address?: string | null
  city: string
  state?: string | null
  country?: string
  sports?: string[]
  description?: string | null
  forceCreate?: boolean
}): Promise<VenueRecord> {
  if (!input.name.trim()) {
    throw new AppError('Enter a venue name.', 'INVALID_VENUE')
  }
  if (
    input.latitude == null ||
    input.longitude == null ||
    Number.isNaN(input.latitude) ||
    Number.isNaN(input.longitude)
  ) {
    throw new AppError(
      'Select the venue location on the map.',
      'MAP_LOCATION_REQUIRED',
    )
  }
  if (!input.mapUrl?.trim() || !isSafeHttpUrl(input.mapUrl)) {
    throw new AppError('Map location is required.', 'MAP_URL_REQUIRED')
  }
  if (!input.city?.trim()) {
    throw new AppError('City or area is required.', 'INVALID_VENUE')
  }

  const { data, error } = await supabase.rpc('create_venue', {
    p_name: input.name.trim(),
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_map_url: input.mapUrl.trim(),
    p_phone: input.phone.trim(),
    p_address: input.address ?? undefined,
    p_city: input.city.trim(),
    p_state: input.state ?? undefined,
    p_country: input.country ?? 'India',
    p_sports: input.sports ?? [],
    p_description: input.description ?? undefined,
    p_force_create: input.forceCreate ?? false,
  })

  if (error) {
    throw parsePlayrRpcError(error, "Couldn't create venue. Try again.")
  }

  if (!data) {
    throw new AppError("Couldn't create venue. Try again.")
  }

  return mapVenue(data as Tables<'venues'>)
}

/** @deprecated Prefer createVenue with map location */
export async function submitVenue(input: {
  name: string
  address: string
  city?: string
  state?: string
  notes?: string
  sports?: string[]
  latitude?: number
  longitude?: number
  mapUrl?: string
}): Promise<{ venueId: string; submissionId: string }> {
  if (
    input.latitude == null ||
    input.longitude == null ||
    !input.mapUrl
  ) {
    throw new AppError(
      'Select the venue location on the map.',
      'MAP_LOCATION_REQUIRED',
    )
  }

  const venue = await createVenue({
    name: input.name,
    address: input.address,
    city: input.city ?? 'Kozhikode',
    state: input.state ?? 'Kerala',
    sports: input.sports,
    description: input.notes,
    latitude: input.latitude,
    longitude: input.longitude,
    mapUrl: input.mapUrl,
    phone: '+910000000000',
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let submissionId = ''
  if (user) {
    const { data: submission } = await supabase
      .from('venue_submissions')
      .insert({
        submitted_by: user.id,
        venue_id: venue.id,
        name: input.name,
        address: input.address,
        notes: input.notes ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        status: 'pending',
      })
      .select('id')
      .maybeSingle()
    submissionId = submission?.id ?? ''
  }

  return { venueId: venue.id, submissionId }
}
