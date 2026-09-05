import { Icon } from '@/components/ui/Icon'
import { ChevronRightIcon } from '@/icons/navigation'
import { cn } from '@/lib/format'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function MotionTextLink({
  children,
  className,
  onClick,
  disabled,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'motion-link text-[13px] font-medium text-white/55 disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function MotionNavRow({
  to,
  label,
}: {
  to: string
  label: string
}) {
  return (
    <Link
      to={to}
      className="motion-row group flex items-center justify-between border-b border-white/10 px-4 py-3.5 last:border-0"
    >
      <span className="text-[14px] font-medium text-white">{label}</span>
      <Icon icon={ChevronRightIcon} size={16} className="motion-link-arrow text-white/45" />
    </Link>
  )
}
