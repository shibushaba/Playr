import { cn } from '@/lib/format'
import type { ReactNode } from 'react'

interface Props {
  phaseKey: string
  children: ReactNode
  className?: string
}

export function StatusTransition({ phaseKey, children, className }: Props) {
  return (
    <div key={phaseKey} className={cn('motion-status-in', className)}>
      {children}
    </div>
  )
}
