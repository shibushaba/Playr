import { Header } from '@/components/layout/Header'
import { VenueCard } from '@/components/venue/VenueCard'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SearchBar } from '@/components/ui/SearchBar'
import { useLocationDiscovery } from '@/contexts/LocationContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { toUserMessage } from '@/lib/errors'
import { getNearbyVenues } from '@/services/discovery'
import { getVenue, listVenues } from '@/services/venues'
import type { VenueRecord } from '@/types/domain'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

export function VenueSelectPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const createdVenueId = params.get('venueId')
  const { location, radiusMeters } = useLocationDiscovery()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [selected, setSelected] = useState<string | null>(createdVenueId)
  const [venues, setVenues] = useState<VenueRecord[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (createdVenueId) setSelected(createdVenueId)
  }, [createdVenueId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        let list: VenueRecord[] = []
        if (location) {
          list = await getNearbyVenues({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            radiusMeters: Math.max(radiusMeters, 25_000),
            search: debouncedQuery.trim() || null,
            limit: 40,
          })
        } else {
          list = await listVenues()
        }

        if (createdVenueId && !list.some((v) => v.id === createdVenueId)) {
          const created = await getVenue(createdVenueId)
          if (created) list = [created, ...list]
        }

        if (!cancelled) setVenues(list)
      } catch (e) {
        if (!cancelled) setError(toUserMessage(e, "Couldn't load venues. Try again."))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [location, radiusMeters, debouncedQuery, createdVenueId])

  return (
    <div>
      <Header title="Select venue" backTo="/host" subtitle="Nearby first" />
      <div className="page-pad space-y-4 py-5">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search venues near you"
        />
        {error ? (
          <p className="glass px-3 py-2 text-[13px] text-white/80">{error}</p>
        ) : null}
        <div className="space-y-2 pb-28">
          {venues.map((v) => (
            <VenueCard
              key={v.id}
              venue={v}
              selected={selected === v.id}
              onClick={() => setSelected(v.id)}
            />
          ))}
        </div>
      </div>
      <div
        className="glass-nav fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 rounded-[12px] p-4 lg:bottom-4 lg:left-[calc(13rem+0.75rem)] lg:right-3"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <PrimaryButton
            fullWidth
            disabled={!selected}
            onClick={() =>
              navigate(selected ? `/host?venueId=${selected}` : '/host')
            }
          >
            Use selected venue →
          </PrimaryButton>
          <Link
            to="/venues/new?returnTo=venue-select"
            className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-white/45 transition hover:text-white"
          >
            Can&apos;t find it? Add a venue
          </Link>
        </div>
      </div>
    </div>
  )
}
