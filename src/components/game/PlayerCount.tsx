import { GameAvailability } from '@/components/game/GameAvailability'

interface Props {
  confirmed: number
  max: number
  min?: number
  waitlist?: number
  className?: string
  compact?: boolean
}

/** @deprecated Use GameAvailability directly — kept for gradual migration */
export function PlayerCount({
  confirmed,
  max,
  min,
  waitlist,
  className,
  compact,
}: Props) {
  return (
    <div className={className}>
      <GameAvailability
        currentPlayers={confirmed}
        maximumPlayers={max}
        compact={compact}
        showProgress={!compact}
      />
      {min != null && !compact ? (
        <p className="mt-1 text-[12px] text-white/45">
          Minimum {min} to confirm
          {waitlist ? ` · ${waitlist} on waitlist` : null}
        </p>
      ) : waitlist ? (
        <p className="mt-1 text-[12px] text-white/45">{waitlist} on waitlist</p>
      ) : null}
    </div>
  )
}
