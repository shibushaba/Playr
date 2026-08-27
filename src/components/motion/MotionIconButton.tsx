import { cn } from '@/lib/format'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  className?: string
}

export function MotionIconButton({ children, className, ...rest }: Props) {
  return (
    <button
      type="button"
      className={cn(
        'motion-icon-btn glass flex h-10 w-10 items-center justify-center text-white/70',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
