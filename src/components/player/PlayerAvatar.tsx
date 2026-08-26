import { cn, initials } from '@/lib/format'

interface Props {
  player: { name: string; avatarUrl?: string | null }
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showName?: boolean
}

const sizes = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-sm',
}

export function PlayerAvatar({
  player,
  size = 'md',
  className,
  showName,
}: Props) {
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      {player.avatarUrl ? (
        <img
          src={player.avatarUrl}
          alt={player.name}
          className={cn('rounded-[8px] object-cover grayscale', sizes[size])}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.06] font-semibold text-white',
            sizes[size],
          )}
          aria-hidden
        >
          {initials(player.name)}
        </div>
      )}
      {showName ? (
        <span className="text-[14px] font-medium text-white">{player.name}</span>
      ) : null}
    </div>
  )
}
