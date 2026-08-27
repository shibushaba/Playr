import { cn } from '@/lib/format'

const sizes = {
  sm: 'text-[1.5rem]',
  md: 'text-[2.25rem]',
  lg: 'text-[3rem]',
} as const

interface Props {
  size?: keyof typeof sizes
  className?: string
}

/** Rotating Boxicons football — primary loading indicator. */
export function LoadingBall({ size = 'md', className }: Props) {
  return (
    <div
      className={cn('motion-loading-ball flex items-center justify-center', className)}
      role="status"
      aria-label="Loading"
    >
      <i className={cn('bx bx-football', sizes[size])} aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  )
}
