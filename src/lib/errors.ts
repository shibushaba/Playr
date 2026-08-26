export class AppError extends Error {
  readonly code: string

  constructor(message: string, code = 'app_error') {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

const CODE_MESSAGES: Record<string, string> = {
  GAME_FULL: 'That spot was just taken.',
  GAME_CLOSED: 'That game is no longer accepting players.',
  GAME_CANCELLED:
    "This game was cancelled because enough players didn't join.",
  GAME_CONFIRMED: 'This game is locked and no longer accepting players.',
  GAME_NOT_FOUND: 'Game not found.',
  ALREADY_JOINED: 'You already have a spot in this game.',
  RESERVATION_EXPIRED: 'Your 8-minute hold expired.',
  UNAUTHENTICATED: 'Please sign in to continue.',
  NO_RESERVATION: 'No reservation found.',
  NO_PARTICIPATION: 'No active participation found.',
  WAITLISTED: 'You are on the waitlist.',
  GAME_NOT_FULL: 'Spots are still available — join the game instead.',
  CONFIRMED_GAME_LOCKED: 'This game is locked after confirmation.',
  STATUS_LOCKED: 'Game status changes are controlled by PLAYR.',
  FORBIDDEN: "You don't have permission to do that.",
  CONTACT_CONSENT_REQUIRED: 'Please acknowledge contact sharing before joining.',
  CHECKIN_UNAVAILABLE: 'Check-in is not available for this game.',
  CHECKIN_NOT_ALLOWED: 'Only confirmed players can check in.',
  ALREADY_CHECKED_IN: 'Already checked in.',
  CHECKIN_TOO_EARLY: 'Check-in opens 30 minutes before the game.',
  CHECKIN_TOO_LATE: 'Check-in window has closed.',
  TOO_FAR: "You're too far from the venue to check in.",
  LOCATION_REQUIRED: "Couldn't verify your location.",
  VENUE_LOCATION_MISSING: 'Venue location is missing for check-in.',
  ATTENDANCE_UNAVAILABLE: 'Attendance updates are not available yet.',
  INVALID_REPORT: "Couldn't submit that report.",
  GROUP_NOT_FOUND: 'Group not found.',
  GROUP_PAUSED: 'This group is paused.',
  GROUP_INVITE_REQUIRED: 'You need an invite to join this group.',
  INVITE_REQUIRED: 'You need an invite to join this game.',
  HOST_CANNOT_LEAVE: 'The host cannot leave the group.',
  NOT_A_MEMBER: 'You are not a member of this group.',
  MEMBER_PRIORITY: 'Regular members get first priority for a short window.',
  INVITE_INVALID: 'That invite is not valid.',
  INVALID_INVITE: 'That invite is not valid.',
  INVALID_CAPACITY: 'Check the player minimum and maximum.',
  INVITE_CODE_FAILED: "Couldn't create that invite. Try again.",
  NOT_FOUND: 'That invite is not valid.',
  EXPIRED: 'That invite has expired.',
  REVOKED: 'That invite was revoked.',
  ALREADY_ACCEPTED: 'That invite was already used.',
  MAP_LOCATION_REQUIRED: 'Select the venue location on the map.',
  MAP_URL_REQUIRED: 'Map location is required.',
  INVALID_MAP_URL: 'Map link must be a valid http(s) URL.',
  INVALID_COORDINATES: 'Map coordinates are invalid.',
  INVALID_VENUE: 'Check the venue details and try again.',
  SIMILAR_VENUE_EXISTS: 'A similar venue already exists nearby.',
  PHONE_VERIFICATION_REQUIRED:
    'Add a phone number in your profile if the host needs to reach you.',
  EMAIL_VERIFICATION_REQUIRED: 'Confirm your email before hosting.',
  PROFILE_INCOMPLETE: 'Add your name in your profile to continue.',
  INVALID_USERNAME: 'Username must be 3–30 letters, numbers, or underscores.',
  USERNAME_TAKEN: 'That username is taken.',
  VENUE_BOOKING_REQUIRED: 'Confirm venue booking before publishing.',
  VENUE_CONTACT_REQUIRED: 'Venue phone is required.',
  VENUE_REQUIRED: 'Select a venue first.',
  INVALID_PHONE: 'Enter a valid phone number.',
  INVALID_CODE: 'That code is incorrect.',
  CODE_EXPIRED: 'That code expired. Request a new one.',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Request a new code.',
  USE_PUBLISH_RPC: 'Use publish to open the game.',
}

const KNOWN_CODES = Object.keys(CODE_MESSAGES)

export function parsePlayrRpcError(error: unknown, fallback: string): AppError {
  const raw =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
      ? (error as { message: string }).message
      : ''

  if (raw.includes('23505') || raw.toLowerCase().includes('duplicate')) {
    return new AppError('That spot was just taken by someone else.', 'GAME_FULL')
  }

  const tooFar = raw.match(/TOO_FAR:(\d+)/)
  if (tooFar) {
    return new AppError(CODE_MESSAGES.TOO_FAR, 'TOO_FAR')
  }

  const code = KNOWN_CODES.find(
    (c) => raw === c || raw.startsWith(`${c}`) || raw.includes(c),
  )

  if (code) {
    return new AppError(CODE_MESSAGES[code] ?? fallback, code)
  }

  if (raw.toLowerCase().includes('sign in')) {
    return new AppError(CODE_MESSAGES.UNAUTHENTICATED, 'UNAUTHENTICATED')
  }
  if (raw.toLowerCase().includes('expired')) {
    return new AppError(CODE_MESSAGES.RESERVATION_EXPIRED, 'RESERVATION_EXPIRED')
  }
  if (raw.toLowerCase().includes('full')) {
    return new AppError(CODE_MESSAGES.GAME_FULL, 'GAME_FULL')
  }

  if (import.meta.env.DEV) {
    console.error('[PLAYR] RPC error', error)
  }

  return new AppError(fallback, 'app_error')
}

export function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) return error.message
  if (import.meta.env.DEV) {
    console.error('[PLAYR]', error)
  }
  return fallback
}

export function logDevError(context: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`[PLAYR] ${context}`, error)
  }
}
