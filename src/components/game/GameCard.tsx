import { CardSemanticGlow, GameAvailability, ParticipantStatus } from '@/components/game/GameAvailability'
import { StatusBadge } from '@/components/game/StatusBadge'
import { useAuth } from '@/contexts/AuthContext'
import {
  getOccupancy,
  glowStateForGame,
} from '@/lib/availability'
import { cn, formatDay, formatTime } from '@/lib/format'
import type { GameListItem } from '@/types/domain'
import { Link } from 'react-router-dom'

interface Props {
  game: GameListItem
  className?: string
  featured?: boolean
  compact?: boolean
}

function participantBanner(game: GameListItem, userId?: string | null) {
  const isHost = Boolean(
    userId &&
      (game.hostId === userId ||
        game.myParticipation?.role === 'host' ||
        game.myParticipation?.role === 'co_host'),
  )
  const ps = game.myParticipation?.status
  if (isHost) return { label: "You're hosting", tone: 'neutral' as const }
  if (ps === 'confirmed' || ps === 'attended') {
    return { label: "You're in", tone: 'success' as const }
  }
  if (ps === 'reserved') return { label: 'Spot held', tone: 'warning' as const }
  if (ps === 'waitlisted') return { label: 'On waitlist', tone: 'warning' as const }
  return null
}

function showOccupancy(game: GameListItem): boolean {
  return (
    game.dbStatus === 'open' &&
    game.status !== 'confirmed' &&
    game.status !== 'cancelled' &&
    game.status !== 'completed' &&
    game.status !== 'in_progress'
  )
}

function gameDistance(game: GameListItem): string | null {
  return (
    game.distanceLabel ||
    (game.venue?.distanceLabel ??
      (game.venue?.distanceKm != null
        ? `${game.venue.distanceKm.toFixed(1)} km`
        : null))
  )
}

export function GameCard({ game, className, featured, compact = true }: Props) {
  const { user } = useAuth()
  const occupancy = getOccupancy(game.confirmedCount, game.maxPlayers)
  const banner = participantBanner(game, user?.id)
  const useOccupancy = showOccupancy(game)
  const distance = gameDistance(game)
  const glowState = glowStateForGame(game, useOccupancy, occupancy)
  const participantGlow =
    banner?.tone === 'success'
      ? 'available'
      : banner?.tone === 'warning'
        ? 'filling'
        : null
  const cardGlow = glowState ?? participantGlow
  const meta = (
    banner ? (
      <ParticipantStatus label={banner.label} tone={banner.tone} />
    ) : useOccupancy ? (
      <GameAvailability
        currentPlayers={game.confirmedCount}
        maximumPlayers={game.maxPlayers}
        compact
        layout="inline"
        showProgress={false}
      />
    ) : (
      <StatusBadge
        status={game.status}
        label={game.status === 'in_progress' ? 'Live' : undefined}
      />
    )
  )

  if (featured) {
    return (
      <Link
        to={`/games/${game.id}`}
        className={cn(
          'glass-elevated motion-card relative block overflow-hidden p-5',
          className,
        )}
      >
        {cardGlow ? <CardSemanticGlow state={cardGlow} /> : null}
        <div className="relative z-[1] flex gap-4">
          <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-[8px] bg-white/[0.08]">
            <p className="font-[family-name:var(--font-display)] text-[20px] font-semibold tabular-nums leading-none text-white">
              {formatTime(game.startsAt)}
            </p>
            <p className="mt-1 text-[11px] text-white/45">{formatDay(game.startsAt)}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="label-caps">{game.sport.name}</p>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-[18px] font-semibold leading-tight tracking-tight text-white">
              {game.venue?.name ?? 'Venue TBD'}
            </h3>
            <p className="mt-1 text-[13px] text-white/45">
              {[game.venue?.city, distance].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-3">{meta}</div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={`/games/${game.id}`}
      className={cn(
        'glass motion-card relative block overflow-hidden hover:border-white/20',
        compact ? 'list-row' : 'px-4 py-4',
        className,
      )}
    >
      {cardGlow ? <CardSemanticGlow state={cardGlow} /> : null}
      <div className="relative z-[1] flex min-w-0 flex-1 items-center gap-3">
        <div className="w-14 shrink-0">
          <p className="font-[family-name:var(--font-display)] text-[16px] font-semibold tabular-nums text-white">
            {formatTime(game.startsAt)}
          </p>
          <p className="mt-0.5 text-[11px] text-white/40">{formatDay(game.startsAt)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-white">
            {game.venue?.name ?? 'Venue TBD'}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-white/40">
            {[game.sport.name, distance].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-1.5">{meta}</div>
        </div>
      </div>
    </Link>
  )
}
