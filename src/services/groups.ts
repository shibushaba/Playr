import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { gameSelect, groupSelect, mapGamesToListItems } from '@/services/games'
import type {
  GameRsvpResponse,
  GroupMemberRole,
  GroupVisibility,
  Json,
  RecurrenceType,
  Tables,
} from '@/types/database'
import type {
  GameListItem,
  GroupHealth,
  GroupHealthStatus,
  GroupListItem,
  GroupMember,
  SportRecord,
  VenueRecord,
} from '@/types/domain'
import { parseStringArray, toPublicProfile } from '@/types/domain'

type GroupJoin = Tables<'recurring_groups'> & {
  sports: Pick<Tables<'sports'>, 'id' | 'name' | 'slug' | 'icon'> | null
  venues: Tables<'venues'> | null
}

function recurrenceLabel(
  type: Tables<'recurring_groups'>['recurrence_type'],
  config: unknown,
): string {
  if (type === 'daily') return 'Every day'
  if (config && typeof config === 'object' && config !== null && 'weekdays' in config) {
    const weekdays = (config as { weekdays?: number[] }).weekdays
    if (weekdays?.length) {
      const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      return weekdays
        .map((d) => names[d - 1] ?? String(d))
        .join(' · ')
    }
  }
  if (type === 'weekly') {
    const days =
      config && typeof config === 'object' && config !== null && 'days' in config
        ? (config as { days?: string[] }).days
        : undefined
    if (days?.length) {
      return days.map((d) => d.slice(0, 1).toUpperCase() + d.slice(1)).join(' · ')
    }
    return 'Weekly'
  }
  return 'Custom schedule'
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

function mapGroup(
  row: GroupJoin,
  myMembership?: GroupListItem['myMembership'],
): GroupListItem {
  const time = row.start_time.slice(0, 5)
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    hostId: row.host_id,
    sport: mapSport(row.sports),
    venue: mapVenue(row.venues),
    visibility: row.visibility,
    recurrenceType: row.recurrence_type,
    recurrenceLabel: recurrenceLabel(row.recurrence_type, row.recurrence_config),
    timeLabel: time,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    recurrenceConfig: row.recurrence_config,
    minPlayers: row.minimum_players,
    maxPlayers: row.maximum_players,
    playerShareInr: row.player_share == null ? null : Number(row.player_share),
    autoOpenMissingSpots: row.auto_open_missing_spots,
    priorityHours: row.regular_member_priority_hours,
    endsOn: row.ends_on,
    isActive: row.is_active,
    myMembership: myMembership ?? null,
  }
}

async function attachMyMembership(
  groups: GroupListItem[],
): Promise<GroupListItem[]> {
  if (groups.length === 0) return groups
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return groups.map((g) => ({ ...g, myMembership: null }))

  const { data, error } = await supabase
    .from('recurring_group_members')
    .select('group_id, role, status')
    .eq('user_id', user.id)
    .in(
      'group_id',
      groups.map((g) => g.id),
    )

  if (error) {
    logDevError('attachMyMembership', error)
    return groups
  }

  const byGroup = new Map(
    (data ?? []).map((m) => [m.group_id, { role: m.role, status: m.status }]),
  )
  return groups.map((g) => ({
    ...g,
    myMembership: byGroup.get(g.id) ?? null,
  }))
}

export async function listGroups(): Promise<GroupListItem[]> {
  const { data, error } = await supabase
    .from('recurring_groups')
    .select(groupSelect)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    logDevError('listGroups', error)
    throw new AppError("Couldn't load groups. Try again.")
  }

  const mapped = ((data ?? []) as GroupJoin[]).map((row) => mapGroup(row))
  return attachMyMembership(mapped)
}

export async function listMyGroups(): Promise<GroupListItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in to view your groups.')

  const { data: memberships, error: memError } = await supabase
    .from('recurring_group_members')
    .select('group_id, role, status')
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (memError) {
    logDevError('listMyGroups.memberships', memError)
    throw new AppError("Couldn't load your groups. Try again.")
  }

  const ids = new Set((memberships ?? []).map((m) => m.group_id))

  const { data: hosted, error: hostError } = await supabase
    .from('recurring_groups')
    .select('id')
    .eq('host_id', user.id)

  if (hostError) {
    logDevError('listMyGroups.hosted', hostError)
    throw new AppError("Couldn't load your groups. Try again.")
  }

  for (const g of hosted ?? []) ids.add(g.id)
  if (ids.size === 0) return []

  const membershipByGroup = new Map(
    (memberships ?? []).map((m) => [m.group_id, { role: m.role, status: m.status }]),
  )

  const { data, error } = await supabase
    .from('recurring_groups')
    .select(groupSelect)
    .in('id', [...ids])
    .order('created_at', { ascending: false })

  if (error) {
    logDevError('listMyGroups.groups', error)
    throw new AppError("Couldn't load your groups. Try again.")
  }

  return ((data ?? []) as GroupJoin[]).map((row) =>
    mapGroup(row, membershipByGroup.get(row.id) ?? null),
  )
}

export async function getGroup(id: string): Promise<GroupListItem | null> {
  const { data, error } = await supabase
    .from('recurring_groups')
    .select(groupSelect)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    logDevError('getGroup', error)
    throw new AppError("Couldn't load group. Try again.")
  }
  if (!data) return null
  const [withMembership] = await attachMyMembership([mapGroup(data as GroupJoin)])
  return withMembership
}

export async function createGroup(input: {
  name: string
  description?: string
  sportId: string
  venueId?: string
  recurrenceType: RecurrenceType
  recurrenceConfig?: Json
  startTime: string
  durationMinutes: number
  minimumPlayers: number
  maximumPlayers: number
  playerShare?: number | null
  visibility?: GroupVisibility
  autoOpenMissingSpots?: boolean
  priorityHours?: number
  endsOn?: string | null
}): Promise<GroupListItem> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in to create a group.')

  const { data, error } = await supabase
    .from('recurring_groups')
    .insert({
      name: input.name,
      description: input.description ?? null,
      host_id: user.id,
      sport_id: input.sportId,
      venue_id: input.venueId ?? null,
      recurrence_type: input.recurrenceType,
      recurrence_config: input.recurrenceConfig ?? {
        timezone: 'Asia/Kolkata',
        weekdays: [1, 2, 3, 4, 5, 6, 7],
      },
      start_time: input.startTime,
      duration_minutes: input.durationMinutes,
      minimum_players: input.minimumPlayers,
      maximum_players: input.maximumPlayers,
      player_share: input.playerShare ?? null,
      visibility: input.visibility ?? 'public',
      auto_open_missing_spots: input.autoOpenMissingSpots ?? true,
      regular_member_priority_hours: input.priorityHours ?? 6,
      ends_on: input.endsOn ?? null,
    })
    .select(groupSelect)
    .single()

  if (error || !data) {
    logDevError('createGroup', error)
    throw parsePlayrRpcError(error, "Couldn't create group. Try again.")
  }

  return mapGroup(data as unknown as GroupJoin, {
    role: 'host',
    status: 'active',
  })
}

export async function updateGroup(
  groupId: string,
  input: {
    name?: string | null
    description?: string | null
    venueId?: string | null
    visibility?: GroupVisibility | null
    recurrenceType?: RecurrenceType | null
    recurrenceConfig?: Json | null
    startTime?: string | null
    durationMinutes?: number | null
    minimumPlayers?: number | null
    maximumPlayers?: number | null
    playerShare?: number | null
    autoOpenMissingSpots?: boolean | null
    priorityHours?: number | null
    endsOn?: string | null
    clearEndsOn?: boolean
    clearVenue?: boolean
  },
): Promise<GroupListItem> {
  const { error } = await supabase.rpc('update_recurring_group', {
    p_group_id: groupId,
    p_name: input.name ?? undefined,
    p_description: input.description ?? undefined,
    p_venue_id: input.venueId ?? undefined,
    p_visibility: input.visibility ?? undefined,
    p_recurrence_type: input.recurrenceType ?? undefined,
    p_recurrence_config: input.recurrenceConfig ?? undefined,
    p_start_time: input.startTime ?? undefined,
    p_duration_minutes: input.durationMinutes ?? undefined,
    p_minimum_players: input.minimumPlayers ?? undefined,
    p_maximum_players: input.maximumPlayers ?? undefined,
    p_player_share: input.playerShare ?? undefined,
    p_auto_open_missing_spots: input.autoOpenMissingSpots ?? undefined,
    p_regular_member_priority_hours: input.priorityHours ?? undefined,
    p_ends_on: input.endsOn ?? undefined,
    p_clear_ends_on: input.clearEndsOn ?? false,
    p_clear_venue: input.clearVenue ?? false,
  })
  if (error) {
    logDevError('updateGroup', error)
    throw parsePlayrRpcError(error, "Couldn't update group. Try again.")
  }
  const group = await getGroup(groupId)
  if (!group) throw new AppError("Couldn't load group. Try again.")
  return group
}

export async function setGroupActive(
  groupId: string,
  isActive: boolean,
): Promise<GroupListItem> {
  const { error } = await supabase.rpc('set_recurring_group_active', {
    p_group_id: groupId,
    p_is_active: isActive,
  })
  if (error) {
    logDevError('setGroupActive', error)
    throw parsePlayrRpcError(error, "Couldn't update group. Try again.")
  }
  const group = await getGroup(groupId)
  if (!group) throw new AppError("Couldn't load group. Try again.")
  return group
}

export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('recurring_group_members')
    .select(
      'id, group_id, user_id, role, status, joined_at, profiles!user_id ( id, display_name, username, avatar_url, bio )',
    )
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })

  if (error) {
    logDevError('listGroupMembers', error)
    throw new AppError("Couldn't load members. Try again.")
  }

  type MemberJoin = Tables<'recurring_group_members'> & {
    profiles: Pick<
      Tables<'profiles'>,
      'id' | 'display_name' | 'username' | 'avatar_url' | 'bio'
    > | null
  }

  return ((data ?? []) as unknown as MemberJoin[]).map((m) => ({
    id: m.id,
    groupId: m.group_id,
    userId: m.user_id,
    role: m.role,
    status: m.status,
    joinedAt: m.joined_at,
    profile: toPublicProfile(m.profiles),
  }))
}

export async function joinPublicGroup(
  groupId: string,
): Promise<Tables<'recurring_group_members'>> {
  const { data, error } = await supabase.rpc('join_public_group', {
    p_group_id: groupId,
  })
  if (error) {
    logDevError('joinPublicGroup', error)
    throw parsePlayrRpcError(error, "Couldn't join this group. Try again.")
  }
  return data
}

export async function leaveGroup(
  groupId: string,
): Promise<Tables<'recurring_group_members'>> {
  const { data, error } = await supabase.rpc('leave_group', {
    p_group_id: groupId,
  })
  if (error) {
    logDevError('leaveGroup', error)
    throw parsePlayrRpcError(error, "Couldn't leave this group. Try again.")
  }
  return data
}

export async function setMemberRole(
  groupId: string,
  userId: string,
  role: GroupMemberRole,
): Promise<Tables<'recurring_group_members'>> {
  const { data, error } = await supabase.rpc('set_group_member_role', {
    p_group_id: groupId,
    p_user_id: userId,
    p_role: role,
  })
  if (error) {
    logDevError('setMemberRole', error)
    throw parsePlayrRpcError(error, "Couldn't update member role. Try again.")
  }
  return data
}

export async function removeMember(
  groupId: string,
  userId: string,
): Promise<Tables<'recurring_group_members'>> {
  const { data, error } = await supabase.rpc('remove_group_member', {
    p_group_id: groupId,
    p_user_id: userId,
  })
  if (error) {
    logDevError('removeMember', error)
    throw parsePlayrRpcError(error, "Couldn't remove member. Try again.")
  }
  return data
}

export async function getGroupHealth(groupId: string): Promise<GroupHealth> {
  const { data, error } = await supabase.rpc('get_group_health', {
    p_group_id: groupId,
  })
  if (error) {
    logDevError('getGroupHealth', error)
    throw parsePlayrRpcError(error, "Couldn't load group health. Try again.")
  }

  const raw = (data ?? {}) as Record<string, unknown>
  const status = (typeof raw.status === 'string'
    ? raw.status
    : 'healthy') as GroupHealthStatus

  return {
    status,
    label: typeof raw.label === 'string' ? raw.label : 'Healthy',
    sampleSize: typeof raw.sample_size === 'number' ? raw.sample_size : 0,
    completed: typeof raw.completed === 'number' ? raw.completed : undefined,
    cancelled: typeof raw.cancelled === 'number' ? raw.cancelled : undefined,
    completionRate:
      typeof raw.completion_rate === 'number' ? raw.completion_rate : null,
    reason: typeof raw.reason === 'string' ? raw.reason : null,
  }
}

function todayLocalDate(): string {
  const now = new Date()
  const offset = 5.5 * 60
  const local = new Date(now.getTime() + offset * 60_000)
  return local.toISOString().slice(0, 10)
}

export async function listGroupUpcomingGames(
  groupId: string,
  limit = 5,
): Promise<GameListItem[]> {
  const today = todayLocalDate()
  const { data, error } = await supabase
    .from('games')
    .select(gameSelect)
    .eq('group_id', groupId)
    .gte('game_date', today)
    .not('status', 'eq', 'cancelled')
    .order('game_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(limit)

  if (error) {
    logDevError('listGroupUpcomingGames', error)
    throw new AppError("Couldn't load group games. Try again.")
  }

  return mapGamesToListItems(data ?? [])
}

export async function listGroupPastGames(
  groupId: string,
  limit = 5,
): Promise<GameListItem[]> {
  const today = todayLocalDate()
  const { data, error } = await supabase
    .from('games')
    .select(gameSelect)
    .eq('group_id', groupId)
    .or(`game_date.lt.${today},status.in.(completed,cancelled)`)
    .order('game_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(limit)

  if (error) {
    logDevError('listGroupPastGames', error)
    throw new AppError("Couldn't load group games. Try again.")
  }

  return mapGamesToListItems(data ?? [])
}

export async function setGameRsvp(
  gameId: string,
  response: GameRsvpResponse,
  contactConsent = true,
): Promise<Json> {
  const { data, error } = await supabase.rpc('set_game_rsvp', {
    p_game_id: gameId,
    p_response: response,
    p_contact_consent: contactConsent,
  })
  if (error) {
    logDevError('setGameRsvp', error)
    throw parsePlayrRpcError(error, "Couldn't save your RSVP. Try again.")
  }
  return data
}

export async function getMyRsvp(
  gameId: string,
): Promise<Tables<'game_rsvps'> | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('game_rsvps')
    .select('*')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    logDevError('getMyRsvp', error)
    return null
  }
  return data
}

export async function listGroupGames(groupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('games')
    .select('id')
    .eq('group_id', groupId)
    .order('game_date', { ascending: true })

  if (error) {
    logDevError('listGroupGames', error)
    return []
  }
  return (data ?? []).map((g) => g.id)
}
