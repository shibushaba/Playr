import { cn } from '@/lib/format'
import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from 'react'

export const glassScrimStyle: CSSProperties = {
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  backgroundColor: 'rgba(8, 9, 10, 0.35)',
}

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
  style,
  ...props
}: GlassSurfaceProps<T>) {
  const Tag = as ?? 'div'

  return (
    <Tag {...props} className={cn('glass-surface', className)} style={style}>
      <div className={cn('relative z-[1]', contentClassName)}>{children}</div>
    </Tag>
  )
}
