import { AnimatedNumber } from '@/components/motion/AnimatedNumber'
import { StatusTransition } from '@/components/motion/StatusTransition'
import { cn, formatRelativeDeadline, statusLabel } from '@/lib/format'
import {
  deadlineToneClass,
  getDeadlineUrgency,
} from '@/lib/availability'
import type { UiGameStatus } from '@/types/domain'
import { useEffect, useState } from 'react'

interface Props {
  game: {
    status: UiGameStatus
    confirmationDeadline: string
    confirmedCount: number
    minPlayers: number
  }
  className?: string
}

function statusPanelClass(status: UiGameStatus): string {
  switch (status) {
    case 'confirmed':
      return 'glass glass-status-success'
    case 'full':
      return 'glass glass-status-info'
    case 'filling':
      return 'glass glass-status-warning'
    case 'in_progress':
      return 'glass glass-status-live'
    case 'cancelled':
      return 'glass glass-status-danger'
    default:
      return 'glass'
  }
}

function statusTitleClass(status: UiGameStatus): string {
  switch (status) {
    case 'confirmed':
    case 'open':
      return 'text-status-success'
    case 'full':
      return 'text-status-info'
    case 'filling':
      return 'text-status-warning'
    case 'in_progress':
      return 'text-status-live animate-live-pulse'
    case 'cancelled':
      return 'text-status-danger/80'
    case 'completed':
      return 'text-status-neutral'
    default:
      return 'text-white'
  }
}

export function GameStatus({ game, className }: Props) {
  const urgency = getDeadlineUrgency(game.confirmationDeadline)
  const deadlineClass = deadlineToneClass(urgency)

  return (
    <StatusTransition phaseKey={game.status}>
      <div className={cn(statusPanelClass(game.status), 'p-4', className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="label-caps">Game status</p>
          <p
            className={cn(
              'mt-2 font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-tight',
              statusTitleClass(game.status),
            )}
          >
            {game.status === 'in_progress' ? (
              <span className="inline-flex items-center gap-2">
                <span className="status-dot" aria-hidden />
                Live
              </span>
            ) : game.status === 'confirmed' ? (
              <span className="inline-flex items-center gap-2">
                <span aria-hidden>✓</span>
                Confirmed
              </span>
            ) : game.status === 'cancelled' ? (
              <span className="inline-flex items-center gap-2">
                <span aria-hidden>×</span>
                Cancelled
              </span>
            ) : game.status === 'completed' ? (
              <span className="inline-flex items-center gap-2">
                <span aria-hidden>✓</span>
                Completed
              </span>
            ) : (
              statusLabel(game.status)
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[14px] font-semibold tabular-nums text-white">
            <AnimatedNumber value={game.confirmedCount} />
            /
            <AnimatedNumber value={game.minPlayers} /> min
          </p>
          <p className={cn('mt-0.5 text-[12px]', deadlineClass)}>
            {formatRelativeDeadline(game.confirmationDeadline, true)}
          </p>
        </div>
      </div>
      <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-relaxed text-white/45">
        Confirmation locks automatically 3 hours before kickoff. If the minimum
        is met, the roster locks. If not, the game cancels.
      </p>
      </div>
    </StatusTransition>
  )
}

interface CountdownProps {
  deadlineAt: string
  className?: string
  label?: string
}

function partsUntil(target: Date) {
  const ms = Math.max(0, target.getTime() - Date.now())
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return { h, m, s, done: ms <= 0 }
}

export function Countdown({
  deadlineAt,
  className,
  label = 'Confirm by',
}: CountdownProps) {
  const deadline = new Date(deadlineAt)
  const [parts, setParts] = useState(() => partsUntil(deadline))
  const urgency = getDeadlineUrgency(deadlineAt)
  const urgencyClass = deadlineToneClass(urgency)

  useEffect(() => {
    const id = window.setInterval(() => setParts(partsUntil(deadline)), 1000)
    return () => window.clearInterval(id)
  }, [deadlineAt])

  return (
    <div className={cn('glass-elevated px-4 py-4 text-white', className)}>
      <p className={cn('text-[11px] font-semibold uppercase tracking-[0.1em]', urgencyClass)}>
        {label}
      </p>
      {parts.done ? (
        <p className="mt-2 font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-tight text-status-warning">
          Deadline passed
        </p>
      ) : (
        <div className={cn('mt-3 flex items-end gap-3', urgency !== 'neutral' && urgencyClass)}>
          <TimeBlock value={parts.h} unit="hrs" />
          <span className="pb-2 text-[22px] text-white/35">:</span>
          <TimeBlock value={parts.m} unit="min" />
          <span className="pb-2 text-[22px] text-white/35">:</span>
          <TimeBlock value={parts.s} unit="sec" />
        </div>
      )}
    </div>
  )
}

function TimeBlock({ value, unit }: { value: number; unit: string }) {
  return (
    <div>
      <div className="min-w-14 font-[family-name:var(--font-display)] text-[28px] font-semibold tabular-nums tracking-tight">
        <AnimatedNumber live value={String(value).padStart(2, '0')} />
      </div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-white/40">
        {unit}
      </div>
    </div>
  )
}
