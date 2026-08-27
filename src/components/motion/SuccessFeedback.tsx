import { cn } from '@/lib/format'
import { Check } from 'lucide-react'
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
      <Check className="motion-success-icon h-8 w-8" strokeWidth={2.25} />
      <span className="text-[15px] font-semibold uppercase tracking-[0.08em]">
        {label}
      </span>
    </div>
  )
}
