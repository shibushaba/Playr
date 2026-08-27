import { useCountTowards } from '@/components/motion/useCountTowards'
import { cn } from '@/lib/format'
import type { ReactNode } from 'react'

interface Props {
  value: ReactNode
  className?: string
  /** Live counters (e.g. countdown) — no remount animation on each tick */
  live?: boolean
}

function AnimatedCount({ value, className }: { value: number; className?: string }) {
  const display = useCountTowards(value)
  return <span className={cn('motion-number-count tabular-nums', className)}>{display}</span>
}

/** Numbers count up; text ticks softly on change (use live for per-second updates). */
export function AnimatedNumber({ value, className, live = false }: Props) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return <AnimatedCount value={value} className={className} />
  }

  if (live) {
    return <span className={cn('tabular-nums', className)}>{value}</span>
  }

  return (
    <span key={String(value)} className={cn('motion-number-tick tabular-nums', className)}>
      {value}
    </span>
  )
}
