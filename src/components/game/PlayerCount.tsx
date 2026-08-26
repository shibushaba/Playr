import { cn, spotsLeft } from '@/lib/format'

interface Props {
  confirmed: number
  max: number
  min?: number
  waitlist?: number
  className?: string
  compact?: boolean
}

export function PlayerCount({
  confirmed,
  max,
  min,
  waitlist,
  className,
  compact,
}: Props) {
  const left = spotsLeft(confirmed, max)
  const fill = Math.min(100, Math.round((confirmed / max) * 100))

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="font-semibold tabular-nums text-white">
          {confirmed}/{max}
          {!compact && min != null ? (
            <span className="font-normal text-white/45"> · min {min}</span>
          ) : null}
        </span>
        <span className="text-[12px] uppercase tracking-[0.08em] text-white/45">
          {left === 0
            ? waitlist
              ? `${waitlist} waitlisted`
              : 'No spots left'
            : `${left} spot${left === 1 ? '' : 's'} left`}
        </span>
      </div>
      {!compact ? (
        <div className="mt-2 h-px overflow-hidden bg-white/10">
          <div
            className="h-full bg-white transition-all duration-500"
            style={{ width: `${fill}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}
