import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useLocationDiscovery } from '@/contexts/LocationContext'
import { toUserMessage } from '@/lib/errors'
import {
  CHECK_IN_RADIUS_METERS,
  formatDistanceMeters,
  haversineMeters,
} from '@/lib/location'
import {
  isSafeHttpUrl,
  osmEmbedUrl,
  resolveVenueDirectionsUrl,
  resolveVenueMapViewUrl,
} from '@/lib/maps'
import { requestBrowserPosition } from '@/services/checkin'
import type { VenueRecord } from '@/types/domain'
import { MapPin, Navigation } from 'lucide-react'
import { useMemo, useState } from 'react'

type ReachStatus = 'idle' | 'checking' | 'ready' | 'far' | 'error'

interface Props {
  venue: VenueRecord
  /** Show check-in range hint for confirmed players */
  showCheckInHint?: boolean
  className?: string
}

export function VenueReachPanel({
  venue,
  showCheckInHint = false,
  className,
}: Props) {
  const { location } = useLocationDiscovery()
  const [reachStatus, setReachStatus] = useState<ReachStatus>('idle')
  const [reachMeters, setReachMeters] = useState<number | null>(null)
  const [reachError, setReachError] = useState<string | null>(null)

  const hasCoords = venue.latitude != null && venue.longitude != null
  const directionsUrl = resolveVenueDirectionsUrl(venue)
  const mapViewUrl = resolveVenueMapViewUrl(venue)

  const savedDistanceMeters = useMemo(() => {
    if (venue.distanceMeters != null) return venue.distanceMeters
    if (
      location &&
      hasCoords &&
      venue.latitude != null &&
      venue.longitude != null
    ) {
      return haversineMeters(
        location.coords.latitude,
        location.coords.longitude,
        venue.latitude,
        venue.longitude,
      )
    }
    return null
  }, [venue.distanceMeters, venue.latitude, venue.longitude, location, hasCoords])

  async function checkReach() {
    if (!hasCoords) return
    setReachStatus('checking')
    setReachError(null)
    try {
      const pos = await requestBrowserPosition()
      const meters = haversineMeters(
        pos.coords.latitude,
        pos.coords.longitude,
        venue.latitude!,
        venue.longitude!,
      )
      setReachMeters(meters)
      setReachStatus(meters <= CHECK_IN_RADIUS_METERS ? 'ready' : 'far')
    } catch (e) {
      setReachStatus('error')
      setReachError(toUserMessage(e, "Couldn't verify your location."))
    }
  }

  function openDirections() {
    if (!directionsUrl) return
    window.open(directionsUrl, '_blank', 'noopener,noreferrer')
  }

  const displayMeters = reachMeters ?? savedDistanceMeters
  const withinCheckIn =
    displayMeters != null && displayMeters <= CHECK_IN_RADIUS_METERS

  return (
    <section className={className}>
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-white/45" aria-hidden />
        <p className="label-caps">Venue location</p>
      </div>

      <p className="mt-3 font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-tight text-white">
        {venue.name}
      </p>
      {(venue.address || venue.city) ? (
        <p className="mt-1 text-[13px] leading-relaxed text-white/45">
          {[venue.address, venue.city, venue.state].filter(Boolean).join(', ')}
        </p>
      ) : null}

      {hasCoords ? (
        <iframe
          title="Venue map"
          className="map-frame mt-4 mb-3 h-44 w-full rounded-[8px]"
          src={osmEmbedUrl(venue.latitude!, venue.longitude!)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : null}

      {displayMeters != null ? (
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/70">
          {formatDistanceMeters(displayMeters)} away
          {savedDistanceMeters != null && reachMeters == null
            ? ' · from your saved area'
            : reachMeters != null
              ? ' · from you now'
              : null}
        </p>
      ) : null}

      {reachStatus === 'ready' || withinCheckIn ? (
        <div className="glass-status-success mt-3 rounded-[8px] p-3">
          <p className="text-[13px] font-semibold text-status-success">
            ✓ You&apos;re close enough to reach the venue
          </p>
          {showCheckInHint ? (
            <p className="mt-1 text-[12px] text-white/45">
              Check-in opens 30 minutes before kickoff when you&apos;re within{' '}
              {CHECK_IN_RADIUS_METERS} m.
            </p>
          ) : null}
        </div>
      ) : null}

      {reachStatus === 'far' && reachMeters != null ? (
        <div className="glass-status-warning mt-3 rounded-[8px] p-3">
          <p className="text-[13px] font-semibold text-status-warning">
            {formatDistanceMeters(reachMeters)} away — get directions to reach
            the venue
          </p>
          <p className="mt-1 text-[12px] text-white/45">
            Check-in requires you to be within {CHECK_IN_RADIUS_METERS} m of the
            venue.
          </p>
        </div>
      ) : null}

      {reachError ? (
        <p className="mt-3 text-[13px] text-white/70">{reachError}</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {directionsUrl ? (
          <PrimaryButton
            fullWidth
            type="button"
            onClick={openDirections}
            className="min-h-11"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Navigation className="h-4 w-4" />
              Get directions
            </span>
          </PrimaryButton>
        ) : null}
        {hasCoords ? (
          <SecondaryButton
            fullWidth
            type="button"
            disabled={reachStatus === 'checking'}
            onClick={() => void checkReach()}
            className="min-h-11"
          >
            {reachStatus === 'checking'
              ? 'Checking…'
              : 'Can I reach the venue?'}
          </SecondaryButton>
        ) : null}
      </div>

      {mapViewUrl && mapViewUrl !== directionsUrl && isSafeHttpUrl(mapViewUrl) ? (
        <SecondaryButton
          fullWidth
          type="button"
          className="mt-2 min-h-11"
          onClick={() =>
            window.open(mapViewUrl, '_blank', 'noopener,noreferrer')
          }
        >
          Open in Maps
        </SecondaryButton>
      ) : null}

      {!hasCoords && !directionsUrl ? (
        <p className="mt-3 text-[13px] text-white/45">
          Map location is not available for this venue yet.
        </p>
      ) : null}
    </section>
  )
}
