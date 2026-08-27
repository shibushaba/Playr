import { cn } from '@/lib/format'
import type { SportRecord } from '@/types/domain'
import {
  CircleDot,
  Dumbbell,
  Target,
  Volleyball,
  type LucideIcon,
} from 'lucide-react'

const sportIcons: Record<string, LucideIcon> = {
  football: CircleDot,
  soccer: CircleDot,
  cricket: Target,
  badminton: Volleyball,
  basketball: CircleDot,
  tennis: CircleDot,
  volleyball: Volleyball,
  default: Dumbbell,
}

interface Props {
  sport: SportRecord | { id: string; name: string; slug: string; label?: string }
  selected?: boolean
  onClick?: () => void
  tile?: boolean
}

export function SportChip({ sport, selected, onClick, tile }: Props) {
  const label = ('label' in sport && sport.label) || sport.name
  const slug = sport.slug?.toLowerCase() ?? ''
  const Icon = sportIcons[slug] || sportIcons.default

  if (tile) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={cn(
          'motion-chip motion-btn-flat sport-tile-chip flex min-w-[88px] shrink-0 flex-col items-center gap-2 px-3 py-3',
          selected && 'sport-tile-chip--active',
        )}
      >
        <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/80">
          {label}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'motion-btn sport-chip-inline inline-flex min-h-10 shrink-0 items-center gap-2 px-4 text-[11px] font-semibold uppercase tracking-[0.08em]',
        selected
          ? 'sport-tile-chip--active text-white'
          : 'text-white/60 hover:text-white',
      )}
    >
      {sport.id !== 'all' ? (
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      ) : null}
      {label}
    </button>
  )
}
