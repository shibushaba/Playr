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
      className={cn('glass motion-card list-row block', className)}
    >
      <div className="min-w-0 flex-1">
        <p className="label-caps">{group.sport?.name ?? 'Sport'}</p>
        <h3 className="mt-1 truncate text-[15px] font-semibold tracking-tight text-white">
          {group.name}
        </h3>
        <p className="mt-1 text-[12px] text-white/45">
          {[group.recurrenceLabel, group.timeLabel, group.venue?.name]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <p className="shrink-0 text-[12px] text-white/40">
        {group.minPlayers}–{group.maxPlayers}
      </p>
    </Link>
  )
}
