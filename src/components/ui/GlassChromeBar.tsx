import { cn } from '@/lib/format'
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

const POSITION_CLASS = /\b(static|fixed|absolute|relative|sticky)\b/

type GlassChromeBarProps<T extends ElementType = 'div'> = {
  as?: T
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>

/**
 * Frosted glass chrome — visual material only.
 * Never pass position utilities here; wrap in a positioned shell (see ChromePosition).
 */
export function GlassChromeBar<T extends ElementType = 'div'>({
  as,
  children,
  className,
  ...props
}: GlassChromeBarProps<T>) {
  const Tag = as ?? 'div'

  if (import.meta.env.DEV && className && POSITION_CLASS.test(className)) {
    console.warn(
      '[GlassChromeBar] Do not pass position classes to GlassChromeBar. Wrap with ChromePosition instead.',
      className,
    )
  }

  return (
    <Tag
      {...props}
      className={cn(
        'glass-chrome-bar rounded-[12px] border border-white/[0.18]',
        'shadow-[0_12px_36px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.14)]',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
