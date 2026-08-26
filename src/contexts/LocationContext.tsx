import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

function readStoredManual(): DiscoveryLocation | null {
  try {
    const raw = localStorage.getItem(MANUAL_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DiscoveryLocation
  } catch {
    return null
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [permission, setPermission] = useState<LocationPermission>('idle')
  const [location, setLocation] = useState<DiscoveryLocation | null>(null)
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS)
  const [areas, setAreas] = useState<ManualArea[]>([])
  const [areasLoading, setAreasLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)

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
    setLocation(next)
    setPermission('denied')
    setPickerOpen(false)
    try {
      localStorage.setItem(MANUAL_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }, [])

  const requestGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPermission('unsupported')
      const stored = readStoredManual()
      if (stored) setLocation(stored)
      else setPickerOpen(true)
      return
    }

    setPermission('prompting')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPermission('granted')
        setLocation({
          source: 'gps',
          label: 'Near you',
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
          accuracyMeters: pos.coords.accuracy,
        })
        try {
          localStorage.removeItem(MANUAL_KEY)
        } catch {
          /* ignore */
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermission('denied')
        else setPermission('unavailable')
        const stored = readStoredManual()
        if (stored) {
          setLocation(stored)
        } else {
          setPickerOpen(true)
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: 60_000,
      },
    )
  }, [])

  const clearManualAndRetry = useCallback(() => {
    try {
      localStorage.removeItem(MANUAL_KEY)
    } catch {
      /* ignore */
    }
    requestGps()
  }, [requestGps])

  useEffect(() => {
    const stored = readStoredManual()
    if (stored) {
      setLocation(stored)
      setPermission('denied')
      return
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
      requestGps,
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
