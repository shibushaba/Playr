import { cn } from '@/lib/format'
import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  action?: ReactNode
  preview?: ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  action,
  preview,
  className,
}: Props) {
  return (
    <div className={cn('px-1 py-8', className)}>
      {preview ? (
        <div className="pointer-events-none mb-6 opacity-40" aria-hidden>
          {preview}
        </div>
      ) : null}
      <h2 className="font-[family-name:var(--font-display)] text-[20px] font-semibold tracking-tight text-white">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-white/50">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
