import { CardSemanticGlow, GameAvailability, ParticipantStatus } from '@/components/game/GameAvailability'
import { StatusBadge } from '@/components/game/StatusBadge'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
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

type CardAction = {
  cta: string
  to: string
  variant: 'solid' | 'outline'
  disabled?: boolean
}

function gameCardAction(game: GameListItem, userId?: string | null): CardAction {
  const detailTo = `/games/${game.id}`

  if (game.dbStatus === 'cancelled') {
    return { cta: 'Cancelled', to: detailTo, variant: 'outline', disabled: true }
  }

  if (game.dbStatus === 'completed') {
    return { cta: 'Completed', to: detailTo, variant: 'outline' }
  }

  if (game.dbStatus === 'live') {
    return { cta: 'Live', to: detailTo, variant: 'outline' }
  }

  const isHost = Boolean(
    userId &&
      (game.hostId === userId ||
        game.myParticipation?.role === 'host' ||
        game.myParticipation?.role === 'co_host'),
  )
  const status = game.myParticipation?.status

  if (isHost) {
    return {
      cta:
        game.dbStatus === 'confirmed'
          ? 'Hosting'
          : "You're hosting",
      to: detailTo,
      variant: 'outline',
    }
  }

  if (status === 'confirmed' || status === 'attended') {
    return { cta: "You're in", to: detailTo, variant: 'outline' }
  }

  if (status === 'waitlisted') {
    return { cta: 'On waitlist', to: detailTo, variant: 'outline' }
  }

  if (status === 'reserved') {
    return { cta: 'Confirm spot', to: `/games/${game.id}/join`, variant: 'solid' }
  }

  if (game.dbStatus === 'confirmed') {
    return { cta: 'View', to: detailTo, variant: 'outline' }
  }

  if (game.confirmedCount >= game.maxPlayers) {
    return {
      cta: 'Join waitlist',
      to: `/games/${game.id}/join?mode=waitlist`,
      variant: 'solid',
    }
  }

  if (game.dbStatus === 'open') {
    return { cta: 'Join game', to: `/games/${game.id}/join`, variant: 'solid' }
  }

  return { cta: 'View', to: detailTo, variant: 'outline' }
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

export function GameCard({ game, className, featured, compact }: Props) {
  const { user } = useAuth()
  const { cta, to: joinTo, variant, disabled } = gameCardAction(game, user?.id)
  const occupancy = getOccupancy(game.confirmedCount, game.maxPlayers)
  const banner = participantBanner(game, user?.id)
  const useOccupancy = showOccupancy(game)

  const distance =
    game.distanceLabel ||
    (game.venue?.distanceLabel ??
      (game.venue?.distanceKm != null
        ? `${game.venue.distanceKm.toFixed(1)} km`
        : null))

  const ctaLabel = `${cta} →`
  const glowState = glowStateForGame(game, useOccupancy, occupancy)
  const participantGlow =
    banner?.tone === 'success'
      ? 'available'
      : banner?.tone === 'warning'
        ? 'filling'
        : null
  const cardGlow = glowState ?? participantGlow

  if (featured) {
    return (
      <article
        className={cn(
          'glass-elevated relative overflow-hidden transition duration-200 hover:-translate-y-0.5',
          className,
        )}
      >
        {cardGlow ? <CardSemanticGlow state={cardGlow} /> : null}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
          aria-hidden
        />
        <Link to={`/games/${game.id}`} className="relative z-[1] block px-5 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-[family-name:var(--font-display)] text-[36px] font-semibold leading-none tracking-tight tabular-nums text-white">
                {formatTime(game.startsAt)}
              </p>
              <p className="mt-2 text-[12px] uppercase tracking-[0.1em] text-white/45">
                {formatDay(game.startsAt)}
              </p>
            </div>
            <div className="text-right">
              <p className="label-caps text-white/70">{game.sport.name}</p>
              <div className="mt-2">
                <StatusBadge
                  status={game.status}
                  label={game.status === 'in_progress' ? 'Live' : undefined}
                />
              </div>
            </div>
          </div>

          <h3 className="mt-8 font-[family-name:var(--font-display)] text-[22px] font-semibold leading-tight tracking-tight text-white">
            {game.venue?.name ?? 'Venue TBD'}
          </h3>
          <p className="mt-2 text-[13px] text-white/45">
            {[game.venue?.city, distance].filter(Boolean).join(' · ')}
          </p>

          <div className="mt-6 border-t border-white/10 pt-5">
            {banner ? (
              <ParticipantStatus label={banner.label} tone={banner.tone} />
            ) : useOccupancy ? (
              <GameAvailability
                currentPlayers={game.confirmedCount}
                maximumPlayers={game.maxPlayers}
              />
            ) : (
              <StatusBadge status={game.status} />
            )}
          </div>
        </Link>

        <div className="relative z-[1] p-4 pt-3">
          {disabled ? (
            <PrimaryButton fullWidth disabled variant={variant}>
              {ctaLabel}
            </PrimaryButton>
          ) : (
            <Link to={joinTo} className="block">
              <PrimaryButton fullWidth variant={variant}>
                {ctaLabel}
              </PrimaryButton>
            </Link>
          )}
        </div>
      </article>
    )
  }

  if (compact) {
    return (
      <Link
        to={`/games/${game.id}`}
        className={cn(
          'glass relative block overflow-hidden px-4 py-4 transition duration-200 hover:border-white/20 hover:-translate-y-0.5',
          className,
        )}
      >
        {cardGlow ? <CardSemanticGlow state={cardGlow} /> : null}
        <div className="relative z-[1]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-[family-name:var(--font-display)] text-[20px] font-semibold tabular-nums text-white">
            {formatTime(game.startsAt)}
          </p>
          <p className="label-caps">{game.sport.name}</p>
        </div>
        <p className="mt-3 text-[14px] font-medium text-white">
          {game.venue?.name ?? 'Venue TBD'}
        </p>
        <p className="mt-1 text-[12px] text-white/40">
          {[distance].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-3">
          {banner ? (
            <ParticipantStatus label={banner.label} tone={banner.tone} />
          ) : useOccupancy ? (
            <GameAvailability
              currentPlayers={game.confirmedCount}
              maximumPlayers={game.maxPlayers}
              compact
              showProgress
            />
          ) : (
            <StatusBadge status={game.status} />
          )}
        </div>
        </div>
      </Link>
    )
  }

  return (
    <article
      className={cn(
        'glass relative overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-white/18',
        className,
      )}
    >
      {cardGlow ? <CardSemanticGlow state={cardGlow} /> : null}
      <Link to={`/games/${game.id}`} className="relative z-[1] block px-4 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-tight text-white tabular-nums">
            {formatTime(game.startsAt)}
          </p>
          <p className="label-caps text-white/70">{game.sport.name}</p>
        </div>
        <p className="mt-1 text-[12px] text-white/40">{formatDay(game.startsAt)}</p>

        <div className="mt-5">
          <p className="font-[family-name:var(--font-display)] text-[16px] font-semibold text-white">
            {game.venue?.name ?? 'Venue TBD'}
          </p>
          <p className="mt-1 text-[13px] text-white/45">
            {[game.venue?.city, distance].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="mt-5 border-t border-white/10 pt-4 pb-1">
          {banner ? (
            <ParticipantStatus label={banner.label} tone={banner.tone} />
          ) : useOccupancy ? (
            <GameAvailability
              currentPlayers={game.confirmedCount}
              maximumPlayers={game.maxPlayers}
              compact
            />
          ) : (
            <div className="flex items-end justify-between gap-3">
              <StatusBadge status={game.status} />
            </div>
          )}
        </div>
      </Link>

      <div className="relative z-[1] border-t border-white/10 p-3">
        {disabled ? (
          <PrimaryButton fullWidth disabled variant={variant}>
            {ctaLabel}
          </PrimaryButton>
        ) : (
          <Link to={joinTo} className="block">
            <PrimaryButton fullWidth variant={variant}>
              {ctaLabel}
            </PrimaryButton>
          </Link>
        )}
      </div>
    </article>
  )
}
