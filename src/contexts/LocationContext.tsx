import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_RADIUS_METERS,
  type DiscoveryLocation,
  type LocationPermission,
  type ManualArea,
} from '@/lib/location'
import { listDiscoveryAreas } from '@/services/discovery'

interface LocationContextValue {
  permission: LocationPermission
  location: DiscoveryLocation | null
  radiusMeters: number
  setRadiusMeters: (meters: number) => void
  areas: ManualArea[]
  areasLoading: boolean
  refreshAreas: () => void
  requestGps: () => void
  chooseManualArea: (area: ManualArea) => void
  clearManualAndRetry: () => void
  pickerOpen: boolean
  setPickerOpen: (open: boolean) => void
}

const LocationContext = createContext<LocationContextValue | null>(null)

const MANUAL_KEY = 'playr.manualArea'
const GPS_CACHE_KEY = 'playr.lastGps'
const GPS_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

function isValidLocation(value: unknown): value is DiscoveryLocation {
  if (!value || typeof value !== 'object') return false
  const loc = value as DiscoveryLocation
  return (
    (loc.source === 'gps' || loc.source === 'manual') &&
    typeof loc.label === 'string' &&
    typeof loc.coords?.latitude === 'number' &&
    typeof loc.coords?.longitude === 'number' &&
    Number.isFinite(loc.coords.latitude) &&
    Number.isFinite(loc.coords.longitude)
  )
}

function readStoredManual(): DiscoveryLocation | null {
  try {
    const raw = localStorage.getItem(MANUAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return isValidLocation(parsed) ? parsed : null
  } catch {
    return null
  }
}

function readGpsCache(): DiscoveryLocation | null {
  try {
    const raw = localStorage.getItem(GPS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      coords?: { latitude: number; longitude: number }
      accuracyMeters?: number | null
      at?: number
    }
    if (
      typeof parsed?.coords?.latitude !== 'number' ||
      typeof parsed?.coords?.longitude !== 'number' ||
      !Number.isFinite(parsed.coords.latitude) ||
      !Number.isFinite(parsed.coords.longitude)
    ) {
      return null
    }
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > GPS_CACHE_MAX_AGE_MS) {
      return null
    }
    return {
      source: 'gps',
      label: 'Near you',
      coords: parsed.coords,
      accuracyMeters: parsed.accuracyMeters ?? null,
    }
  } catch {
    return null
  }
}

function writeGpsCache(loc: DiscoveryLocation) {
  if (loc.source !== 'gps') return
  try {
    localStorage.setItem(
      GPS_CACHE_KEY,
      JSON.stringify({
        coords: loc.coords,
        accuracyMeters: loc.accuracyMeters ?? null,
        at: Date.now(),
      }),
    )
  } catch {
    /* ignore */
  }
}

function getCurrentPosition(
  options: PositionOptions,
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

async function readGpsPosition(): Promise<GeolocationPosition> {
  try {
    return await getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 8_000,
      maximumAge: 5 * 60_000,
    })
  } catch {
    return getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 18_000,
      maximumAge: 0,
    })
  }
}

function locationFromPosition(pos: GeolocationPosition): DiscoveryLocation {
  return {
    source: 'gps',
    label: 'Near you',
    coords: {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    },
    accuracyMeters: pos.coords.accuracy,
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [permission, setPermission] = useState<LocationPermission>('idle')
  const [location, setLocation] = useState<DiscoveryLocation | null>(null)
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS)
  const [areas, setAreas] = useState<ManualArea[]>([])
  const [areasLoading, setAreasLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const preferManualRef = useRef(false)

  useEffect(() => {
    void listDiscoveryAreas()
      .then(setAreas)
      .catch(() => setAreas([]))
      .finally(() => setAreasLoading(false))
  }, [])

  const refreshAreas = useCallback(() => {
    setAreasLoading(true)
    void listDiscoveryAreas()
      .then(setAreas)
      .catch(() => setAreas([]))
      .finally(() => setAreasLoading(false))
  }, [])

  const chooseManualArea = useCallback((area: ManualArea) => {
    const next: DiscoveryLocation = {
      source: 'manual',
      label: area.state ? `${area.name}, ${area.state}` : area.name,
      coords: { latitude: area.latitude, longitude: area.longitude },
    }
    preferManualRef.current = true
    setLocation(next)
    setPermission('denied')
    setPickerOpen(false)
    try {
      localStorage.setItem(MANUAL_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }, [])

  const requestGps = useCallback((opts?: { force?: boolean }) => {
    const force = opts?.force === true
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPermission('unsupported')
      const stored = readStoredManual() ?? readGpsCache()
      if (stored) setLocation(stored)
      else setPickerOpen(true)
      return
    }

    setPermission('prompting')
    void readGpsPosition()
      .then((pos) => {
        const next = locationFromPosition(pos)
        writeGpsCache(next)
        if (!force && preferManualRef.current) {
          setPermission('denied')
          return
        }
        preferManualRef.current = false
        try {
          localStorage.removeItem(MANUAL_KEY)
        } catch {
          /* ignore */
        }
        setPermission('granted')
        setLocation(next)
        setPickerOpen(false)
      })
      .catch((err: GeolocationPositionError | unknown) => {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? (err as GeolocationPositionError).code
            : null
        if (code === 1) setPermission('denied')
        else setPermission('unavailable')

        if (preferManualRef.current && readStoredManual()) {
          setLocation(readStoredManual())
          return
        }

        const cached = readGpsCache()
        const stored = readStoredManual()
        if (cached) {
          setLocation(cached)
          return
        }
        if (stored) {
          setLocation(stored)
          return
        }
        setPickerOpen(true)
      })
  }, [])

  const clearManualAndRetry = useCallback(() => {
    preferManualRef.current = false
    try {
      localStorage.removeItem(MANUAL_KEY)
    } catch {
      /* ignore */
    }
    requestGps({ force: true })
  }, [requestGps])

  useEffect(() => {
    const stored = readStoredManual()
    const cached = readGpsCache()
    if (stored) {
      preferManualRef.current = true
      setLocation(stored)
      setPermission('denied')
    } else if (cached) {
      setLocation(cached)
      setPermission('granted')
    }
    requestGps()
  }, [requestGps])

  const value = useMemo(
    () => ({
      permission,
      location,
      radiusMeters,
      setRadiusMeters,
      areas,
      areasLoading,
      refreshAreas,
      requestGps: () => requestGps({ force: true }),
      chooseManualArea,
      clearManualAndRetry,
      pickerOpen,
      setPickerOpen,
    }),
    [
      permission,
      location,
      radiusMeters,
      areas,
      areasLoading,
      refreshAreas,
      requestGps,
      chooseManualArea,
      clearManualAndRetry,
      pickerOpen,
    ],
  )

  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  )
}

export function useLocationDiscovery(): LocationContextValue {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocationDiscovery must be used within LocationProvider')
  return ctx
}
