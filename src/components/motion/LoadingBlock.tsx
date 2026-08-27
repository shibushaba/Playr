import { LoadingBall } from '@/components/motion/LoadingBall'
import { cn } from '@/lib/format'

export function LoadingBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-40 items-center justify-center py-12',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <LoadingBall size="lg" />
    </div>
  )
}
