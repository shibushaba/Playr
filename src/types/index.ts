export type Sport =
  | 'football'
  | 'cricket'
  | 'badminton'
  | 'basketball'
  | 'volleyball'
  | 'tennis'
  | 'futsal'

export type GameStatus =
  | 'open'
  | 'filling'
  | 'full'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'in_progress'

export type GameVisibility = 'public' | 'private' | 'password'

export type VenueStatus = 'pending' | 'community_added' | 'verified'

export type RecurrencePattern =
  | 'daily'
  | 'weekly'
  | 'weekdays'
  | 'custom'

export type AttendanceStatus =
  | 'confirmed'
  | 'reserved'
  | 'waitlisted'
  | 'checked_in'
  | 'no_show'
  | 'cancelled'

export interface Player {
  id: string
  name: string
  handle: string
  phone?: string
  avatarUrl?: string
  city: string
  reliabilityScore: number
  gamesPlayed: number
  gamesHosted: number
  noShows: number
  bio?: string
}

export interface Venue {
  id: string
  name: string
  address: string
  area: string
  city: string
  sports: Sport[]
  status: VenueStatus
  distanceKm: number
  courts?: string
  notes?: string
}

export interface GamePlayer {
  playerId: string
  status: AttendanceStatus
  joinedAt: string
  isHost?: boolean
  isCoHost?: boolean
}

export interface Game {
  id: string
  title: string
  sport: Sport
  hostId: string
  coHostIds: string[]
  venueId: string
  startsAt: string
  durationMinutes: number
  minPlayers: number
  maxPlayers: number
  confirmedCount: number
  waitlistCount: number
  status: GameStatus
  visibility: GameVisibility
  playerShareInr: number | null
  notes?: string
  skillLevel: 'casual' | 'intermediate' | 'competitive'
  groupId?: string
  players: GamePlayer[]
  hasPassword?: boolean
}

export interface RecurringGroup {
  id: string
  name: string
  sport: Sport
  hostId: string
  venueId: string
  pattern: RecurrencePattern
  patternLabel: string
  timeLabel: string
  memberCount: number
  nextOccurrenceAt: string
  description?: string
  visibility: GameVisibility
}

export interface SportMeta {
  id: Sport
  label: string
  emoji: string
  color: string
}
