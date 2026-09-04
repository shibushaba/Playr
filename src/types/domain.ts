import type {
  DbGameStatus,
  GamePlayerRole,
  GamePlayerStatus,
  GameRsvpResponse,
  GameVisibility,
  GroupMemberRole,
  GroupMemberStatus,
  GroupVisibility,
  Json,
  NotificationType,
  RecurrenceType,
  Tables,
  VenueStatus,
} from '@/types/database'

/** UI-facing game status (includes derived filling/full) */
export type UiGameStatus =
  | 'open'
  | 'filling'
  | 'full'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'in_progress'
  | 'draft'

export interface PublicProfile {
  id: string
  displayName: string
  username: string | null
  avatarUrl: string | null
  bio: string | null
}

export interface SportRecord {
  id: string
  name: string
  slug: string
  icon: string | null
}

export interface VenueRecord {
  id: string
  name: string
  description: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  mapUrl: string | null
  phone: string | null
  status: VenueStatus
  sports: string[]
  facilities: string[]
  distanceKm?: number
  distanceMeters?: number
  distanceLabel?: string
}

export interface GameListItem {
  id: string
  title: string
  description: string | null
  hostId: string
  groupId: string | null
  sport: SportRecord
  venue: VenueRecord | null
  host: PublicProfile
  gameDate: string
  startTime: string
  endTime: string
  startsAt: string
  confirmationDeadline: string
  minPlayers: number
  maxPlayers: number
  confirmedCount: number
  waitlistCount: number
  playerShareInr: number | null
  visibility: GameVisibility
  status: UiGameStatus
  dbStatus: DbGameStatus
  venueBookingConfirmedAt: string | null
  distanceMeters?: number
  distanceLabel?: string
  /** Present when the list query includes the viewer's row (e.g. My Games). */
  myParticipation?: Pick<GameParticipant, 'role' | 'status'> | null
}

export interface GameParticipant {
  id: string
  userId: string
  role: GamePlayerRole
  status: GamePlayerStatus
  joinedAt: string
  reservationExpiresAt: string | null
  checkedInAt: string | null
  profile: PublicProfile
}

export interface GameDetail extends GameListItem {
  players: GameParticipant[]
  myParticipation: GameParticipant | null
  hostPhone: string | null
}

export interface GroupListItem {
  id: string
  name: string
  description: string | null
  hostId: string
  sport: SportRecord
  venue: VenueRecord | null
  visibility: GroupVisibility
  recurrenceType: RecurrenceType
  recurrenceLabel: string
  timeLabel: string
  startTime: string
  durationMinutes: number
  recurrenceConfig: Json
  minPlayers: number
  maxPlayers: number
  playerShareInr: number | null
  autoOpenMissingSpots: boolean
  priorityHours: number
  endsOn: string | null
  isActive: boolean
  myMembership?: { role: GroupMemberRole; status: GroupMemberStatus } | null
}

export type GroupHealthStatus =
  | 'healthy'
  | 'needs_players'
  | 'frequently_cancelled'

export interface GroupHealth {
  status: GroupHealthStatus
  label: string
  sampleSize: number
  completed?: number
  cancelled?: number
  completionRate: number | null
  reason?: string | null
}

export interface GroupMember {
  id: string
  groupId: string
  userId: string
  role: GroupMemberRole
  status: GroupMemberStatus
  joinedAt: string
  profile: PublicProfile
}

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string | null
  gameId: string | null
  groupId: string | null
  actorId: string | null
  readAt: string | null
  createdAt: string
}

export type { GameRsvpResponse }

export type ProfileRow = Tables<'profiles'>

export function combineGameStart(gameDate: string, startTime: string): string {
  // Treat stored local wall time as Asia/Kolkata, expose ISO UTC
  const time = startTime.length === 5 ? `${startTime}:00` : startTime
  const asLocal = new Date(`${gameDate}T${time}+05:30`)
  return asLocal.toISOString()
}

export function deriveUiStatus(
  dbStatus: DbGameStatus,
  confirmedCount: number,
  maxPlayers: number,
): UiGameStatus {
  if (dbStatus === 'live') return 'in_progress'
  if (dbStatus === 'draft') return 'draft'
  if (dbStatus === 'cancelled') return 'cancelled'
  if (dbStatus === 'completed') return 'completed'
  if (dbStatus === 'confirmed') return 'confirmed'
  if (confirmedCount >= maxPlayers) return 'full'
  if (confirmedCount / maxPlayers >= 0.61) return 'filling'
  return 'open'
}

export function toPublicProfile(
  row: Pick<
    Tables<'profiles'>,
    'id' | 'display_name' | 'username' | 'avatar_url' | 'bio'
  > | null
  | undefined,
  fallback = 'Player',
): PublicProfile {
  return {
    id: row?.id ?? '',
    displayName: row?.display_name?.trim() || fallback,
    username: row?.username ?? null,
    avatarUrl: row?.avatar_url ?? null,
    bio: row?.bio ?? null,
  }
}

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}
