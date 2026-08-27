import { cn } from '@/lib/format'

interface Props {
  className?: string
}

export function Skeleton({ className }: Props) {
  return (
    <div
      className={cn('motion-skeleton glass', className)}
      aria-hidden
    />
  )
}
