import { cn } from '@/lib/format'
import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, className }: Props) {
  return (
    <div className={cn('glass motion-enter px-5 py-10', className)}>
      <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-tight text-white">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-white/50">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
