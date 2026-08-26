import { cn } from '@/lib/format'
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

type GlassSurfaceProps<T extends ElementType = 'div'> = {
  as?: T
  children: ReactNode
  contentClassName?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'contentClassName'>

export function GlassSurface<T extends ElementType = 'div'>({
  as,
  children,
  className,
  contentClassName,
  ...props
}: GlassSurfaceProps<T>) {
  const Tag = as ?? 'div'

  return (
    <Tag {...props} className={cn('glass-surface', className)}>
      <div
        aria-hidden
        className="glass-surface-blur pointer-events-none absolute inset-0 rounded-[inherit]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/[0.16] via-white/[0.05] to-transparent"
      />
      <div className={cn('relative z-[1]', contentClassName)}>{children}</div>
    </Tag>
  )
}
