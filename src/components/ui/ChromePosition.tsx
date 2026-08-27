import { cn } from '@/lib/format'
import type { CSSProperties, ElementType, ReactNode } from 'react'

type ChromePositionProps<T extends ElementType = 'div'> = {
  as?: T
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/** Fixed viewport shell — positioning only; glass lives on the child bar. */
export function FixedChrome<T extends ElementType = 'div'>({
  as,
  children,
  className,
  style,
}: ChromePositionProps<T>) {
  const Tag = as ?? 'div'
  return (
    <Tag className={cn('pointer-events-none fixed z-[100]', className)} style={style}>
      <div className="pointer-events-auto">{children}</div>
    </Tag>
  )
}

/** Sticky top shell — positioning only; glass lives on the child bar. */
export function StickyChrome<T extends ElementType = 'header'>({
  as,
  children,
  className,
  style,
}: ChromePositionProps<T>) {
  const Tag = as ?? 'header'
  return (
    <Tag
      className={cn('sticky top-0 z-50 bg-transparent', className)}
      style={style}
    >
      {children}
    </Tag>
  )
}
