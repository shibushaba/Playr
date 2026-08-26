import type {
  Game,
  Player,
  RecurringGroup,
  Sport,
  SportMeta,
  Venue,
} from '@/types'

export const CURRENT_USER_ID = 'p1'

export const sports: SportMeta[] = [
  { id: 'football', label: 'Football', emoji: '⚽', color: '#0f7a4f' },
  { id: 'cricket', label: 'Cricket', emoji: '🏏', color: '#1f6b4a' },
  { id: 'badminton', label: 'Badminton', emoji: '🏸', color: '#2a6f97' },
  { id: 'basketball', label: 'Basketball', emoji: '🏀', color: '#c45c12' },
  { id: 'volleyball', label: 'Volleyball', emoji: '🏐', color: '#7a4f0f' },
  { id: 'tennis', label: 'Tennis', emoji: '🎾', color: '#4f7a0f' },
  { id: 'futsal', label: 'Futsal', emoji: '🥅', color: '#0f5c7a' },
]

export const players: Player[] = [
  {
    id: 'p1',
    name: 'Arjun Mehta',
    handle: 'arjunplays',
    phone: '+91 98765 43210',
    city: 'Bengaluru',
    reliabilityScore: 96,
    gamesPlayed: 48,
    gamesHosted: 12,
    noShows: 1,
    bio: 'Evening football regular. Prefer 7v7.',
  },
  {
    id: 'p2',
    name: 'Sara Khan',
    handle: 'sarak',
    phone: '+91 98111 22334',
    city: 'Bengaluru',
    reliabilityScore: 98,
    gamesPlayed: 62,
    gamesHosted: 19,
    noShows: 0,
    bio: 'Host of Sunday badminton crew.',
  },
  {
    id: 'p3',
    name: 'Dev Patel',
    handle: 'devp',
    phone: '+91 99001 11223',
    city: 'Bengaluru',
    reliabilityScore: 91,
    gamesPlayed: 31,
    gamesHosted: 4,
    noShows: 2,
  },
  {
    id: 'p4',
    name: 'Maya Rao',
    handle: 'mayarao',
    phone: '+91 99887 76655',
    city: 'Bengaluru',
    reliabilityScore: 94,
    gamesPlayed: 27,
    gamesHosted: 6,
    noShows: 1,
  },
  {
    id: 'p5',
    name: 'Kabir Singh',
    handle: 'kabirs',
    phone: '+91 97654 32109',
    city: 'Bengaluru',
    reliabilityScore: 88,
    gamesPlayed: 19,
    gamesHosted: 2,
    noShows: 3,
  },
  {
    id: 'p6',
    name: 'Ananya Iyer',
    handle: 'ananyi',
    phone: '+91 91234 56780',
    city: 'Bengaluru',
    reliabilityScore: 97,
    gamesPlayed: 41,
    gamesHosted: 8,
    noShows: 0,
  },
  {
    id: 'p7',
    name: 'Rohan Das',
    handle: 'rohand',
    phone: '+91 93456 78123',
    city: 'Bengaluru',
    reliabilityScore: 93,
    gamesPlayed: 22,
    gamesHosted: 3,
    noShows: 1,
  },
  {
    id: 'p8',
    name: 'Neha Gupta',
    handle: 'nehag',
    phone: '+91 94567 89012',
    city: 'Bengaluru',
    reliabilityScore: 95,
    gamesPlayed: 35,
    gamesHosted: 5,
    noShows: 1,
  },
]

/** Relative to "now" so deadlines and countdowns feel live */
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function daysFromNow(days: number, hour = 19, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const venues: Venue[] = [
  {
    id: 'v1',
    name: 'Turf Town Koramangala',
    address: '80 Feet Rd, 4th Block',
    area: 'Koramangala',
    city: 'Bengaluru',
    sports: ['football', 'futsal'],
    status: 'verified',
    distanceKm: 1.2,
    courts: '2 outdoor turfs',
    notes: 'Floodlights till 11 PM. Parking available.',
  },
  {
    id: 'v2',
    name: 'Smash Badminton Arena',
    address: '12th Main, Indiranagar',
    area: 'Indiranagar',
    city: 'Bengaluru',
    sports: ['badminton'],
    status: 'verified',
    distanceKm: 2.8,
    courts: '6 indoor courts',
  },
  {
    id: 'v3',
    name: 'Hoops Court HSR',
    address: '27th Main, HSR Layout',
    area: 'HSR Layout',
    city: 'Bengaluru',
    sports: ['basketball'],
    status: 'community_added',
    distanceKm: 3.4,
    courts: '1 full court',
  },
  {
    id: 'v4',
    name: 'Cubbon Net Practice',
    address: 'Cubbon Park East Gate',
    area: 'Central',
    city: 'Bengaluru',
    sports: ['cricket'],
    status: 'community_added',
    distanceKm: 5.1,
    courts: 'Net practice lanes',
  },
  {
    id: 'v5',
    name: 'Beach Volleyball Sandpit',
    address: 'Manyata Tech Park edge',
    area: 'Hebbal',
    city: 'Bengaluru',
    sports: ['volleyball'],
    status: 'pending',
    distanceKm: 8.6,
    courts: '1 sand court',
  },
  {
    id: 'v6',
    name: 'Ace Tennis Club',
    address: 'Sarjapur Outer Ring Rd',
    area: 'Bellandur',
    city: 'Bengaluru',
    sports: ['tennis'],
    status: 'verified',
    distanceKm: 6.2,
    courts: '4 hard courts',
  },
]

export const games: Game[] = [
  {
    id: 'g1',
    title: 'Evening 7v7 Football',
    sport: 'football',
    hostId: 'p2',
    coHostIds: [],
    venueId: 'v1',
    startsAt: hoursFromNow(5.5),
    durationMinutes: 90,
    minPlayers: 10,
    maxPlayers: 14,
    confirmedCount: 11,
    waitlistCount: 2,
    status: 'filling',
    visibility: 'public',
    playerShareInr: 120,
    notes: 'Bring white & dark kits. Cleats preferred.',
    skillLevel: 'intermediate',
    players: [
      { playerId: 'p2', status: 'confirmed', joinedAt: hoursFromNow(-20), isHost: true },
      { playerId: 'p1', status: 'confirmed', joinedAt: hoursFromNow(-18) },
      { playerId: 'p3', status: 'confirmed', joinedAt: hoursFromNow(-12) },
      { playerId: 'p4', status: 'confirmed', joinedAt: hoursFromNow(-10) },
      { playerId: 'p5', status: 'confirmed', joinedAt: hoursFromNow(-8) },
      { playerId: 'p6', status: 'confirmed', joinedAt: hoursFromNow(-6) },
      { playerId: 'p7', status: 'confirmed', joinedAt: hoursFromNow(-4) },
      { playerId: 'p8', status: 'waitlisted', joinedAt: hoursFromNow(-2) },
    ],
  },
  {
    id: 'g2',
    title: 'Doubles Badminton Night',
    sport: 'badminton',
    hostId: 'p6',
    coHostIds: ['p4'],
    venueId: 'v2',
    startsAt: hoursFromNow(8),
    durationMinutes: 120,
    minPlayers: 4,
    maxPlayers: 8,
    confirmedCount: 6,
    waitlistCount: 0,
    status: 'open',
    visibility: 'public',
    playerShareInr: 150,
    notes: 'Shuttlecocks included. Intermediate+ preferred.',
    skillLevel: 'intermediate',
    groupId: 'grp1',
    players: [
      { playerId: 'p6', status: 'confirmed', joinedAt: hoursFromNow(-30), isHost: true },
      { playerId: 'p4', status: 'confirmed', joinedAt: hoursFromNow(-28), isCoHost: true },
      { playerId: 'p3', status: 'confirmed', joinedAt: hoursFromNow(-15) },
      { playerId: 'p8', status: 'confirmed', joinedAt: hoursFromNow(-9) },
      { playerId: 'p1', status: 'confirmed', joinedAt: hoursFromNow(-5) },
      { playerId: 'p7', status: 'confirmed', joinedAt: hoursFromNow(-3) },
    ],
  },
  {
    id: 'g3',
    title: 'Pickup Basketball',
    sport: 'basketball',
    hostId: 'p3',
    coHostIds: [],
    venueId: 'v3',
    startsAt: hoursFromNow(26),
    durationMinutes: 90,
    minPlayers: 8,
    maxPlayers: 10,
    confirmedCount: 4,
    waitlistCount: 0,
    status: 'open',
    visibility: 'public',
    playerShareInr: 80,
    skillLevel: 'casual',
    notes: 'Half-court runs welcome. Water available on site.',
    players: [
      { playerId: 'p3', status: 'confirmed', joinedAt: hoursFromNow(-40), isHost: true },
      { playerId: 'p5', status: 'confirmed', joinedAt: hoursFromNow(-22) },
      { playerId: 'p7', status: 'confirmed', joinedAt: hoursFromNow(-16) },
      { playerId: 'p4', status: 'confirmed', joinedAt: hoursFromNow(-7) },
    ],
  },
  {
    id: 'g4',
    title: 'Sunday Cricket Nets',
    sport: 'cricket',
    hostId: 'p5',
    coHostIds: [],
    venueId: 'v4',
    startsAt: daysFromNow(3, 7, 30),
    durationMinutes: 120,
    minPlayers: 6,
    maxPlayers: 12,
    confirmedCount: 12,
    waitlistCount: 3,
    status: 'full',
    visibility: 'public',
    playerShareInr: 100,
    skillLevel: 'casual',
    groupId: 'grp2',
    players: [
      { playerId: 'p5', status: 'confirmed', joinedAt: hoursFromNow(-50), isHost: true },
      { playerId: 'p1', status: 'waitlisted', joinedAt: hoursFromNow(-4) },
    ],
  },
  {
    id: 'g5',
    title: 'Private Futsal — Invite Only',
    sport: 'futsal',
    hostId: 'p2',
    coHostIds: [],
    venueId: 'v1',
    startsAt: hoursFromNow(30),
    durationMinutes: 60,
    minPlayers: 8,
    maxPlayers: 10,
    confirmedCount: 7,
    waitlistCount: 0,
    status: 'open',
    visibility: 'private',
    playerShareInr: 140,
    skillLevel: 'competitive',
    notes: 'Invite-only squad. Confirm by chat.',
    players: [
      { playerId: 'p2', status: 'confirmed', joinedAt: hoursFromNow(-24), isHost: true },
    ],
  },
  {
    id: 'g6',
    title: 'Morning Tennis Rally',
    sport: 'tennis',
    hostId: 'p8',
    coHostIds: [],
    venueId: 'v6',
    startsAt: hoursFromNow(14),
    durationMinutes: 90,
    minPlayers: 2,
    maxPlayers: 4,
    confirmedCount: 2,
    waitlistCount: 0,
    status: 'confirmed',
    visibility: 'password',
    hasPassword: true,
    playerShareInr: 250,
    skillLevel: 'intermediate',
    notes: 'Code shared after join request approval.',
    players: [
      { playerId: 'p8', status: 'confirmed', joinedAt: hoursFromNow(-36), isHost: true },
      { playerId: 'p6', status: 'confirmed', joinedAt: hoursFromNow(-20) },
    ],
  },
  {
    id: 'g7',
    title: 'Friday Volleyball',
    sport: 'volleyball',
    hostId: 'p4',
    coHostIds: [],
    venueId: 'v5',
    startsAt: daysFromNow(2, 18, 30),
    durationMinutes: 90,
    minPlayers: 8,
    maxPlayers: 12,
    confirmedCount: 5,
    waitlistCount: 0,
    status: 'open',
    visibility: 'public',
    playerShareInr: null,
    skillLevel: 'casual',
    notes: 'No fee — just show up and play.',
    players: [
      { playerId: 'p4', status: 'confirmed', joinedAt: hoursFromNow(-10), isHost: true },
      { playerId: 'p1', status: 'confirmed', joinedAt: hoursFromNow(-6) },
    ],
  },
  {
    id: 'g8',
    title: 'Confirmed: Koramangala Kickabout',
    sport: 'football',
    hostId: 'p7',
    coHostIds: [],
    venueId: 'v1',
    startsAt: hoursFromNow(4),
    durationMinutes: 90,
    minPlayers: 10,
    maxPlayers: 14,
    confirmedCount: 12,
    waitlistCount: 0,
    status: 'confirmed',
    visibility: 'public',
    playerShareInr: 110,
    skillLevel: 'intermediate',
    notes: 'Roster locked. See you on the turf.',
    players: [
      { playerId: 'p7', status: 'confirmed', joinedAt: hoursFromNow(-48), isHost: true },
      { playerId: 'p1', status: 'confirmed', joinedAt: hoursFromNow(-40) },
      { playerId: 'p2', status: 'confirmed', joinedAt: hoursFromNow(-38) },
    ],
  },
]

export const groups: RecurringGroup[] = [
  {
    id: 'grp1',
    name: 'Indiranagar Badminton Crew',
    sport: 'badminton',
    hostId: 'p6',
    venueId: 'v2',
    pattern: 'custom',
    patternLabel: 'Mon · Wed · Fri',
    timeLabel: '8:00 PM',
    memberCount: 14,
    nextOccurrenceAt: hoursFromNow(8),
    description: 'Steady doubles rotation. Intermediate and up.',
    visibility: 'public',
  },
  {
    id: 'grp2',
    name: 'Sunday Cricket Nets',
    sport: 'cricket',
    hostId: 'p5',
    venueId: 'v4',
    pattern: 'weekly',
    patternLabel: 'Every Sunday',
    timeLabel: '7:30 AM',
    memberCount: 18,
    nextOccurrenceAt: daysFromNow(3, 7, 30),
    description: 'Open nets + light match practice.',
    visibility: 'public',
  },
  {
    id: 'grp3',
    name: 'Daily Turf Run',
    sport: 'football',
    hostId: 'p2',
    venueId: 'v1',
    pattern: 'daily',
    patternLabel: 'Every day',
    timeLabel: '7:00 PM',
    memberCount: 26,
    nextOccurrenceAt: hoursFromNow(19),
    description: 'Show up when you can. Spots fill fast.',
    visibility: 'public',
  },
  {
    id: 'grp4',
    name: 'HSR Hoops Weeknights',
    sport: 'basketball',
    hostId: 'p3',
    venueId: 'v3',
    pattern: 'weekdays',
    patternLabel: 'Tue · Thu',
    timeLabel: '9:00 PM',
    memberCount: 11,
    nextOccurrenceAt: daysFromNow(1, 21, 0),
    description: 'Competitive half-court. Bring water.',
    visibility: 'private',
  },
]

export function getPlayer(id: string): Player | undefined {
  return players.find((p) => p.id === id)
}

export function getVenue(id: string): Venue | undefined {
  return venues.find((v) => v.id === id)
}

export function getGame(id: string): Game | undefined {
  return games.find((g) => g.id === id)
}

export function getGroup(id: string): RecurringGroup | undefined {
  return groups.find((g) => g.id === id)
}

export function getSport(id: Sport): SportMeta {
  return sports.find((s) => s.id === id) ?? sports[0]
}

export function getCurrentUser(): Player {
  return getPlayer(CURRENT_USER_ID)!
}

export function getGamesForPlayer(playerId: string): Game[] {
  return games.filter(
    (g) =>
      g.hostId === playerId ||
      g.coHostIds.includes(playerId) ||
      g.players.some((p) => p.playerId === playerId),
  )
}

export function getNearbyGames(sport?: Sport | 'all'): Game[] {
  const list = [...games]
    .filter((g) => g.status !== 'cancelled' && g.status !== 'completed')
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
  if (!sport || sport === 'all') return list
  return list.filter((g) => g.sport === sport)
}

/** Confirmation deadline is always exactly 3 hours before kickoff */
export function getConfirmationDeadline(startsAt: string): Date {
  return new Date(new Date(startsAt).getTime() - 3 * 60 * 60 * 1000)
}
