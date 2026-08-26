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
          'glass flex min-w-[88px] flex-col items-center gap-2 px-3 py-3 transition duration-200',
          selected
            ? 'border-white/30 bg-white/[0.09] shadow-[0_12px_40px_rgba(0,0,0,0.3),inset_0_0_20px_rgba(255,255,255,0.04)]'
            : 'hover:border-white/18',
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
        'glass inline-flex min-h-10 shrink-0 items-center gap-2 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] transition duration-200',
        selected
          ? 'border-white/30 bg-white/[0.09] text-white'
          : 'text-white/60 hover:border-white/20 hover:text-white',
      )}
    >
      {sport.id !== 'all' ? (
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      ) : null}
      {label}
    </button>
  )
}
