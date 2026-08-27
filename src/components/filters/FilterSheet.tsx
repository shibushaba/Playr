import { MotionChip } from '@/components/motion/MotionChip'
import { MotionIconButton } from '@/components/motion/MotionIconButton'
import { OverlaySheet } from '@/components/ui/OverlaySheet'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
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
      panelClassName="max-h-[85dvh]"
      panelContentClassName="max-h-[85dvh] overflow-y-auto p-5"
    >
        <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-[18px] font-semibold tracking-tight text-white">
            Filters
          </h2>
          <MotionIconButton onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </MotionIconButton>
        </div>

        <Section title="Sport">
          <div className="flex flex-wrap gap-2">
            <MotionChip
              active={value.sport === 'all'}
              onClick={() => onChange({ ...value, sport: 'all' })}
            >
              All
            </MotionChip>
            {sports.map((s) => (
              <MotionChip
                key={s.id}
                active={value.sport === s.id}
                onClick={() => onChange({ ...value, sport: s.id })}
              >
                {s.name}
              </MotionChip>
            ))}
          </div>
        </Section>

        <Section title="Distance">
          <div className="flex flex-wrap gap-2">
            {RADIUS_OPTIONS.map((r) => (
              <MotionChip
                key={r.meters}
                active={value.radiusMeters === r.meters}
                onClick={() => onChange({ ...value, radiusMeters: r.meters })}
              >
                {r.label}
              </MotionChip>
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
              <MotionChip
                key={id}
                active={value.when === id}
                onClick={() => onChange({ ...value, when: id })}
              >
                {label}
              </MotionChip>
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
              <MotionChip
                key={id}
                active={value.timeBucket === id}
                onClick={() => onChange({ ...value, timeBucket: id })}
              >
                {label}
              </MotionChip>
            ))}
          </div>
        </Section>

        <Section title="Status">
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <MotionChip
                key={s}
                active={value.status === s}
                onClick={() => onChange({ ...value, status: s })}
              >
                {s === 'all' ? 'Open + confirmed' : s.replace('_', ' ')}
              </MotionChip>
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
          <PrimaryButton fullWidth onClick={onClose}>
            Show games
          </PrimaryButton>
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

