import { cn, formatRelativeDeadline, statusLabel } from '@/lib/format'
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

export function GameStatus({ game, className }: Props) {
  return (
    <div className={cn('glass p-4', className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="label-caps">Game status</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-tight text-white">
            {statusLabel(game.status)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[14px] font-semibold tabular-nums text-white">
            {game.confirmedCount}/{game.minPlayers} min
          </p>
          <p className="mt-0.5 text-[12px] text-white/45">
            {formatRelativeDeadline(game.confirmationDeadline, true)}
          </p>
        </div>
      </div>
      <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-relaxed text-white/45">
        Confirmation locks automatically 3 hours before kickoff. If the minimum
        is met, the roster locks. If not, the game cancels.
      </p>
    </div>
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

  useEffect(() => {
    const id = window.setInterval(() => setParts(partsUntil(deadline)), 1000)
    return () => window.clearInterval(id)
  }, [deadlineAt])

  return (
    <div className={cn('glass-elevated px-4 py-4 text-white', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/40">
        {label}
      </p>
      {parts.done ? (
        <p className="mt-2 font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-tight">
          Deadline passed
        </p>
      ) : (
        <div className="mt-3 flex items-end gap-3">
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
        {String(value).padStart(2, '0')}
      </div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-white/40">
        {unit}
      </div>
    </div>
  )
}
