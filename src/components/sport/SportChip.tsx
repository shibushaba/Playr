import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/format'
import type { SportRecord } from '@/types/domain'
import type { IconSvgElement } from '@hugeicons/react'
import {
  BadmintonIcon,
  Basketball01Icon,
  CricketBatIcon,
  Dumbbell01Icon,
  FootballIcon,
  TennisBallIcon,
  VolleyballIcon,
} from '@/icons/sports'

const sportIcons: Record<string, IconSvgElement> = {
  football: FootballIcon,
  soccer: FootballIcon,
  cricket: CricketBatIcon,
  badminton: BadmintonIcon,
  basketball: Basketball01Icon,
  tennis: TennisBallIcon,
  volleyball: VolleyballIcon,
  default: Dumbbell01Icon,
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
  const icon = sportIcons[slug] || sportIcons.default

  if (tile) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={cn(
          'motion-chip motion-btn-flat sport-tile-chip flex min-w-[76px] shrink-0 flex-col items-center gap-1.5 px-3 py-2.5',
          selected && 'sport-tile-chip--active',
        )}
      >
        <Icon icon={icon} size={20} className="text-white" />
        <span className="text-[12px] font-medium text-white/80">{label}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'motion-btn sport-chip-inline inline-flex min-h-10 shrink-0 items-center gap-2 px-3.5 text-[13px] font-medium',
        selected
          ? 'sport-tile-chip--active text-white'
          : 'text-white/60 hover:text-white',
      )}
    >
      {sport.id !== 'all' ? <Icon icon={icon} size={14} /> : null}
      {label}
    </button>
  )
}
