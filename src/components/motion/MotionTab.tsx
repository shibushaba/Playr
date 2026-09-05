import { cn } from '@/lib/format'
import type { ReactNode } from 'react'

export function MotionTabBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('motion-tab-bar', className)} role="tablist">
      {children}
    </div>
  )
}

export function MotionTab({
  active,
  onClick,
  children,
  disabled,
  className,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'motion-tab flex-1 rounded-[6px] py-2.5 text-[13px] font-semibold',
        active ? 'motion-tab--active bg-white text-cta' : 'text-white/45 hover:text-white/70',
        disabled && 'cursor-not-allowed opacity-40',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Pill tabs (Game details Players / Location / Chat). */
export function MotionTabPill({
  active,
  onClick,
  children,
  disabled,
  className,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'motion-tab motion-tab-pill flex flex-1 items-center justify-center gap-1.5 rounded-[6px] py-2.5 text-[13px] font-semibold',
        active ? 'motion-tab--active bg-white/[0.12] text-white' : 'text-white/45',
        disabled && 'cursor-not-allowed opacity-40',
        className,
      )}
    >
      {children}
    </button>
  )
}
