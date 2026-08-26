import { cn, statusLabel } from '@/lib/format'
import type { VenueStatus } from '@/types/database'
import type { UiGameStatus } from '@/types/domain'

const gameMark: Record<UiGameStatus, string> = {
  open: '●',
  filling: '●',
  full: '○',
  confirmed: '■',
  cancelled: '×',
  completed: '✓',
  in_progress: '▶',
  draft: '○',
}

interface GameProps {
  status: UiGameStatus
  className?: string
}

export function StatusBadge({ status, className }: GameProps) {
  const cancelled = status === 'cancelled'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]',
        cancelled ? 'text-white/35 line-through' : 'text-white/70',
        className,
      )}
    >
      <span aria-hidden>{gameMark[status]}</span>
      {statusLabel(status)}
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
