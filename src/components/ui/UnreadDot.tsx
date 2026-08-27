import { cn } from '@/lib/format'

/** Pulsing green dot for unread chat / message indicators. */
export function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      className={cn('unread-dot motion-badge-pop', className)}
      aria-hidden
    >
      <span className="unread-dot-ping" />
      <span className="unread-dot-core" />
    </span>
  )
}
