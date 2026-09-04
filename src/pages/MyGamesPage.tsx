import { LoadingBlock } from '@/components/motion/LoadingBlock'
import { PageContent } from '@/components/motion/PageContent'
import { MotionTab, MotionTabBar } from '@/components/motion/MotionTab'
import { GameCard } from '@/components/game/GameCard'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { useAuth } from '@/contexts/AuthContext'
import { toUserMessage } from '@/lib/errors'
import { listMyGames } from '@/services/games'
import type { GameListItem } from '@/types/domain'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

type Tab = 'upcoming' | 'hosting' | 'past'

export function MyGamesPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('upcoming')
  const [games, setGames] = useState<GameListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void listMyGames(user.id)
      .then((data) => {
        if (!cancelled) setGames(data)
      })
      .catch((e) => {
        if (!cancelled) setError(toUserMessage(e, "Couldn't load your games. Try again."))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  const filtered = useMemo(() => {
    const now = Date.now()
    if (!user) return []
    if (tab === 'hosting') {
      return games.filter(
        (g) =>
          g.hostId === user.id &&
          new Date(g.startsAt).getTime() >= now &&
          g.dbStatus !== 'cancelled' &&
          g.dbStatus !== 'completed',
      )
    }
    if (tab === 'past') {
      return games.filter(
        (g) =>
          new Date(g.startsAt).getTime() < now ||
          g.dbStatus === 'completed' ||
          g.dbStatus === 'cancelled',
      )
    }
    return games.filter(
      (g) =>
        new Date(g.startsAt).getTime() >= now &&
        g.dbStatus !== 'cancelled' &&
        g.dbStatus !== 'completed' &&
        g.dbStatus !== 'draft',
    )
  }, [games, tab, user])

  if (authLoading || (user && loading)) {
    return (
      <div>
        <Header title="Games" />
        <PageContent className="page-pad py-8">
          <LoadingBlock />
        </PageContent>
      </div>
    )
  }

  if (!user) {
    return (
      <div>
        <Header title="Games" />
        <PageContent className="page-pad space-y-4 py-6">
          <p className="text-[14px] text-muted">Please sign in to see your games.</p>
          <PrimaryButton fullWidth onClick={() => navigate('/auth?next=/my-games')}>
            Sign in
          </PrimaryButton>
        </PageContent>
      </div>
    )
  }

  return (
    <div>
      <Header title="Games" subtitle="Spots, hosting & history" />
      <PageContent className="page-pad py-5">
        <MotionTabBar>
          {(
            [
              ['upcoming', 'Upcoming'],
              ['hosting', 'Hosted'],
              ['past', 'Past'],
            ] as const
          ).map(([id, label]) => (
            <MotionTab key={id} active={tab === id} onClick={() => setTab(id)}>
              {label}
            </MotionTab>
          ))}
        </MotionTabBar>

        <div className="mt-6 space-y-3">
          {error ? (
            <EmptyState title="Couldn't load games" description={error} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={
                tab === 'hosting'
                  ? 'You are not hosting anything yet.'
                  : tab === 'past'
                    ? 'No past games yet.'
                    : "You haven't joined any games yet."
              }
              description={
                tab === 'hosting'
                  ? 'Use Host in the tab bar when you have a venue booked.'
                  : 'Find a nearby game on Play, or host one yourself.'
              }
              action={
                <Link to={tab === 'hosting' ? '/host' : '/home'}>
                  <PrimaryButton>
                    {tab === 'hosting' ? 'Host a game' : 'Find a game'}
                  </PrimaryButton>
                </Link>
              }
            />
          ) : (
            filtered.map((g) => <GameCard key={g.id} game={g} />)
          )}
        </div>

        <div className="glass mt-8 p-4">
          <p className="label-caps">Check-in</p>
          <p className="mt-2 text-[14px] leading-relaxed text-white/45">
            For confirmed games, open the game page near kickoff to check in at
            the venue — or ask the host if GPS is unavailable.
          </p>
        </div>
      </PageContent>
    </div>
  )
}
