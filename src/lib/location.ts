export type LocationPermission =
  | 'idle'
  | 'prompting'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'unsupported'

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface ManualArea {
  id: string
  name: string
  state: string | null
  country: string
  latitude: number
  longitude: number
  gameCount?: number
  venueCount?: number
}

export interface DiscoveryLocation {
  source: 'gps' | 'manual'
  label: string
  coords: Coordinates
  /** Approximate only — never sent to other users */
  accuracyMeters?: number | null
}

export const DEFAULT_RADIUS_METERS = 10_000

export const RADIUS_OPTIONS = [
  { label: '2 km', meters: 2_000 },
  { label: '5 km', meters: 5_000 },
  { label: '10 km', meters: 10_000 },
  { label: '25 km', meters: 25_000 },
] as const

export function formatDistanceMeters(meters: number | null | undefined): string {
  if (meters == null || Number.isNaN(meters)) return ''
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`
}

/** Server check-in geofence — keep in sync with check_in_with_location default. */
export const CHECK_IN_RADIUS_METERS = 250

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
