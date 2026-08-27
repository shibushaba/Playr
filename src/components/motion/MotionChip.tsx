import { cn } from '@/lib/format'
import type { ReactNode } from 'react'

export function MotionChip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'motion-chip motion-btn min-h-10 rounded-[8px] border px-3 text-[12px] font-semibold uppercase tracking-[0.06em]',
        active
          ? 'motion-chip--active border-white/30 bg-white text-cta'
          : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20',
        className,
      )}
    >
      {children}
    </button>
  )
}
