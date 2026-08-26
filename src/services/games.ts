import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type {
  DbGameStatus,
  GamePlayerRole,
  GamePlayerStatus,
  GameVisibility,
  Tables,
  TablesInsert,
} from '@/types/database'
import type {
  GameDetail,
  GameListItem,
  GameParticipant,
  PublicProfile,
  SportRecord,
  VenueRecord,
} from '@/types/domain'
import {
  combineGameStart,
  deriveUiStatus,
  parseStringArray,
  toPublicProfile,
} from '@/types/domain'

type GameJoin = Tables<'games'> & {
  sports: Pick<Tables<'sports'>, 'id' | 'name' | 'slug' | 'icon'> | null
  venues: Tables<'venues'> | null
  profiles: Pick<
    Tables<'profiles'>,
    'id' | 'display_name' | 'username' | 'avatar_url' | 'bio'
  > | null
}

function mapSport(
  row: Pick<Tables<'sports'>, 'id' | 'name' | 'slug' | 'icon'> | null,
): SportRecord {
  return {
    id: row?.id ?? '',
    name: row?.name ?? 'Sport',
    slug: row?.slug ?? 'sport',
    icon: row?.icon ?? null,
  }
}

function mapVenue(row: Tables<'venues'> | null): VenueRecord | null {
  if (!row) return null
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
  }
}

function mapListItem(
  row: GameJoin,
  confirmedCount: number,
  waitlistCount: number,
  myParticipation?: Pick<GameParticipant, 'role' | 'status'> | null,
): GameListItem {
  const startsAt = combineGameStart(row.game_date, row.start_time)
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    hostId: row.host_id,
    groupId: row.group_id,
    sport: mapSport(row.sports),
    venue: mapVenue(row.venues),
    host: toPublicProfile(row.profiles, 'Host'),
    gameDate: row.game_date,
    startTime: row.start_time,
    endTime: row.end_time,
    startsAt,
    confirmationDeadline: row.confirmation_deadline,
    minPlayers: row.minimum_players,
    maxPlayers: row.maximum_players,
    confirmedCount,
    waitlistCount,
    playerShareInr: row.player_share == null ? null : Number(row.player_share),
    visibility: row.visibility,
    status: deriveUiStatus(row.status, confirmedCount, row.maximum_players),
    dbStatus: row.status,
    venueBookingConfirmedAt: row.venue_booking_confirmed_at ?? null,
    myParticipation: myParticipation ?? null,
  }
}

async function participationForGames(
  userId: string,
  gameIds: string[],
): Promise<Map<string, Pick<GameParticipant, 'role' | 'status'>>> {
  const map = new Map<string, Pick<GameParticipant, 'role' | 'status'>>()
  if (gameIds.length === 0) return map

  const { data, error } = await supabase
    .from('game_players')
    .select('game_id, role, status')
    .eq('user_id', userId)
    .in('game_id', gameIds)
    .in('status', ['confirmed', 'reserved', 'waitlisted', 'attended'])

  if (error) {
    logDevError('participationForGames', error)
    return map
  }

  for (const row of data ?? []) {
    map.set(row.game_id, {
      role: row.role as GamePlayerRole,
      status: row.status as GamePlayerStatus,
    })
  }
  return map
}

async function countsForGames(
  gameIds: string[],
): Promise<Map<string, { confirmed: number; waitlist: number }>> {
  const map = new Map<string, { confirmed: number; waitlist: number }>()
  if (gameIds.length === 0) return map

  const { data, error } = await supabase
    .from('game_players')
    .select('game_id, status, reservation_expires_at')
    .in('game_id', gameIds)
    .in('status', ['confirmed', 'reserved', 'waitlisted', 'attended'])

  if (!error && data) {
    const now = Date.now()
    for (const row of data) {
      const cur = map.get(row.game_id) ?? { confirmed: 0, waitlist: 0 }
      if (row.status === 'waitlisted') {
        cur.waitlist += 1
      } else if (row.status === 'reserved') {
        if (
          row.reservation_expires_at &&
          new Date(row.reservation_expires_at).getTime() > now
        ) {
          cur.confirmed += 1
        }
      } else {
        cur.confirmed += 1
      }
      map.set(row.game_id, cur)
    }
    return map
  }

  // Fallback for anon / restricted RLS: server-side count RPC
  logDevError('countsForGames', error)
  await Promise.all(
    gameIds.map(async (id) => {
      const { data: count } = await supabase.rpc('get_game_player_count', {
        p_game_id: id,
      })
      map.set(id, { confirmed: count ?? 0, waitlist: 0 })
    }),
  )
  return map
}

export const gameSelect = `
  *,
  sports ( id, name, slug, icon ),
  venues ( id, name, description, address, city, state, country, latitude, longitude, map_url, sports, facilities, opening_hours, website, image_url, status, created_by, claimed_by, created_at, updated_at ),
  profiles!host_id ( id, display_name, username, avatar_url, bio )
`

export const groupSelect =
  '*, sports ( id, name, slug, icon ), venues ( id, name, description, address, city, state, country, latitude, longitude, map_url, sports, facilities, opening_hours, website, image_url, status, created_by, claimed_by, created_at, updated_at )'

/** Map raw game join rows (with counts) into list items — shared with groups service. */
export async function mapGamesToListItems(
  rows: unknown[],
  options?: { userId?: string },
): Promise<GameListItem[]> {
  const typed = rows as GameJoin[]
  const counts = await countsForGames(typed.map((r) => r.id))
  const participation = options?.userId
    ? await participationForGames(
        options.userId,
        typed.map((r) => r.id),
      )
    : new Map<string, Pick<GameParticipant, 'role' | 'status'>>()

  return typed.map((row) => {
    const c = counts.get(row.id) ?? { confirmed: 0, waitlist: 0 }
    return mapListItem(row, c.confirmed, c.waitlist, participation.get(row.id) ?? null)
  })
}

export async function listDiscoverableGames(options?: {
  sportSlug?: string
  sportId?: string
}): Promise<GameListItem[]> {
  let query = supabase
    .from('games')
    .select(gameSelect)
    .in('status', ['open', 'confirmed'] satisfies DbGameStatus[])
    .eq('visibility', 'public')
    .order('game_date', { ascending: true })
    .order('start_time', { ascending: true })

  const { data, error } = await query

  if (error) {
    logDevError('listDiscoverableGames', error)
    throw new AppError("Couldn't load games. Try again.")
  }

  let rows = (data ?? []) as unknown as GameJoin[]
  if (options?.sportId) {
    rows = rows.filter((r) => r.sport_id === options.sportId)
  }
  if (options?.sportSlug) {
    rows = rows.filter((r) => r.sports?.slug === options.sportSlug)
  }

  const counts = await countsForGames(rows.map((r) => r.id))
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const participation = user
    ? await participationForGames(
        user.id,
        rows.map((r) => r.id),
      )
    : new Map<string, Pick<GameParticipant, 'role' | 'status'>>()

  return rows.map((row) => {
    const c = counts.get(row.id) ?? { confirmed: 0, waitlist: 0 }
    return mapListItem(row, c.confirmed, c.waitlist, participation.get(row.id) ?? null)
  })
}

export async function getGameDetail(gameId: string): Promise<GameDetail | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('games')
    .select(gameSelect)
    .eq('id', gameId)
    .maybeSingle()

  if (error) {
    logDevError('getGameDetail', error)
    throw new AppError("Couldn't load this game. Try again.")
  }
  if (!data) return null

  const row = data as unknown as GameJoin
  const counts = await countsForGames([gameId])
  const c = counts.get(gameId) ?? { confirmed: 0, waitlist: 0 }
  const base = mapListItem(row, c.confirmed, c.waitlist)

  const { data: players, error: playersError } = await supabase
    .from('game_players')
    .select(
      'id, game_id, user_id, role, status, joined_at, reservation_expires_at, checked_in_at, profiles!user_id ( id, display_name, username, avatar_url, bio )',
    )
    .eq('game_id', gameId)
    .in('status', ['confirmed', 'reserved', 'waitlisted', 'attended', 'no_show'])
    .order('joined_at', { ascending: true })

  if (playersError) {
    logDevError('getGameDetail.players', playersError)
  }

  type PlayerJoin = Tables<'game_players'> & {
    profiles: Pick<
      Tables<'profiles'>,
      'id' | 'display_name' | 'username' | 'avatar_url' | 'bio'
    > | null
  }

  const participants: GameParticipant[] = ((players ?? []) as unknown as PlayerJoin[]).map(
    (p) => ({
      id: p.id,
      userId: p.user_id,
      role: p.role,
      status: p.status,
      joinedAt: p.joined_at,
      reservationExpiresAt: p.reservation_expires_at,
      checkedInAt: p.checked_in_at,
      profile: toPublicProfile(p.profiles),
    }),
  )

  const myParticipation =
    participants.find((p) => p.userId === user?.id) ?? null

  let hostPhone: string | null = null
  if (user) {
    const { data: phone } = await supabase.rpc('get_game_contact_phone', {
      p_game_id: gameId,
      p_target_user_id: row.host_id,
    })
    hostPhone = phone
  }

  return {
    ...base,
    players: participants,
    myParticipation,
    hostPhone,
  }
}

export async function listMyGames(userId: string): Promise<GameListItem[]> {
  const { data: participation, error: partError } = await supabase
    .from('game_players')
    .select('game_id, role, status')
    .eq('user_id', userId)
    .in('status', ['confirmed', 'reserved', 'waitlisted', 'attended'])

  if (partError) {
    logDevError('listMyGames.participation', partError)
    throw new AppError("Couldn't load your games. Try again.")
  }

  const participationByGame = new Map<
    string,
    Pick<GameParticipant, 'role' | 'status'>
  >()
  for (const row of participation ?? []) {
    participationByGame.set(row.game_id, {
      role: row.role as GamePlayerRole,
      status: row.status as GamePlayerStatus,
    })
  }

  const ids = new Set((participation ?? []).map((p) => p.game_id))

  const { data: hosted, error: hostError } = await supabase
    .from('games')
    .select('id')
    .eq('host_id', userId)

  if (hostError) {
    logDevError('listMyGames.hosted', hostError)
    throw new AppError("Couldn't load your games. Try again.")
  }

  for (const g of hosted ?? []) ids.add(g.id)
  if (ids.size === 0) return []

  const { data, error } = await supabase
    .from('games')
    .select(gameSelect)
    .in('id', [...ids])
    .order('game_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    logDevError('listMyGames.games', error)
    throw new AppError("Couldn't load your games. Try again.")
  }

  const rows = (data ?? []) as unknown as GameJoin[]
  const counts = await countsForGames(rows.map((r) => r.id))
  return rows.map((row) => {
    const c = counts.get(row.id) ?? { confirmed: 0, waitlist: 0 }
    return mapListItem(
      row,
      c.confirmed,
      c.waitlist,
      participationByGame.get(row.id) ?? null,
    )
  })
}

export async function createGame(input: {
  title: string
  description?: string
  sportId: string
  venueId: string
  gameDate: string
  startTime: string
  endTime: string
  minimumPlayers: number
  maximumPlayers: number
  playerShare?: number | null
  visibility?: GameVisibility
  groupId?: string | null
}): Promise<GameListItem> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in to host a game.')

  if (input.minimumPlayers < 2) {
    throw new AppError('Minimum players must be at least 2.')
  }
  if (input.maximumPlayers < input.minimumPlayers) {
    throw new AppError('Maximum players must be at least the minimum.')
  }

  const payload: TablesInsert<'games'> = {
    host_id: user.id,
    sport_id: input.sportId,
    venue_id: input.venueId,
    title: input.title,
    description: input.description ?? null,
    game_date: input.gameDate,
    start_time: input.startTime,
    end_time: input.endTime,
    minimum_players: input.minimumPlayers,
    maximum_players: input.maximumPlayers,
    player_share: input.playerShare ?? null,
    visibility: input.visibility ?? 'public',
    status: 'draft',
    venue_confirmation: 'pending',
    group_id: input.groupId ?? null,
  }

  const { data, error } = await supabase
    .from('games')
    .insert(payload)
    .select(gameSelect)
    .single()

  if (error || !data) {
    logDevError('createGame', error)
    throw parsePlayrRpcError(error, "Couldn't create game. Try again.")
  }

  const row = data as unknown as GameJoin

  const { error: hostError } = await supabase.rpc('ensure_host_player', {
    p_game_id: row.id,
  })
  if (hostError) {
    logDevError('createGame.ensureHost', hostError)
  }

  const detail = await getGameDetail(row.id)
  if (!detail) {
    return mapListItem(row, 1, 0)
  }
  return detail
}

export async function reserveGameSpot(gameId: string): Promise<Tables<'game_players'>> {
  const { data, error } = await supabase.rpc('join_game', {
    p_game_id: gameId,
    p_contact_consent: true,
  })
  if (error) {
    logDevError('reserveGameSpot', error)
    throw parsePlayrRpcError(error, "Couldn't join this game. Try again.")
  }
  return data
}

export async function joinWaitlist(gameId: string): Promise<Tables<'game_players'>> {
  const { data, error } = await supabase.rpc('join_waitlist', {
    p_game_id: gameId,
    p_contact_consent: true,
  })
  if (error) {
    logDevError('joinWaitlist', error)
    throw parsePlayrRpcError(error, "Couldn't join the waitlist. Try again.")
  }
  return data
}

export async function confirmReservation(
  gameId: string,
): Promise<Tables<'game_players'>> {
  const { data, error } = await supabase.rpc('confirm_game_reservation', {
    p_game_id: gameId,
  })
  if (error) {
    logDevError('confirmReservation', error)
    throw parsePlayrRpcError(error, "Couldn't confirm your spot. Try again.")
  }
  return data
}

export async function cancelParticipation(gameId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_game_participation', {
    p_game_id: gameId,
  })
  if (error) {
    logDevError('cancelParticipation', error)
    throw parsePlayrRpcError(error, "Couldn't cancel your spot. Try again.")
  }
}

export async function getContactPhone(
  gameId: string,
  targetUserId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_game_contact_phone', {
    p_game_id: gameId,
    p_target_user_id: targetUserId,
  })
  if (error) {
    logDevError('getContactPhone', error)
    return null
  }
  return data
}

export type { PublicProfile }
