import { cn, formatDay, formatTime } from '@/lib/format'
import type { GameListItem } from '@/types/domain'
import { Link } from 'react-router-dom'
import { StatusBadge } from './StatusBadge'
import { PrimaryButton } from '@/components/ui/PrimaryButton'

interface Props {
  game: GameListItem
  className?: string
  featured?: boolean
  compact?: boolean
}

function actionLabel(game: GameListItem): string {
  if (game.dbStatus === 'cancelled') return 'Cancelled'
  if (game.dbStatus === 'confirmed') return 'View'
  if (game.confirmedCount >= game.maxPlayers) return 'Waitlist'
  if (game.dbStatus === 'open') return 'Join'
  return 'View'
}

export function GameCard({ game, className, featured, compact }: Props) {
  const distance =
    game.distanceLabel ||
    (game.venue?.distanceLabel ??
      (game.venue?.distanceKm != null
        ? `${game.venue.distanceKm.toFixed(1)} km`
        : null))

  const cta = actionLabel(game)
  const joinTo =
    cta === 'Waitlist'
      ? `/games/${game.id}/join?mode=waitlist`
      : cta === 'Join'
        ? `/games/${game.id}/join`
        : `/games/${game.id}`

  if (featured) {
    return (
      <article
        className={cn(
          'glass-elevated relative overflow-hidden transition duration-200 hover:-translate-y-0.5',
          className,
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
          aria-hidden
        />
        <Link to={`/games/${game.id}`} className="block px-5 pt-5">
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
                <StatusBadge status={game.status} />
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
            <p className="font-[family-name:var(--font-display)] text-[28px] font-semibold tabular-nums text-white">
              {game.confirmedCount} / {game.maxPlayers}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/40">
              {game.confirmedCount >= game.maxPlayers
                ? 'Full'
                : 'Spots available'}
            </p>
          </div>
        </Link>

        <div className="p-4 pt-3">
          {cta === 'Cancelled' ? (
            <PrimaryButton fullWidth disabled>
              Cancelled
            </PrimaryButton>
          ) : (
            <Link to={joinTo} className="block">
              <PrimaryButton fullWidth>
                {cta === 'Join' ? 'Join game →' : `${cta} →`}
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
          'glass block px-4 py-4 transition duration-200 hover:border-white/20 hover:-translate-y-0.5',
          className,
        )}
      >
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
          {[distance, `${game.confirmedCount}/${game.maxPlayers}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </Link>
    )
  }

  return (
    <article
      className={cn(
        'glass transition duration-200 hover:-translate-y-0.5 hover:border-white/18',
        className,
      )}
    >
      <Link to={`/games/${game.id}`} className="block px-4 pt-4">
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

        <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/10 pt-4 pb-1">
          <div>
            <p className="font-[family-name:var(--font-display)] text-[20px] font-semibold tabular-nums text-white">
              {game.confirmedCount} / {game.maxPlayers}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
              Spots
            </p>
          </div>
          <StatusBadge status={game.status} />
        </div>
      </Link>

      <div className="border-t border-white/10 p-3">
        {cta === 'Cancelled' ? (
          <PrimaryButton fullWidth disabled>
            Cancelled
          </PrimaryButton>
        ) : (
          <Link to={joinTo} className="block">
            <PrimaryButton
              fullWidth
              variant={cta === 'View' ? 'outline' : 'solid'}
            >
              {cta === 'Join' ? 'Join →' : `${cta} →`}
            </PrimaryButton>
          </Link>
        )}
      </div>
    </article>
  )
}
