import { Icon } from '@/components/ui/Icon'
import { FootballIcon } from '@/icons/actions'
import { cn } from '@/lib/format'

const sizes = {
  sm: 24,
  md: 36,
  lg: 48,
} as const

interface Props {
  size?: keyof typeof sizes
  className?: string
}

/** Rotating football — route-level loading only. */
export function LoadingBall({ size = 'md', className }: Props) {
  return (
    <div
      className={cn('motion-loading-ball flex items-center justify-center', className)}
      role="status"
      aria-label="Loading"
    >
      <Icon
        icon={FootballIcon}
        size={sizes[size]}
        className="motion-loading-ball-icon"
        aria-hidden
      />
      <span className="sr-only">Loading</span>
    </div>
  )
}
