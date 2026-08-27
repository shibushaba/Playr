import { LoadingBlock } from '@/components/motion/LoadingBlock'
import { MotionTextLink } from '@/components/motion/MotionLink'
import { PageContent } from '@/components/motion/PageContent'
import { MotionTab, MotionTabBar } from '@/components/motion/MotionTab'
import { GameCard } from '@/components/game/GameCard'
import { GroupCard } from '@/components/group/GroupCard'
import { Header } from '@/components/layout/Header'
import { LocationPickerSheet } from '@/components/location/LocationPickerSheet'
import { SportChip } from '@/components/sport/SportChip'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SearchBar } from '@/components/ui/SearchBar'
import { VenueCard } from '@/components/venue/VenueCard'
import { useLocationDiscovery } from '@/contexts/LocationContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { toUserMessage } from '@/lib/errors'
import { getNearbyGames, getNearbyVenues } from '@/services/discovery'
import { listGroups } from '@/services/groups'
import { listSports } from '@/services/sports'
import type { GameListItem, GroupListItem, SportRecord, VenueRecord } from '@/types/domain'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type ExploreTab = 'games' | 'venues' | 'groups'

export function ExplorePage() {
  const { location, radiusMeters, setPickerOpen } = useLocationDiscovery()
  const [tab, setTab] = useState<ExploreTab>('games')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [sportId, setSportId] = useState<string | 'all'>('all')
  const [sports, setSports] = useState<SportRecord[]>([])
  const [games, setGames] = useState<GameListItem[]>([])
  const [venues, setVenues] = useState<VenueRecord[]>([])
  const [groups, setGroups] = useState<GroupListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void listSports().then(setSports).catch(() => setSports([]))
  }, [])

  useEffect(() => {
    if (!location) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void Promise.all([
      getNearbyGames({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        radiusMeters,
        sportId: sportId === 'all' ? null : sportId,
        search: debouncedQuery.trim() || null,
        limit: 20,
      }),
      getNearbyVenues({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        radiusMeters,
        search: debouncedQuery.trim() || null,
        limit: 20,
      }),
      listGroups().catch(() => [] as GroupListItem[]),
    ])
      .then(([g, v, grp]) => {
        if (cancelled) return
        setGames(g)
        setVenues(v)
        const q = debouncedQuery.trim().toLowerCase()
        setGroups(
          q
            ? grp.filter(
                (item) =>
                  item.name.toLowerCase().includes(q) ||
                  (item.sport?.name?.toLowerCase().includes(q) ?? false),
              )
            : grp,
        )
        setError(null)
      })
      .catch((e) => {
        if (!cancelled) setError(toUserMessage(e, "Couldn't load explore data."))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [location, radiusMeters, sportId, debouncedQuery])

  return (
    <div>
      <Header
        title="Explore"
        subtitle="Games, venues & groups"
        right={
          <MotionTextLink onClick={() => setPickerOpen(true)}>Area</MotionTextLink>
        }
      />
      <PageContent className="page-pad py-5">
        {!location ? (
          <EmptyState
            title="Location unavailable"
            description="Choose an area to explore nearby venues and games."
            action={
              <PrimaryButton onClick={() => setPickerOpen(true)}>
                Choose area
              </PrimaryButton>
            }
          />
        ) : (
          <>
            <SearchBar value={query} onChange={setQuery} />

            <div className="mt-5 space-y-4">
              <MotionTabBar>
                {(
                  [
                    ['games', 'Games'],
                    ['venues', 'Venues'],
                    ['groups', 'Groups'],
                  ] as const
                ).map(([id, label]) => (
                  <MotionTab key={id} active={tab === id} onClick={() => setTab(id)}>
                    {label}
                  </MotionTab>
                ))}
              </MotionTabBar>

              {tab !== 'groups' ? (
                <div className="chip-scroll-row chip-scroll-row--bleed flex gap-2 scrollbar-none">
                  <SportChip
                    sport={{ id: 'all', name: 'All', slug: 'all', label: 'All' }}
                    selected={sportId === 'all'}
                    onClick={() => setSportId('all')}
                  />
                  {sports.map((s) => (
                    <SportChip
                      key={s.id}
                      sport={s}
                      selected={sportId === s.id}
                      onClick={() => setSportId(s.id)}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div
              key={`${tab}-${sportId}-${debouncedQuery}`}
              className="mt-6 space-y-3 motion-results-in"
            >
              {loading ? (
                <LoadingBlock className="h-32" />
              ) : error ? (
                <EmptyState title="Couldn't load" description={error} />
              ) : tab === 'games' ? (
                games.length ? (
                  games.map((g) => <GameCard key={g.id} game={g} />)
                ) : (
                  <EmptyState
                    title="No games match these filters."
                    description="Try another sport, distance, or host a game nearby."
                    action={
                      <Link to="/host">
                        <PrimaryButton>Host a game</PrimaryButton>
                      </Link>
                    }
                  />
                )
              ) : tab === 'venues' ? (
                venues.length ? (
                  venues.map((v) => (
                    <VenueCard key={v.id} venue={v} to={`/venues/${v.id}`} />
                  ))
                ) : (
                  <EmptyState
                    title="No venues nearby"
                    description="Submit a venue or widen your search area."
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
                  title="No groups yet"
                  description="Create a recurring club to play on a schedule."
                  action={
                    <Link to="/groups/new">
                      <PrimaryButton>Create group</PrimaryButton>
                    </Link>
                  }
                />
              )}
            </div>

            <div className="mt-8 border-t border-white/10 pt-5">
              <Link
                to="/venues/new"
                className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition hover:text-white/70"
              >
                Submit a venue →
              </Link>
            </div>
          </>
        )}
      </PageContent>
      <LocationPickerSheet />
    </div>
  )
}
