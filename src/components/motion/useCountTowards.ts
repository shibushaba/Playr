import { usePrefersReducedMotion } from '@/components/motion/usePrefersReducedMotion'
import { useEffect, useRef, useState } from 'react'

/** Ease-out count to target — plain, not bouncy. */
export function useCountTowards(target: number, durationMs = 320): number {
  const reduceMotion = usePrefersReducedMotion()
  const [display, setDisplay] = useState(reduceMotion ? target : 0)
  const displayRef = useRef(display)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    displayRef.current = display
  }, [display])

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(target)
      return
    }

    const from = displayRef.current
    if (from === target) return

    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = t * (2 - t)
      setDisplay(Math.round(from + (target - from) * eased))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [target, durationMs, reduceMotion])

  return display
}
