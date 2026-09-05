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

export function ChipRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex gap-2', className)}
      aria-hidden
      role="presentation"
    >
      <Skeleton className="h-10 w-16 shrink-0" />
      <Skeleton className="h-10 w-24 shrink-0" />
      <Skeleton className="h-10 w-20 shrink-0" />
      <Skeleton className="h-10 w-28 shrink-0" />
    </div>
  )
}

export function GameRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('glass list-row', className)}
      aria-hidden
      role="presentation"
    >
      <Skeleton className="h-12 w-12 shrink-0 rounded-[8px]" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <Skeleton className="h-3 w-10 shrink-0" />
    </div>
  )
}

export function PlayFeedSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="Loading games">
      <ChipRowSkeleton />
      <div>
        <Skeleton className="mb-4 h-4 w-24" />
        <Skeleton className="h-36 w-full rounded-[8px]" />
      </div>
      <div className="space-y-2">
        <GameRowSkeleton />
        <GameRowSkeleton />
        <GameRowSkeleton />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function DetailHeroSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading game">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-12 w-40" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-16 w-full" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function WizardStepSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-live="polite" aria-label="Loading">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-12 w-full" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function ListPageSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label="Loading">
      <Skeleton className="mb-4 h-11 w-full" />
      <GameRowSkeleton />
      <GameRowSkeleton />
      <GameRowSkeleton />
      <span className="sr-only">Loading</span>
    </div>
  )
}
