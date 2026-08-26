import { cn } from '@/lib/format'
import type { GroupListItem } from '@/types/domain'
import { Link } from 'react-router-dom'

interface Props {
  group: GroupListItem
  className?: string
}

export function GroupCard({ group, className }: Props) {
  return (
    <Link
      to={`/groups/${group.id}`}
      className={cn(
        'glass block p-5 transition duration-200 hover:-translate-y-0.5 hover:border-white/20',
        className,
      )}
    >
      <p className="label-caps">{group.sport?.name ?? 'Sport'}</p>
      <h3 className="mt-2 font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-tight text-white">
        {group.name}
      </h3>
      <p className="mt-2 text-[12px] uppercase tracking-[0.08em] text-white/45">
        {group.recurrenceLabel}
        {group.timeLabel ? ` · ${group.timeLabel}` : ''}
      </p>
      <p className="mt-4 text-[14px] text-white/80">
        {group.venue?.name ?? 'Venue TBD'}
      </p>
      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
        <p className="text-[13px] text-white/45">
          {group.minPlayers}–{group.maxPlayers} players
        </p>
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white">
          Open →
        </span>
      </div>
    </Link>
  )
}
