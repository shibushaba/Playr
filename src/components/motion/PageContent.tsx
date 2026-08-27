import { cn } from '@/lib/format'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

/** Scrollable page body below Header — safe fade (does not wrap glass chrome). */
export function PageContent({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className={cn('motion-page-content', className)}>
      {children}
    </div>
  )
}
