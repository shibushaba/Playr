import { cn } from '@/lib/format'
import type { CSSProperties, ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  delay?: number
}

export function FadeIn({ children, className, delay = 0 }: Props) {
  const style: CSSProperties | undefined =
    delay > 0 ? { animationDelay: `${delay}ms` } : undefined

  return (
    <div className={cn('motion-enter', className)} style={style}>
      {children}
    </div>
  )
}
