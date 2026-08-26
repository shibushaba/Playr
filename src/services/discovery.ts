import { AppError, logDevError } from '@/lib/errors'
import { formatDistanceMeters } from '@/lib/location'
import { supabase } from '@/lib/supabase'
import type { DbGameStatus, VenueStatus } from '@/types/database'
import type { GameListItem, VenueRecord } from '@/types/domain'
import { combineGameStart, deriveUiStatus } from '@/types/domain'
import type { ManualArea } from '@/lib/location'

export interface NearbyQuery {
  latitude: number
  longitude: number
  radiusMeters?: number
  sportId?: string | null
  gameDate?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  timeBucket?: 'morning' | 'afternoon' | 'evening' | 'any' | null
  search?: string | null
  limit?: number
  offset?: number
}

type NearbyGameRow = {
  id: string
  title: string
  description: string | null
  host_id: string
  group_id: string | null
  sport_id: string
  venue_id: string | null
  game_date: string
  start_time: string
  end_time: string
  minimum_players: number
  maximum_players: number
  player_share: number | null
  visibility: GameListItem['visibility']
  status: DbGameStatus
  confirmation_deadline: string
  venue_name: string | null
  venue_city: string | null
  venue_address: string | null
  venue_status: VenueStatus | null
  venue_latitude: number | null
  venue_longitude: number | null
  sport_name: string
  sport_slug: string
  sport_icon: string | null
  host_display_name: string | null
  host_username: string | null
  host_avatar_url: string | null
  confirmed_count: number
  waitlist_count: number
  distance_meters: number
}

type NearbyVenueRow = {
  id: string
  name: string
  description: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  map_url?: string | null
  status: VenueStatus
  sports: unknown
  facilities: unknown
  distance_meters: number
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function mapNearbyGame(row: NearbyGameRow): GameListItem {
  const startsAt = combineGameStart(row.game_date, row.start_time)
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    hostId: row.host_id,
    groupId: row.group_id,
    sport: {
      id: row.sport_id,
      name: row.sport_name,
      slug: row.sport_slug,
      icon: row.sport_icon,
    },
    venue: row.venue_id
      ? {
          id: row.venue_id,
          name: row.venue_name ?? 'Venue',
          description: null,
          address: row.venue_address,
          city: row.venue_city,
          state: null,
          country: null,
          latitude: row.venue_latitude,
          longitude: row.venue_longitude,
          mapUrl: null,
          status: row.venue_status ?? 'pending',
          sports: [],
          facilities: [],
          distanceKm: row.distance_meters / 1000,
        }
      : null,
    host: {
      id: row.host_id,
      displayName: row.host_display_name?.trim() || 'Host',
      username: row.host_username,
      avatarUrl: row.host_avatar_url,
      bio: null,
    },
    gameDate: row.game_date,
    startTime: row.start_time,
    endTime: row.end_time,
    startsAt,
    confirmationDeadline: row.confirmation_deadline,
    minPlayers: row.minimum_players,
    maxPlayers: row.maximum_players,
    confirmedCount: row.confirmed_count,
    waitlistCount: row.waitlist_count,
    playerShareInr: row.player_share == null ? null : Number(row.player_share),
    visibility: row.visibility,
    status: deriveUiStatus(
      row.status,
      row.confirmed_count,
      row.maximum_players,
    ),
    dbStatus: row.status,
    venueBookingConfirmedAt: null,
    distanceMeters: row.distance_meters,
    distanceLabel: formatDistanceMeters(row.distance_meters),
  }
}

function mapNearbyVenue(row: NearbyVenueRow): VenueRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    mapUrl: row.map_url ?? null,
    status: row.status,
    sports: parseStringArray(row.sports),
    facilities: parseStringArray(row.facilities),
    distanceKm: row.distance_meters / 1000,
    distanceMeters: row.distance_meters,
    distanceLabel: formatDistanceMeters(row.distance_meters),
  }
}

export async function getNearbyGames(query: NearbyQuery): Promise<GameListItem[]> {
  const { data, error } = await supabase.rpc('get_nearby_games', {
    p_latitude: query.latitude,
    p_longitude: query.longitude,
    p_radius_meters: query.radiusMeters ?? 10_000,
    p_sport_id: query.sportId ?? undefined,
    p_game_date: query.gameDate ?? undefined,
    p_date_from: query.dateFrom ?? undefined,
    p_date_to: query.dateTo ?? undefined,
    p_time_bucket: query.timeBucket ?? undefined,
    p_search: query.search ?? undefined,
    p_limit: query.limit ?? 20,
    p_offset: query.offset ?? 0,
  })

  if (error) {
    logDevError('getNearbyGames', error)
    throw new AppError("Couldn't find nearby games.")
  }

  return ((data ?? []) as NearbyGameRow[]).map(mapNearbyGame)
}

export async function getNearbyVenues(query: {
  latitude: number
  longitude: number
  radiusMeters?: number
  search?: string | null
  limit?: number
  offset?: number
}): Promise<VenueRecord[]> {
  const { data, error } = await supabase.rpc('get_nearby_venues', {
    p_latitude: query.latitude,
    p_longitude: query.longitude,
    p_radius_meters: query.radiusMeters ?? 10_000,
    p_limit: query.limit ?? 20,
    p_offset: query.offset ?? 0,
    p_search: query.search ?? undefined,
  })

  if (error) {
    logDevError('getNearbyVenues', error)
    throw new AppError("Couldn't load venues.")
  }

  return ((data ?? []) as NearbyVenueRow[]).map(mapNearbyVenue)
}

export async function searchGames(
  query: NearbyQuery & { search: string },
): Promise<GameListItem[]> {
  return getNearbyGames(query)
}

export async function searchVenues(query: {
  latitude: number
  longitude: number
  radiusMeters?: number
  search: string
  limit?: number
}): Promise<VenueRecord[]> {
  return getNearbyVenues(query)
}

export async function listDiscoveryAreas(): Promise<ManualArea[]> {
  const { data, error } = await supabase.rpc('get_available_discovery_areas')

  if (error) {
    logDevError('listDiscoveryAreas', error)
    // Fallback: empty list (do not show hardcoded India-wide cities)
    return []
  }

  return ((data ?? []) as Array<{
    id: string
    name: string
    state: string | null
    country: string
    latitude: number
    longitude: number
    game_count: number
    venue_count: number
  }>)
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a) => ({
      id: a.id,
      name: a.name,
      state: a.state,
      country: a.country,
      latitude: a.latitude,
      longitude: a.longitude,
      gameCount: a.game_count,
      venueCount: a.venue_count,
    }))
}
