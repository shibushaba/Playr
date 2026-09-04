import { cn } from '@/lib/format'
import { formatPhoneDisplay } from '@/lib/phone'
import type { VenueRecord } from '@/types/domain'
import { Link } from 'react-router-dom'

interface Props {
  venue: VenueRecord
  to?: string
  selected?: boolean
  onClick?: () => void
  className?: string
}

export function VenueCard({ venue, to, selected, onClick, className }: Props) {
  const distance =
    venue.distanceLabel ||
    (venue.distanceKm != null ? `${venue.distanceKm.toFixed(1)} km` : null)

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight text-white">
            {venue.name}
          </p>
          <p className="mt-1 text-[13px] text-white/45">
            {[venue.city, distance].filter(Boolean).join(' · ') || 'Venue'}
          </p>
          {venue.phone ? (
            <p className="mt-1 text-[13px] text-white/55">
              {formatPhoneDisplay(venue.phone)}
            </p>
          ) : null}
        </div>
        {selected ? (
          <span className="label-caps shrink-0 text-white">Selected ✓</span>
        ) : venue.sports?.[0] ? (
          <span className="label-caps shrink-0">{venue.sports[0]}</span>
        ) : null}
      </div>
    </>
  )

  const cls = cn(
    'motion-card glass block w-full p-4 text-left',
    selected && 'border-white/25 bg-white/[0.08]',
    className,
  )

  if (to) {
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  )
}
