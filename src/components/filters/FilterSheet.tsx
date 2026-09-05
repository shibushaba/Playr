import { MotionChip } from '@/components/motion/MotionChip'
import { MotionIconButton } from '@/components/motion/MotionIconButton'
import { Icon } from '@/components/ui/Icon'
import { OverlaySheet } from '@/components/ui/OverlaySheet'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { Cancel01Icon } from '@/icons/actions'
import { RADIUS_OPTIONS } from '@/lib/location'
import type { SportRecord, UiGameStatus } from '@/types/domain'
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
  resultCount?: number | null
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
  resultCount,
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

  const countLabel =
    resultCount == null
      ? 'Show games'
      : resultCount === 1
        ? 'Show 1 game'
        : `Show ${resultCount} games`

  return (
    <OverlaySheet
      onClose={onClose}
      closeLabel="Close filters"
      lockScroll
      panelClassName="max-h-[85dvh]"
      panelContentClassName="flex max-h-[85dvh] flex-col p-0"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h2 className="text-[18px] font-semibold tracking-tight text-white">
          Filters
        </h2>
        <MotionIconButton onClick={onClose} aria-label="Close">
          <Icon icon={Cancel01Icon} size={18} />
        </MotionIconButton>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
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
      </div>

      <div className="sticky bottom-0 flex gap-3 border-t border-white/10 bg-[rgba(18,18,21,0.72)] px-5 py-4 backdrop-blur-md">
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
          {countLabel}
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
      <p className="field-label">{title}</p>
      {children}
    </div>
  )
}
