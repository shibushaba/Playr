/** Browser-safe place search + map URL helpers for venue creation. */

export interface PlaceSuggestion {
  id: string
  label: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  latitude: number
  longitude: number
  mapUrl: string
  provider: 'google' | 'nominatim' | 'photon' | 'overpass' | 'manual'
  distanceMeters?: number
  distanceLabel?: string
}

export interface PlaceSearchOptions {
  latitude: number
  longitude: number
  /** e.g. "Kozhikode, Kerala" or "Near you" */
  areaLabel?: string
  /** ISO 3166-1 alpha-2 — defaults to in for PLAYR */
  countryCode?: string
  /** Drop results farther than this from bias (default 100 km) */
  maxRadiusMeters?: number
}

const RESULT_LIMIT = 20

const googleKey = () =>
  (import.meta.env.VITE_MAP_PROVIDER_KEY as string | undefined)?.trim() || ''

export function hasMapProviderKey(): boolean {
  return Boolean(googleKey())
}

/** Canonical map URL from exact coordinates. */
export function mapsUrlFromCoords(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}

/** Turn-by-turn directions in Google Maps (works on mobile deep link). */
export function directionsUrlFromCoords(
  latitude: number,
  longitude: number,
): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
}

export function resolveVenueDirectionsUrl(venue: {
  latitude: number | null
  longitude: number | null
  mapUrl?: string | null
}): string | null {
  if (venue.latitude != null && venue.longitude != null) {
    return directionsUrlFromCoords(venue.latitude, venue.longitude)
  }
  if (venue.mapUrl && isSafeHttpUrl(venue.mapUrl)) {
    return venue.mapUrl.trim()
  }
  return null
}

export function resolveVenueMapViewUrl(venue: {
  latitude: number | null
  longitude: number | null
  mapUrl?: string | null
}): string | null {
  if (venue.mapUrl && isSafeHttpUrl(venue.mapUrl)) {
    return venue.mapUrl.trim()
  }
  if (venue.latitude != null && venue.longitude != null) {
    return mapsUrlFromCoords(venue.latitude, venue.longitude)
  }
  return null
}

export function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export interface ParsedMapUrl {
  latitude: number
  longitude: number
  mapUrl: string
  name: string | null
}

function validCoords(latitude: number, longitude: number): boolean {
  return (
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

function parseCoordPair(value: string): { lat: number; lng: number } | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (!validCoords(lat, lng)) return null
  return { lat, lng }
}

function googlePlaceNameFromPath(pathname: string): string | null {
  const match = pathname.match(/\/place\/([^/]+)/)
  if (!match) return null
  return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim() || null
}

/** Extract coordinates (+ optional place name) from a shared map link. */
export function parseMapUrl(raw: string): ParsedMapUrl | null {
  const trimmed = raw.trim()
  if (!isSafeHttpUrl(trimmed)) return null

  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, '')
    const haystack = `${url.pathname}${url.search}${url.hash}`

    const precise = trimmed.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
    if (precise) {
      const latitude = Number(precise[1])
      const longitude = Number(precise[2])
      if (validCoords(latitude, longitude)) {
        return {
          latitude,
          longitude,
          mapUrl: trimmed,
          name: googlePlaceNameFromPath(url.pathname),
        }
      }
    }

    for (const key of ['q', 'query', 'll', 'center']) {
      const value = url.searchParams.get(key)
      if (!value) continue
      const coords = parseCoordPair(value)
      if (coords) {
        return {
          latitude: coords.lat,
          longitude: coords.lng,
          mapUrl: trimmed,
          name: googlePlaceNameFromPath(url.pathname),
        }
      }
    }

    const atMatch = haystack.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    if (atMatch) {
      const latitude = Number(atMatch[1])
      const longitude = Number(atMatch[2])
      if (validCoords(latitude, longitude)) {
        return {
          latitude,
          longitude,
          mapUrl: trimmed,
          name: googlePlaceNameFromPath(url.pathname),
        }
      }
    }

    if (host.includes('openstreetmap.org')) {
      const lat = url.searchParams.get('mlat')
      const lon = url.searchParams.get('mlon')
      if (lat && lon) {
        const latitude = Number(lat)
        const longitude = Number(lon)
        if (validCoords(latitude, longitude)) {
          return { latitude, longitude, mapUrl: trimmed, name: null }
        }
      }
    }

    if (host.includes('apple.com')) {
      const ll = url.searchParams.get('ll')
      if (ll) {
        const coords = parseCoordPair(ll)
        if (coords) {
          return {
            latitude: coords.lat,
            longitude: coords.lng,
            mapUrl: trimmed,
            name: url.searchParams.get('q'),
          }
        }
      }
    }

    return null
  } catch {
    return null
  }
}

export function placeFromMapUrl(
  raw: string,
  fallbackName?: string,
): PlaceSuggestion | null {
  const parsed = parseMapUrl(raw)
  if (!parsed) return null

  const name =
    parsed.name?.trim() ||
    fallbackName?.trim() ||
    'Pinned location'

  return {
    id: `manual-${parsed.latitude.toFixed(5)},${parsed.longitude.toFixed(5)}`,
    label: name,
    name,
    address: null,
    city: null,
    state: null,
    country: null,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    mapUrl: parsed.mapUrl,
    provider: 'manual',
  }
}

export function mapUrlParseHint(): string {
  return 'Paste a Google Maps share link that includes the pin (Share → Copy link). Short links may not work — open the place first, then copy the full URL from your browser.'
}

function cityFromAddress(parts: Record<string, string | undefined>): string | null {
  return (
    parts.city ||
    parts.town ||
    parts.village ||
    parts.suburb ||
    parts.county ||
    parts.state_district ||
    null
  )
}

function displayNameHead(display: string): string {
  return display.split(',')[0]?.trim() || display
}

function haversineMeters(
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

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`
}

/** City/area name from discovery label (skip generic GPS label). */
export function areaNameFromLabel(label: string | undefined): string | null {
  if (!label) return null
  const lower = label.toLowerCase()
  if (
    lower === 'near you' ||
    lower === 'finding you…' ||
    lower === 'choose area'
  ) {
    return null
  }
  return label.split(',')[0]?.trim() || null
}

function viewboxAround(lat: number, lon: number, deltaDeg: number) {
  return {
    minLon: lon - deltaDeg,
    maxLat: lat + deltaDeg,
    maxLon: lon + deltaDeg,
    minLat: lat - deltaDeg,
  }
}

function rankByProximity(
  results: PlaceSuggestion[],
  origin: { latitude: number; longitude: number },
  maxRadiusMeters: number,
): PlaceSuggestion[] {
  return results
    .map((r) => {
      const distanceMeters = haversineMeters(
        origin.latitude,
        origin.longitude,
        r.latitude,
        r.longitude,
      )
      return {
        ...r,
        distanceMeters,
        distanceLabel: formatDistance(distanceMeters),
      }
    })
    .filter((r) => r.distanceMeters <= maxRadiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
}

function dedupeKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`
}

function mergeRankedResults(
  batches: PlaceSuggestion[][],
  origin: { latitude: number; longitude: number },
  maxRadiusMeters: number,
  limit = RESULT_LIMIT,
): PlaceSuggestion[] {
  const seen = new Set<string>()
  const merged: PlaceSuggestion[] = []

  for (const batch of batches) {
    for (const row of batch) {
      const key = dedupeKey(row.latitude, row.longitude)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(row)
    }
  }

  return rankByProximity(merged, origin, maxRadiusMeters).slice(0, limit)
}

function searchQueriesFor(query: string, areaName: string | null): string[] {
  const base = query.trim()
  const out = new Set<string>([base])

  if (areaName && !base.toLowerCase().includes(areaName.toLowerCase())) {
    out.add(`${base} ${areaName}`)
    out.add(`${base}, ${areaName}`)
  }

  const lower = base.toLowerCase()
  const turfHints = ['turf', 'ground', 'arena', 'stadium', 'sports']
  const hasHint = turfHints.some((h) => lower.includes(h))
  if (!hasHint) {
    out.add(`${base} turf`)
    out.add(`${base} football ground`)
  }

  return [...out].slice(0, 4)
}

type NominatimRow = {
  place_id: number
  display_name: string
  lat: string
  lon: string
  name?: string
  address?: Record<string, string>
}

function mapNominatimRow(row: NominatimRow): PlaceSuggestion {
  const latitude = Number(row.lat)
  const longitude = Number(row.lon)
  const addr = row.address ?? {}
  const name =
    row.name ||
    addr.amenity ||
    addr.leisure ||
    addr.sport ||
    addr.building ||
    displayNameHead(row.display_name)
  return {
    id: `osm-${row.place_id}`,
    label: row.display_name,
    name,
    address: row.display_name,
    city: cityFromAddress(addr),
    state: addr.state ?? null,
    country: addr.country ?? null,
    latitude,
    longitude,
    mapUrl: mapsUrlFromCoords(latitude, longitude),
    provider: 'nominatim',
  }
}

async function fetchNominatim(
  q: string,
  opts: {
    bounded?: boolean
    viewbox?: { minLon: number; maxLat: number; maxLon: number; minLat: number }
    countryCode?: string
    limit?: number
  },
): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: String(opts.limit ?? 20),
  })

  if (opts.countryCode) {
    params.set('countrycodes', opts.countryCode)
  }

  if (opts.viewbox) {
    const { minLon, maxLat, maxLon, minLat } = opts.viewbox
    params.set('viewbox', `${minLon},${maxLat},${maxLon},${minLat}`)
    if (opts.bounded) params.set('bounded', '1')
  }

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: { Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error('Place search failed. Try again.')
  const data = (await res.json()) as NominatimRow[]
  return data.map(mapNominatimRow)
}

async function searchNominatim(
  query: string,
  options: PlaceSearchOptions,
): Promise<PlaceSuggestion[]> {
  const countryCode = options.countryCode ?? 'in'
  const areaName = areaNameFromLabel(options.areaLabel)
  const { latitude, longitude } = options
  const wideBox = viewboxAround(latitude, longitude, 0.9)

  const queries = searchQueriesFor(query, areaName)
  const seen = new Set<string>()
  const merged: PlaceSuggestion[] = []

  for (const q of queries) {
    const batch = await fetchNominatim(q, {
      bounded: true,
      viewbox: wideBox,
      countryCode,
      limit: 15,
    })
    for (const row of batch) {
      const key = dedupeKey(row.latitude, row.longitude)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(row)
    }
  }

  return merged
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_id?: number
    osm_type?: string
    name?: string
    city?: string
    state?: string
    country?: string
    street?: string
    housenumber?: string
    postcode?: string
    district?: string
  }
}

async function searchPhoton(
  query: string,
  options: PlaceSearchOptions,
): Promise<PlaceSuggestion[]> {
  const areaName = areaNameFromLabel(options.areaLabel)
  const queries = searchQueriesFor(query, areaName)
  const seen = new Set<string>()
  const merged: PlaceSuggestion[] = []

  for (const q of queries) {
    const params = new URLSearchParams({
      q,
      lat: String(options.latitude),
      lon: String(options.longitude),
      limit: '15',
      lang: 'en',
    })

    const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`)
    if (!res.ok) continue

    const data = (await res.json()) as { features?: PhotonFeature[] }
    for (const feature of data.features ?? []) {
      const [longitude, latitude] = feature.geometry.coordinates
      const p = feature.properties
      const name = p.name?.trim()
      if (!name) continue

      const key = dedupeKey(latitude, longitude)
      if (seen.has(key)) continue
      seen.add(key)

      const street = [p.housenumber, p.street].filter(Boolean).join(' ')
      const addressParts = [street, p.district, p.city, p.state, p.country].filter(
        Boolean,
      )
      const address = addressParts.join(', ') || null

      merged.push({
        id: `photon-${p.osm_type ?? 'node'}-${p.osm_id ?? key}`,
        label: address ? `${name} — ${address}` : name,
        name,
        address,
        city: p.city ?? p.district ?? null,
        state: p.state ?? null,
        country: p.country ?? null,
        latitude,
        longitude,
        mapUrl: mapsUrlFromCoords(latitude, longitude),
        provider: 'photon',
      })
    }
  }

  return merged
}

function escapeOverpassRegex(value: string): string {
  return value.replace(/[\\.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 48)
}

type OverpassElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

async function searchOverpassSports(
  query: string,
  options: PlaceSearchOptions,
): Promise<PlaceSuggestion[]> {
  const { latitude, longitude } = options
  const radius = Math.min(options.maxRadiusMeters ?? 100_000, 50_000)
  const pattern = escapeOverpassRegex(query.trim())
  if (pattern.length < 2) return []

  const overpass = `
[out:json][timeout:25];
(
  nwr(around:${radius},${latitude},${longitude})["name"~"${pattern}",i]["leisure"~"pitch|sports_centre|stadium|track"];
  nwr(around:${radius},${latitude},${longitude})["name"~"${pattern}",i]["amenity"~"sports_centre|stadium"];
  nwr(around:${radius},${latitude},${longitude})["name"~"${pattern}",i]["sport"];
  nwr(around:${radius},${latitude},${longitude})["name"~"${pattern}",i]["shop"="sports"];
);
out center 25;
`.trim()

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(overpass)}`,
  })
  if (!res.ok) return []

  const data = (await res.json()) as { elements?: OverpassElement[] }
  const seen = new Set<string>()
  const results: PlaceSuggestion[] = []

  for (const el of data.elements ?? []) {
    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon
    const tags = el.tags ?? {}
    const name = tags.name?.trim()
    if (lat == null || lon == null || !name) continue

    const key = dedupeKey(lat, lon)
    if (seen.has(key)) continue
    seen.add(key)

    const addressParts = [
      tags['addr:street'],
      tags['addr:city'] || tags['addr:suburb'],
      tags['addr:state'],
      tags['addr:country'],
    ].filter(Boolean)

    results.push({
      id: `overpass-${el.type}-${el.id}`,
      label: addressParts.length ? `${name} — ${addressParts.join(', ')}` : name,
      name,
      address: addressParts.join(', ') || null,
      city: tags['addr:city'] ?? tags['addr:suburb'] ?? null,
      state: tags['addr:state'] ?? null,
      country: tags['addr:country'] ?? null,
      latitude: lat,
      longitude: lon,
      mapUrl: mapsUrlFromCoords(lat, lon),
      provider: 'overpass',
    })
  }

  return results
}

let googleMapsLoad: Promise<typeof google.maps> | null = null

function loadGoogleMaps(): Promise<typeof google.maps> {
  const key = googleKey()
  if (!key) return Promise.reject(new Error('no key'))

  if (googleMapsLoad) return googleMapsLoad

  googleMapsLoad = new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve(window.google.maps)
      return
    }

    const cbName = '__playrGoogleMapsInit'
    ;(window as unknown as Record<string, () => void>)[cbName] = () => {
      if (window.google?.maps) resolve(window.google.maps)
      else reject(new Error('Google Maps failed to load'))
      delete (window as unknown as Record<string, unknown>)[cbName]
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=${cbName}`
    script.async = true
    script.onerror = () => reject(new Error('Google Maps script failed'))
    document.head.appendChild(script)
  })

  return googleMapsLoad
}

function mapGooglePlace(row: google.maps.places.PlaceResult): PlaceSuggestion | null {
  const latitude = row.geometry?.location?.lat()
  const longitude = row.geometry?.location?.lng()
  const name = row.name?.trim()
  if (latitude == null || longitude == null || !name) return null

  const formatted = row.formatted_address ?? row.vicinity ?? null
  const cityGuess =
    formatted?.split(',').slice(-3, -2)[0]?.trim() || null

  return {
    id: row.place_id ?? `google-${latitude},${longitude}`,
    label: formatted ? `${name} — ${formatted}` : name,
    name,
    address: formatted,
    city: cityGuess,
    state: null,
    country: null,
    latitude,
    longitude,
    mapUrl: row.place_id
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(row.place_id)}`
      : mapsUrlFromCoords(latitude, longitude),
    provider: 'google',
  }
}

function googleTextSearchPages(
  service: google.maps.places.PlacesService,
  request: google.maps.places.TextSearchRequest,
  maxPages: number,
): Promise<google.maps.places.PlaceResult[]> {
  return new Promise((resolve) => {
    const acc: google.maps.places.PlaceResult[] = []
    let pages = 0

    const handle = (
      results: google.maps.places.PlaceResult[] | null,
      status: string,
      pagination?: google.maps.places.PlaceSearchPagination | null,
    ) => {
      if (status === 'OK' && results?.length) {
        acc.push(...results)
      }

      if (pagination?.hasNextPage && pages < maxPages - 1) {
        pages += 1
        window.setTimeout(() => pagination.nextPage(), 1200)
        return
      }

      resolve(acc)
    }

    service.textSearch(request, handle)
  })
}

async function searchGoogleJs(
  query: string,
  options: PlaceSearchOptions,
): Promise<PlaceSuggestion[]> {
  const maps = await loadGoogleMaps()
  const host = document.createElement('div')
  const service = new maps.places.PlacesService(host)
  const location = new maps.LatLng(options.latitude, options.longitude)
  const areaName = areaNameFromLabel(options.areaLabel)
  const queries = searchQueriesFor(query, areaName)

  const seen = new Set<string>()
  const merged: PlaceSuggestion[] = []

  for (const q of queries) {
    const rows = await googleTextSearchPages(
      service,
      {
        query: q,
        location,
        radius: 50_000,
        region: options.countryCode ?? 'in',
      },
      2,
    )

    for (const row of rows) {
      const mapped = mapGooglePlace(row)
      if (!mapped) continue
      const key = dedupeKey(mapped.latitude, mapped.longitude)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(mapped)
    }
  }

  return merged
}

async function safeSearch(
  fn: () => Promise<PlaceSuggestion[]>,
): Promise<PlaceSuggestion[]> {
  try {
    return await fn()
  } catch {
    return []
  }
}

/**
 * Search places near the user's discovery location.
 * Merges Google Places (when keyed), Photon, Overpass sports POIs, and Nominatim.
 */
export async function searchPlaces(
  query: string,
  options?: PlaceSearchOptions,
): Promise<PlaceSuggestion[]> {
  const q = query.trim()
  if (q.length < 2) return []

  if (!options) {
    return (await fetchNominatim(q, { countryCode: 'in', limit: 15 })).slice(
      0,
      RESULT_LIMIT,
    )
  }

  const maxRadius = options.maxRadiusMeters ?? 100_000
  const tasks: Array<Promise<PlaceSuggestion[]>> = [
    safeSearch(() => searchNominatim(q, options)),
    safeSearch(() => searchPhoton(q, options)),
    safeSearch(() => searchOverpassSports(q, options)),
  ]

  if (hasMapProviderKey()) {
    tasks.unshift(safeSearch(() => searchGoogleJs(q, options)))
  }

  const batches = await Promise.all(tasks)
  return mergeRankedResults(batches, options, maxRadius, RESULT_LIMIT)
}

export function osmEmbedUrl(latitude: number, longitude: number): string {
  const d = 0.01
  const bbox = `${longitude - d},${latitude - d},${longitude + d},${latitude + d}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude}%2C${longitude}`
}
