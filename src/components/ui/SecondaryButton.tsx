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
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-white/28 bg-white/[0.08] px-5 text-[13px] font-semibold uppercase tracking-[0.04em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-[12px] transition duration-200 hover:border-white/45 hover:bg-white/[0.14] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40',
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
