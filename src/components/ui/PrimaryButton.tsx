import { cn } from '@/lib/format'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  fullWidth?: boolean
  size?: 'md' | 'lg'
  variant?: 'solid' | 'outline' | 'ghost'
}

export function PrimaryButton({
  children,
  className,
  fullWidth,
  size = 'lg',
  variant = 'solid',
  disabled,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'motion-btn inline-flex items-center justify-center gap-2 rounded-[8px] font-semibold tracking-[0.04em] uppercase disabled:cursor-not-allowed',
        size === 'lg' ? 'min-h-12 px-5 text-[13px]' : 'min-h-10 px-4 text-[12px]',
        variant === 'solid' &&
          cn(
            'motion-btn-solid bg-white text-cta shadow-[0_8px_24px_rgba(0,0,0,0.20)] hover:bg-white/90',
            'disabled:bg-white/[0.14] disabled:text-white/55 disabled:shadow-none disabled:border disabled:border-white/20',
          ),
        variant === 'outline' &&
          cn(
            'border border-white/25 bg-white/[0.07] text-white backdrop-blur-glass hover:border-white/45 hover:bg-white/[0.12]',
            'disabled:opacity-40',
          ),
        variant === 'ghost' &&
          cn(
            'bg-transparent text-white/70 hover:bg-white/[0.06] hover:text-white',
            'disabled:opacity-40',
          ),
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
