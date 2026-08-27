import { usePrefersReducedMotion } from '@/components/motion/usePrefersReducedMotion'
import { cn } from '@/lib/format'
import { useEffect, useState } from 'react'

interface Props {
  /** 0–100 */
  value: number
  className?: string
  fillClassName?: string
  'aria-label'?: string
}

export function AnimatedProgress({
  value,
  className,
  fillClassName,
  'aria-label': ariaLabel,
}: Props) {
  const reduceMotion = usePrefersReducedMotion()
  const clamped = Math.max(0, Math.min(100, value))
  const [width, setWidth] = useState(reduceMotion ? clamped : 0)

  useEffect(() => {
    if (reduceMotion) {
      setWidth(clamped)
      return
    }
    const id = requestAnimationFrame(() => setWidth(clamped))
    return () => cancelAnimationFrame(id)
  }, [clamped, reduceMotion])

  return (
    <div
      className={cn('occupancy-track motion-progress-track', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className={cn('occupancy-fill motion-progress-fill', fillClassName)}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
