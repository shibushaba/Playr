import { cn, statusLabel } from '@/lib/format'
import type { VenueStatus } from '@/types/database'
import type { UiGameStatus } from '@/types/domain'

const lifecycleStyles: Partial<
  Record<
    UiGameStatus,
    { className: string; prefix?: string; useDot: boolean; pulse?: boolean }
  >
> = {
  open: { className: 'text-status-success', useDot: true },
  filling: { className: 'text-status-warning', useDot: true },
  full: { className: 'text-status-info', useDot: true },
  confirmed: { className: 'text-status-success', prefix: '✓', useDot: false },
  in_progress: {
    className: 'text-status-live animate-live-pulse',
    useDot: true,
  },
  cancelled: {
    className: 'text-status-danger/75 line-through',
    prefix: '×',
    useDot: false,
  },
  completed: { className: 'text-status-neutral', prefix: '✓', useDot: false },
  draft: { className: 'text-status-neutral', useDot: true },
}

interface GameProps {
  status: UiGameStatus
  className?: string
  label?: string
}

export function StatusBadge({ status, className, label }: GameProps) {
  const style = lifecycleStyles[status] ?? {
    className: 'text-status-neutral',
    useDot: true,
  }

  const text =
    label ??
    (status === 'in_progress' ? 'Live' : statusLabel(status))

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]',
        style.className,
        className,
      )}
    >
      {style.prefix ? (
        <span aria-hidden>{style.prefix}</span>
      ) : style.useDot ? (
        <span className="status-dot" aria-hidden />
      ) : null}
      {text}
    </span>
  )
}

interface VenueProps {
  status: VenueStatus
  className?: string
}

export function VenueStatusBadge({ status, className }: VenueProps) {
  const label =
    status === 'community_added'
      ? 'Community'
      : status === 'verified'
        ? 'Verified'
        : 'Pending'

  return (
    <span
      className={cn(
        'inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.1em] text-white/45',
        className,
      )}
    >
      {label}
    </span>
  )
}
