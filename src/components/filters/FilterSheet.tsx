import { OverlaySheet } from '@/components/ui/OverlaySheet'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { cn } from '@/lib/format'
import { RADIUS_OPTIONS } from '@/lib/location'
import type { SportRecord, UiGameStatus } from '@/types/domain'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

export interface FilterState {
  sport: string | 'all'
  status: UiGameStatus | 'all'
  when: 'any' | 'today' | 'tomorrow' | 'weekend' | 'choose'
  chooseDate: string | null
  timeBucket: 'any' | 'morning' | 'afternoon' | 'evening'
  radiusMeters: number
}

interface Props {
  open: boolean
  onClose: () => void
  value: FilterState
  onChange: (next: FilterState) => void
  sports?: SportRecord[]
}

const statuses: Array<UiGameStatus | 'all'> = [
  'all',
  'open',
  'filling',
  'full',
  'confirmed',
]

export function FilterSheet({
  open,
  onClose,
  value,
  onChange,
  sports = [],
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <OverlaySheet
      onClose={onClose}
      closeLabel="Close filters"
      lockScroll
      panelClassName="max-h-[85dvh] overflow-y-auto p-5"
    >
        <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-[18px] font-semibold tracking-tight text-white">
            Filters
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="glass flex h-10 w-10 items-center justify-center text-white/70 transition hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <Section title="Sport">
          <div className="flex flex-wrap gap-2">
            <Chip
              active={value.sport === 'all'}
              onClick={() => onChange({ ...value, sport: 'all' })}
            >
              All
            </Chip>
            {sports.map((s) => (
              <Chip
                key={s.id}
                active={value.sport === s.id}
                onClick={() => onChange({ ...value, sport: s.id })}
              >
                {s.name}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Distance">
          <div className="flex flex-wrap gap-2">
            {RADIUS_OPTIONS.map((r) => (
              <Chip
                key={r.meters}
                active={value.radiusMeters === r.meters}
                onClick={() => onChange({ ...value, radiusMeters: r.meters })}
              >
                {r.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Date">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['any', 'Anytime'],
                ['today', 'Today'],
                ['tomorrow', 'Tomorrow'],
                ['weekend', 'This weekend'],
                ['choose', 'Choose date'],
              ] as const
            ).map(([id, label]) => (
              <Chip
                key={id}
                active={value.when === id}
                onClick={() => onChange({ ...value, when: id })}
              >
                {label}
              </Chip>
            ))}
          </div>
          {value.when === 'choose' ? (
            <input
              type="date"
              className="glass-input mt-3"
              value={value.chooseDate ?? ''}
              onChange={(e) =>
                onChange({ ...value, chooseDate: e.target.value || null })
              }
            />
          ) : null}
        </Section>

        <Section title="Time">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['any', 'Any time'],
                ['morning', 'Morning'],
                ['afternoon', 'Afternoon'],
                ['evening', 'Evening'],
              ] as const
            ).map(([id, label]) => (
              <Chip
                key={id}
                active={value.timeBucket === id}
                onClick={() => onChange({ ...value, timeBucket: id })}
              >
                {label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Status">
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <Chip
                key={s}
                active={value.status === s}
                onClick={() => onChange({ ...value, status: s })}
              >
                {s === 'all' ? 'Open + confirmed' : s.replace('_', ' ')}
              </Chip>
            ))}
          </div>
        </Section>

        <div className="mt-6 flex gap-3">
          <SecondaryButton
            fullWidth
            onClick={() =>
              onChange({
                sport: 'all',
                status: 'all',
                when: 'any',
                chooseDate: null,
                timeBucket: 'any',
                radiusMeters: 10_000,
              })
            }
          >
            Reset
          </SecondaryButton>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[8px] bg-white text-cta text-[14px] font-semibold uppercase tracking-[0.06em] transition hover:bg-white/90"
          >
            Show games
          </button>
        </div>
    </OverlaySheet>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="mb-6">
      <p className="label-caps mb-3">{title}</p>
      {children}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-10 rounded-[8px] border px-3 text-[12px] font-semibold uppercase tracking-[0.06em] transition',
        active
          ? 'border-white/30 bg-white text-cta'
          : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20',
      )}
    >
      {children}
    </button>
  )
}
