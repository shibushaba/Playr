import {
  getOccupancy,
  occupancyGlowStyle,
  occupancyProgressClass,
  occupancyToneClass,
  type OccupancyInfo,
  type OccupancyState,
} from '@/lib/availability'
import { cn } from '@/lib/format'

interface Props {
  currentPlayers: number
  maximumPlayers: number
  /** Show 3–4px occupancy bar */
  showProgress?: boolean
  /** Stack count + label vertically */
  layout?: 'inline' | 'stacked'
  /** Smaller typography for compact cards */
  compact?: boolean
  className?: string
  /** Override derived occupancy (testing / story) */
  occupancy?: OccupancyInfo
}

export function GameAvailability({
  currentPlayers,
  maximumPlayers,
  showProgress = true,
  layout = 'stacked',
  compact = false,
  className,
  occupancy: occupancyOverride,
}: Props) {
  const occupancy = occupancyOverride ?? getOccupancy(currentPlayers, maximumPlayers)
  const toneClass = occupancyToneClass(occupancy.tone)
  const progressClass = occupancyProgressClass(occupancy.tone)

  const countClass = compact
    ? 'text-[14px] font-semibold tabular-nums'
    : 'font-[family-name:var(--font-display)] text-[20px] font-semibold tabular-nums sm:text-[22px]'

  const labelRow = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]',
        toneClass,
      )}
    >
      <span className="status-dot shrink-0" aria-hidden />
      <span>{occupancy.label}</span>
    </span>
  )

  const countRow = compact ? (
    <div className={cn('flex flex-wrap items-baseline gap-x-1.5', toneClass)}>
      <span className={countClass}>
        {occupancy.currentPlayers} / {occupancy.maximumPlayers}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-80">
        players
      </span>
    </div>
  ) : (
    <p className={cn(countClass, toneClass)}>
      {occupancy.currentPlayers} / {occupancy.maximumPlayers}
      <span className="sr-only"> players</span>
    </p>
  )

  return (
    <div className={cn('w-full', className)}>
      {layout === 'inline' ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          {countRow}
          {labelRow}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {countRow}
          {labelRow}
        </div>
      )}

      {occupancy.spotsLeftHint ? (
        <p className={cn('mt-1 text-[12px] font-medium', toneClass)}>
          {occupancy.spotsLeftHint}
        </p>
      ) : null}

      {showProgress ? (
        <div
          className={cn('occupancy-track', compact ? 'mt-1.5' : 'mt-2')}
          role="progressbar"
          aria-valuenow={occupancy.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${occupancy.currentPlayers} of ${occupancy.maximumPlayers} players — ${occupancy.label}`}
        >
          <div
            className={cn('occupancy-fill', progressClass)}
            style={{ width: `${occupancy.percentage}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

/** Confirmed participant signal — subtle green. */
export function ParticipantStatus({
  label,
  tone = 'success',
  className,
}: {
  label: string
  tone?: 'success' | 'warning' | 'neutral'
  className?: string
}) {
  const toneClass =
    tone === 'success'
      ? 'text-status-success'
      : tone === 'warning'
        ? 'text-status-warning'
        : 'text-status-neutral'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]',
        toneClass,
        className,
      )}
    >
      <span className="status-dot shrink-0" aria-hidden />
      <span>{label}</span>
    </span>
  )
}

export function CardSemanticGlow({ state }: { state: OccupancyState }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      style={occupancyGlowStyle(state)}
      aria-hidden
    />
  )
}
