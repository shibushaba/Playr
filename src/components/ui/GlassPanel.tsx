import { cn } from '@/lib/format'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { GlassSurface } from '@/components/ui/GlassSurface'

type GlassPanelProps = ComponentPropsWithoutRef<'div'> & {
  children: ReactNode
  contentClassName?: string
}

export function GlassPanel({
  children,
  className,
  contentClassName,
  ...props
}: GlassPanelProps) {
  return (
    <GlassSurface
      {...props}
      className={cn(
        'relative rounded-[12px] border border-white/[0.18]',
        'shadow-[0_30px_100px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.14)]',
        className,
      )}
      contentClassName={contentClassName}
    >
      {children}
    </GlassSurface>
  )
}
