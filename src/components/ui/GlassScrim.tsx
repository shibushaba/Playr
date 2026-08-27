import { glassScrimStyle } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/format'
import type { ButtonHTMLAttributes } from 'react'

type GlassScrimProps = ButtonHTMLAttributes<HTMLButtonElement>

export function GlassScrim({ className, style, children, ...props }: GlassScrimProps) {
  return (
    <button
      type="button"
      className={cn('glass-scrim absolute inset-0', className)}
      style={{ ...glassScrimStyle, ...style }}
      {...props}
    >
      {children}
    </button>
  )
}
