import { FadeIn } from '@/components/motion/FadeIn'
import { MotionTextLink } from '@/components/motion/MotionLink'
import { PageContent } from '@/components/motion/PageContent'
import { LoadingBlock } from '@/components/motion/LoadingBlock'
import { FilterSheet, type FilterState } from '@/components/filters/FilterSheet'
import { GameCard } from '@/components/game/GameCard'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { LocationPickerSheet } from '@/components/location/LocationPickerSheet'
import { SportChip } from '@/components/sport/SportChip'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { VenueCard } from '@/components/venue/VenueCard'
import { useAuth } from '@/contexts/AuthContext'
import { useLocationDiscovery } from '@/contexts/LocationContext'
import { toUserMessage } from '@/lib/errors'
import { DEFAULT_RADIUS_METERS } from '@/lib/location'
import { isSupabaseConfigured } from '@/lib/supabase'
import { getNearbyGames, getNearbyVenues } from '@/services/discovery'
import { listSports } from '@/services/sports'
import type { GameListItem, SportRecord, VenueRecord } from '@/types/domain'
import { ChevronDown, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function dateRangeFromFilter(filters: FilterState): {
  gameDate?: string
  dateFrom?: string
  dateTo?: string
} {
  const today = new Date()
  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  if (filters.when === 'today') return { gameDate: ymd(today) }
  if (filters.when === 'tomorrow') {
    const t = new Date(today)
    t.setDate(t.getDate() + 1)
    return { gameDate: ymd(t) }
  }
  if (filters.when === 'weekend') {
    const day = today.getDay()
    const toSat = (6 - day + 7) % 7
    const sat = new Date(today)
    sat.setDate(today.getDate() + toSat)
    const sun = new Date(sat)
    sun.setDate(sat.getDate() + 1)
    return { dateFrom: ymd(sat), dateTo: ymd(sun) }
  }
  if (filters.when === 'choose' && filters.chooseDate) {
    return { gameDate: filters.chooseDate }
  }
  return {}
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning.'
  if (h < 17) return 'Good afternoon.'
  return 'Good evening.'
}

export function HomePage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const {
    location,
    permission,
    radiusMeters,
    setRadiusMeters,
    setPickerOpen,
  } = useLocationDiscovery()
  const [sportId, setSportId] = useState<string | 'all'>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    sport: 'all',
    status: 'all',
    when: 'any',
    chooseDate: null,
    timeBucket: 'any',
    radiusMeters: DEFAULT_RADIUS_METERS,
  })
  const [sports, setSports] = useState<SportRecord[]>([])
  const [games, setGames] = useState<GameListItem[]>([])
  const [venues, setVenues] = useState<VenueRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(20)

  const activeSport = filters.sport !== 'all' ? filters.sport : sportId
  const effectiveRadius = filters.radiusMeters || radiusMeters

  useEffect(() => {
    void listSports().then(setSports).catch(() => setSports([]))
  }, [])

  useEffect(() => {
    setFilters((f) => ({ ...f, radiusMeters }))
  }, [radiusMeters])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!isSupabaseConfigured) {
        setError('Supabase is not configured.')
        setLoading(false)
        return
      }
      if (!location) {
        setLoading(permission === 'prompting' || permission === 'idle')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const dates = dateRangeFromFilter(filters)
        const [gamesData, venuesData] = await Promise.all([
          getNearbyGames({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            radiusMeters: effectiveRadius,
            sportId: activeSport === 'all' ? null : activeSport,
            timeBucket: filters.timeBucket === 'any' ? null : filters.timeBucket,
            limit,
            ...dates,
          }),
          getNearbyVenues({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            radiusMeters: effectiveRadius,
            limit: 6,
          }),
        ])
        if (cancelled) return
        let list = gamesData
        if (filters.status !== 'all') {
          list = list.filter((g) => g.status === filters.status)
        }
        setGames(list)
        setVenues(venuesData)
      } catch (e) {
        if (!cancelled) setError(toUserMessage(e, "Couldn't find nearby games."))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [
    location,
    permission,
    activeSport,
    effectiveRadius,
    filters.when,
    filters.chooseDate,
    filters.timeBucket,
    filters.status,
    limit,
  ])

  const greetName =
    profile?.display_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    null

  const locationLabel = useMemo(() => {
    if (location?.source === 'manual') return location.label
    if (location?.source === 'gps') return location.label
    if (permission === 'prompting') return 'Finding you…'
    return 'Choose area'
  }, [location, permission])

  const isGps = location?.source === 'gps'

  const featuredGame = games[0] ?? null
  const moreGames = games.slice(1)

  return (
    <div className="pb-8">
      <header className="page-pad border-b border-white/10 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <FadeIn>
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label={`Change location, currently ${locationLabel}`}
            className="min-h-11 flex-1 text-left"
          >
            <p className="label-caps">
              {greeting()}
              {greetName ? ` ${greetName}` : ''}
            </p>
            <span className="group mt-1 inline-flex items-center gap-1.5 text-[16px] font-semibold tracking-tight text-white transition hover:text-white/80">
              {locationLabel}
              <ChevronDown className="motion-icon-chevron h-4 w-4 text-white/50" />
            </span>
            {isGps ? (
              <span className="mt-0.5 block text-[11px] text-white/40">
                Using your location
              </span>
            ) : location?.source === 'manual' ? (
              <span className="mt-0.5 block text-[11px] text-white/40">
                Manual area
              </span>
            ) : null}
          </button>
          <NotificationBell />
        </div>

        {(permission === 'denied' || permission === 'unavailable') && !location ? (
          <div className="glass mt-4 p-4">
            <p className="text-[14px] font-medium text-white">Location is off</p>
            <p className="mt-1 text-[13px] text-white/45">
              Choose an area to see nearby games.
            </p>
            <PrimaryButton className="mt-3" onClick={() => setPickerOpen(true)}>
              Choose area
            </PrimaryButton>
          </div>
        ) : null}

        <Link
          to="/explore"
          className="glass motion-glass mt-4 flex min-h-12 items-center gap-3 px-4 text-left transition hover:border-white/20"
        >
          <Search className="h-4 w-4 shrink-0 text-white/40" strokeWidth={1.75} aria-hidden />
          <span className="text-[15px] text-white/35">Search games, venues, sports…</span>
        </Link>
        </FadeIn>
      </header>

      <PageContent>
      <FadeIn delay={50}>
      <section className="page-pad mt-6">
        <div className="chip-scroll-row chip-scroll-row--bleed flex gap-2 scrollbar-none">
          <SportChip
            sport={{ id: 'all', name: 'All', slug: 'all', label: 'All' }}
            selected={activeSport === 'all'}
            tile
            onClick={() => {
              setSportId('all')
              setFilters((f) => ({ ...f, sport: 'all' }))
            }}
          />
          {sports.map((s) => (
            <SportChip
              key={s.id}
              sport={s}
              selected={activeSport === s.id}
              tile
              onClick={() => {
                setSportId(s.id)
                setFilters((f) => ({ ...f, sport: s.id }))
              }}
            />
          ))}
        </div>
      </section>
      </FadeIn>

      <FadeIn delay={80}>
      <section className="page-pad mt-10">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="section-label">Nearby</h2>
            <p className="mt-1 text-[13px] text-white/45">
              {loading ? 'Loading…' : 'Tonight and upcoming'}
            </p>
          </div>
          <MotionTextLink onClick={() => setFiltersOpen(true)}>Filter</MotionTextLink>
        </div>

        {error ? (
          <EmptyState
            title="Something went wrong."
            description={error}
            action={
              <PrimaryButton onClick={() => setLimit((n) => n)}>
                Retry
              </PrimaryButton>
            }
          />
        ) : loading ? (
          <LoadingBlock className="min-h-48" />
        ) : games.length === 0 ? (
          <EmptyState
            title="No games near you"
            description="No pickup games in this area right now. Search farther out, or host when you have a venue."
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link to="/explore">
                  <PrimaryButton>Search nearby</PrimaryButton>
                </Link>
                <Link to="/host">
                  <PrimaryButton variant="outline">Host instead</PrimaryButton>
                </Link>
              </div>
            }
          />
        ) : (
          <>
            {featuredGame ? (
              <GameCard game={featuredGame} featured />
            ) : null}

            {moreGames.length > 0 ? (
              <div className="mt-8">
                <h2 className="section-label mb-4">More games</h2>
                <div className="space-y-2">
                  {moreGames.map((game) => (
                    <GameCard key={game.id} game={game} compact />
                  ))}
                </div>
              </div>
            ) : null}

            {games.length >= limit ? (
              <button
                type="button"
                className="glass mt-4 min-h-11 w-full text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition hover:border-white/20"
                onClick={() => setLimit((n) => n + 20)}
              >
                Show more
              </button>
            ) : null}
          </>
        )}
      </section>
      </FadeIn>

      <FadeIn delay={110}>
      <section className="page-pad mt-12">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="section-label">Nearby venues</h2>
          <MotionTextLink onClick={() => navigate('/explore')}>View all</MotionTextLink>
        </div>
        <div className="space-y-2">
          {venues.slice(0, 3).map((v) => (
            <VenueCard key={v.id} venue={v} to={`/venues/${v.id}`} />
          ))}
        </div>
      </section>
      </FadeIn>
      </PageContent>

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={filters}
        onChange={(next) => {
          setFilters(next)
          setSportId(next.sport)
          setRadiusMeters(next.radiusMeters)
        }}
        sports={sports}
      />
      <LocationPickerSheet />
    </div>
  )
}
