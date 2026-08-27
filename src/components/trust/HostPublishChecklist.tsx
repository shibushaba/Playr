import { CallButton } from '@/components/game/CallButton'
import { formatPhoneDisplay } from '@/lib/phone'
import { cn } from '@/lib/format'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

export interface ChecklistItem {
  id: string
  label: string
  detail?: string
  done: boolean
  action?: ReactNode
}

interface Props {
  items: ChecklistItem[]
  venuePhone?: string | null
  bookingConfirmed?: boolean
  bookingCheckbox?: boolean
  onBookingCheckboxChange?: (checked: boolean) => void
  showBookingPanel?: boolean
  gameDate?: string
  startTime?: string
  endTime?: string
  venueName?: string
}

function CheckRow({
  index,
  label,
  detail,
  done,
  action,
}: ChecklistItem & { index: number }) {
  return (
    <div className="flex gap-4 border-b border-white/10 py-4 last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-[11px] font-semibold tabular-nums text-white/70">
        {String(index).padStart(2, '0')}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-caps">{label}</p>
            {detail ? (
              <p
                className={cn(
                  'mt-1 text-[14px]',
                  done ? 'text-white' : 'text-white/45',
                )}
              >
                {detail}
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
              done
                ? 'border-status-success/40 bg-status-success/10 text-status-success'
                : 'border-white/15 text-white/25',
            )}
            aria-hidden
          >
            {done ? <Check className="motion-check-draw h-3.5 w-3.5" /> : '○'}
          </span>
        </div>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  )
}

export function HostPublishChecklist({
  items,
  venuePhone,
  bookingConfirmed,
  bookingCheckbox,
  onBookingCheckboxChange,
  showBookingPanel,
  gameDate,
  startTime,
  endTime,
  venueName,
}: Props) {
  return (
    <div className="glass overflow-hidden">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="label-caps">Create game</p>
      </div>
      <div className="px-4">
        {items.map((item, i) => (
          <CheckRow key={item.id} index={i + 1} {...item} />
        ))}
      </div>

      {showBookingPanel ? (
        <div className="border-t border-white/10 p-4 space-y-4">
          <div>
            <p className="label-caps">Venue booking</p>
            <p className="mt-2 text-[16px] font-semibold text-white">
              {venueName ?? 'Selected venue'}
            </p>
            {gameDate && startTime ? (
              <p className="mt-1 text-[13px] text-white/45">
                {gameDate} · {startTime.slice(0, 5)}
                {endTime ? ` – ${endTime.slice(0, 5)}` : ''}
              </p>
            ) : null}
          </div>

          {venuePhone ? (
            <div className="glass p-3">
              <p className="label-caps">Venue contact</p>
              <p className="mt-1 text-[14px] text-white">
                {formatPhoneDisplay(venuePhone)}
              </p>
              <CallButton phone={venuePhone} label="Call venue" className="mt-3" />
            </div>
          ) : (
            <p className="text-[13px] text-status-warning">
              Venue phone is not available. Choose another venue or add contact details.
            </p>
          )}

          <p className="text-[12px] leading-relaxed text-white/45">
            Selecting a venue does not book it. Contact the venue to confirm this slot
            before publishing.
          </p>

          <div>
            <p className="label-caps">Venue confirmation</p>
            <label className="glass mt-3 flex cursor-pointer items-start gap-3 p-4">
              <input
                type="checkbox"
                checked={bookingCheckbox ?? false}
                disabled={bookingConfirmed}
                onChange={(e) => onBookingCheckboxChange?.(e.target.checked)}
                className="mt-1 h-4 w-4 accent-white"
              />
              <span className="text-[14px] leading-relaxed text-white">
                Yes, the venue confirmed this slot.
              </span>
            </label>
          </div>

          <div className="glass-status-warning rounded-[8px] p-4">
            <p className="label-caps text-status-warning">Host responsibility</p>
            <p className="mt-2 text-[13px] leading-relaxed text-white/70">
              You are responsible for contacting the venue and confirming the slot before
              publishing this game. PLAYR does not automatically reserve the venue.
            </p>
          </div>

          {!bookingConfirmed && bookingCheckbox && venuePhone ? (
            <p className="text-[13px] text-white/45">
              Booking will be recorded when you publish the game.
            </p>
          ) : null}

          {bookingConfirmed ? (
            <p className="flex items-center gap-2 text-[13px] font-semibold text-status-success">
              <Check className="h-4 w-4" />
              Booking confirmed
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
