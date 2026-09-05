import { cn } from '@/lib/format'
import { Icon } from '@/components/ui/Icon'
import { Tick02Icon } from '@/icons/actions'
import type { ReactNode } from 'react'

interface Props {
  label: ReactNode
  tone?: 'success' | 'amber' | 'neutral'
  className?: string
}

export function SuccessFeedback({
  label,
  tone = 'success',
  className,
}: Props) {
  return (
    <div
      className={cn(
        'motion-success',
        tone === 'success' && 'motion-success--green',
        tone === 'amber' && 'motion-success--amber',
        className,
      )}
    >
      <Icon icon={Tick02Icon} size={32} className="motion-success-icon" />
      <span className="text-[15px] font-semibold uppercase tracking-[0.08em]">
        {label}
      </span>
    </div>
  )
}
