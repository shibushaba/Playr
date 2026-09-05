import { FadeIn } from '@/components/motion/FadeIn'
import { PageContent } from '@/components/motion/PageContent'
import { GameRowSkeleton, PlayFeedSkeleton } from '@/components/motion/Skeleton'
import { MotionTab, MotionTabBar } from '@/components/motion/MotionTab'
import { FilterSheet, type FilterState } from '@/components/filters/FilterSheet'
import { GameCard } from '@/components/game/GameCard'
import { GroupCard } from '@/components/group/GroupCard'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { LocationPickerSheet } from '@/components/location/LocationPickerSheet'
import { SportChip } from '@/components/sport/SportChip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SearchBar } from '@/components/ui/SearchBar'
import { VenueCard } from '@/components/venue/VenueCard'
import { useAuth } from '@/contexts/AuthContext'
import { useLocationDiscovery } from '@/contexts/LocationContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { ChevronDownIcon, FilterIcon, Search01Icon } from '@/icons/navigation'
import { toUserMessage } from '@/lib/errors'
import { DEFAULT_RADIUS_METERS } from '@/lib/location'
import { isSupabaseConfigured } from '@/lib/supabase'
import { getNearbyGames, getNearbyVenues } from '@/services/discovery'
import { listGroups } from '@/services/groups'
import { listSports } from '@/services/sports'
import type { GameListItem, GroupListItem, SportRecord, VenueRecord } from '@/types/domain'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

type SearchTab = 'games' | 'venues' | 'groups'

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
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function HomePage() {
  const { profile, user } = useAuth()
  const [params, setParams] = useSearchParams()
  const {
    location,
    permission,
    radiusMeters,
    setRadiusMeters,
    setPickerOpen,
  } = useLocationDiscovery()
  const searchOpen = params.get('search') === '1' || params.has('q')
  const query = params.get('q') ?? ''
  const debouncedQuery = useDebouncedValue(query, 300)
  const [searchTab, setSearchTab] = useState<SearchTab>('games')
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
  const [groups, setGroups] = useState<GroupListItem[]>([])
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
        const search = searchOpen ? debouncedQuery.trim() || null : null
        const [gamesData, venuesData, groupsData] = await Promise.all([
          getNearbyGames({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            radiusMeters: effectiveRadius,
            sportId: activeSport === 'all' ? null : activeSport,
            timeBucket: filters.timeBucket === 'any' ? null : filters.timeBucket,
            search,
            limit,
            ...dates,
          }),
          searchOpen
            ? getNearbyVenues({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                radiusMeters: effectiveRadius,
                search,
                limit: 20,
              })
            : Promise.resolve([] as VenueRecord[]),
          searchOpen
            ? listGroups().catch(() => [] as GroupListItem[])
            : Promise.resolve([] as GroupListItem[]),
        ])
        if (cancelled) return
        let list = gamesData
        if (filters.status !== 'all') {
          list = list.filter((g) => g.status === filters.status)
        }
        setGames(list)
        setVenues(venuesData)
        const q = (search ?? '').toLowerCase()
        setGroups(
          q
            ? groupsData.filter(
                (item) =>
                  item.name.toLowerCase().includes(q) ||
                  (item.sport?.name?.toLowerCase().includes(q) ?? false),
              )
            : groupsData,
        )
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
    searchOpen,
    debouncedQuery,
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

  function openSearch() {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('search', '1')
      return next
    }, { replace: true })
  }

  function closeSearch() {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('search')
      next.delete('q')
      return next
    }, { replace: true })
  }

  function setQuery(value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('search', '1')
      if (value) next.set('q', value)
      else next.delete('q')
      return next
    }, { replace: true })
  }

  const featuredGame = !searchOpen ? (games[0] ?? null) : null
  const moreGames = !searchOpen ? games.slice(1) : games

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
            <p className="text-[13px] text-white/45">
              {greeting()}
              {greetName ? `, ${greetName}` : ''}
            </p>
            <span className="group mt-1 inline-flex items-center gap-1.5 text-[16px] font-semibold tracking-tight text-white transition hover:text-white/80">
              {locationLabel}
              <Icon icon={ChevronDownIcon} size={16} className="motion-icon-chevron text-white/50" />
            </span>
          </button>
          <div className="flex items-center gap-2">
            {!searchOpen ? (
              <button
                type="button"
                onClick={openSearch}
                aria-label="Search"
                className="glass motion-btn flex h-11 w-11 items-center justify-center text-white hover:border-white/20"
              >
                <Icon icon={Search01Icon} size={18} />
              </button>
            ) : null}
            <NotificationBell />
          </div>
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

        {searchOpen ? (
          <div className="mt-4 flex items-center gap-2">
            <SearchBar
              className="flex-1"
              value={query}
              onChange={setQuery}
              autoFocus
            />
            <button
              type="button"
              onClick={closeSearch}
              className="text-[13px] font-medium text-white/55 hover:text-white"
            >
              Cancel
            </button>
          </div>
        ) : null}
        </FadeIn>
      </header>

      <PageContent>
      {searchOpen ? (
        <div className="page-pad mt-5">
          <MotionTabBar>
            {(
              [
                ['games', 'Games'],
                ['venues', 'Venues'],
                ['groups', 'Clubs'],
              ] as const
            ).map(([id, label]) => (
              <MotionTab
                key={id}
                active={searchTab === id}
                onClick={() => setSearchTab(id)}
              >
                {label}
              </MotionTab>
            ))}
          </MotionTabBar>

          {searchTab !== 'groups' ? (
            <div className="chip-scroll-row chip-scroll-row--bleed mt-4 flex gap-2 scrollbar-none">
              <SportChip
                sport={{ id: 'all', name: 'All', slug: 'all', label: 'All' }}
                selected={activeSport === 'all'}
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
                  onClick={() => {
                    setSportId(s.id)
                    setFilters((f) => ({ ...f, sport: s.id }))
                  }}
                />
              ))}
            </div>
          ) : null}

          <div className="mt-5 space-y-2">
            {error ? (
              <EmptyState title="Something went wrong." description={error} />
            ) : loading ? (
              <div className="space-y-2">
                <GameRowSkeleton />
                <GameRowSkeleton />
                <GameRowSkeleton />
              </div>
            ) : searchTab === 'games' ? (
              games.length ? (
                games.map((game) => <GameCard key={game.id} game={game} />)
              ) : (
                <EmptyState
                  title="No games match"
                  description="Try another sport or area, or host one yourself."
                  preview={<GameRowSkeleton />}
                  action={
                    <Link to="/host">
                      <PrimaryButton>Host a game</PrimaryButton>
                    </Link>
                  }
                />
              )
            ) : searchTab === 'venues' ? (
              venues.length ? (
                venues.map((v) => (
                  <VenueCard key={v.id} venue={v} to={`/venues/${v.id}`} />
                ))
              ) : (
                <EmptyState
                  title="No venues nearby"
                  description="Submit a venue or widen your area."
                  action={
                    <Link to="/venues/new">
                      <PrimaryButton>Submit a venue</PrimaryButton>
                    </Link>
                  }
                />
              )
            ) : groups.length ? (
              groups.map((g) => <GroupCard key={g.id} group={g} />)
            ) : (
              <EmptyState
                title="No clubs yet"
                description="Create a recurring club to play on a schedule."
                action={
                  <Link to="/groups/new">
                    <PrimaryButton>Create a club</PrimaryButton>
                  </Link>
                }
              />
            )}
          </div>
        </div>
      ) : (
        <>
          <FadeIn delay={50}>
          <section className="page-pad mt-5">
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
          <section className="page-pad mt-8">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 className="section-title">Nearby</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="motion-link inline-flex items-center gap-1.5 text-[13px] font-medium text-white/55"
              >
                <Icon icon={FilterIcon} size={14} />
                Filter
              </button>
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
              <PlayFeedSkeleton />
            ) : games.length === 0 ? (
              <EmptyState
                title="No games near you"
                description="Widen the area, or host when you have a venue."
                preview={<GameRowSkeleton />}
                action={
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <PrimaryButton onClick={() => setPickerOpen(true)}>
                      Widen area
                    </PrimaryButton>
                    <Link to="/host">
                      <PrimaryButton variant="outline">Host instead</PrimaryButton>
                    </Link>
                  </div>
                }
              />
            ) : (
              <>
                {featuredGame ? <GameCard game={featuredGame} featured /> : null}
                {moreGames.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {moreGames.map((game) => (
                      <GameCard key={game.id} game={game} />
                    ))}
                  </div>
                ) : null}
                {games.length >= limit ? (
                  <button
                    type="button"
                    className="glass mt-4 min-h-11 w-full text-[13px] font-medium text-white transition hover:border-white/20"
                    onClick={() => setLimit((n) => n + 20)}
                  >
                    Show more
                  </button>
                ) : null}
              </>
            )}
          </section>
          </FadeIn>
        </>
      )}
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
        resultCount={loading ? null : games.length}
      />
      <LocationPickerSheet />
    </div>
  )
}
