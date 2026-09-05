import { cn } from '@/lib/format'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  fullWidth?: boolean
}

export function SecondaryButton({
  children,
  className,
  fullWidth,
  disabled,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'motion-btn motion-btn-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-white/28 bg-white/[0.08] px-5 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-glass hover:border-white/45 hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-40',
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
