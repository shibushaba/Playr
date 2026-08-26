import { cn } from '@/lib/format'
import type { ButtonHTMLAttributes } from 'react'

type GlassScrimProps = ButtonHTMLAttributes<HTMLButtonElement>

export function GlassScrim({ className, children, ...props }: GlassScrimProps) {
  return (
    <button
      type="button"
      className={cn('glass-scrim absolute inset-0', className)}
      {...props}
    >
      <span
        aria-hidden
        className="glass-scrim-blur pointer-events-none absolute inset-0"
      />
      {children}
    </button>
  )
}
