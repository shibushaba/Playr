import { cn } from '@/lib/format'
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

type GlassChromeBarProps<T extends ElementType = 'div'> = {
  as?: T
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>

export function GlassChromeBar<T extends ElementType = 'div'>({
  as,
  children,
  className,
  style,
  ...props
}: GlassChromeBarProps<T>) {
  const Tag = as ?? 'div'

  return (
    <Tag
      {...props}
      className={cn(
        'glass-chrome-bar rounded-[12px] border border-white/[0.18]',
        'shadow-[0_12px_36px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.14)]',
        className,
      )}
      style={style}
    >
      <div aria-hidden className="glass-chrome-blur absolute inset-0 rounded-[inherit]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/[0.16] via-white/[0.05] to-transparent"
      />
      <div className="relative z-[1]">{children}</div>
    </Tag>
  )
}
