import { GameCard } from '@/components/game/GameCard'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useLocationDiscovery } from '@/contexts/LocationContext'
import { toUserMessage } from '@/lib/errors'
import { formatDistanceMeters } from '@/lib/location'
import { isSafeHttpUrl, osmEmbedUrl } from '@/lib/maps'
import { getNearbyGames } from '@/services/discovery'
import { getVenue } from '@/services/venues'
import type { GameListItem, VenueRecord } from '@/types/domain'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { VenueStatusBadge } from '@/components/game/StatusBadge'

export function VenueDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { location, radiusMeters } = useLocationDiscovery()
  const [venue, setVenue] = useState<VenueRecord | null>(null)
  const [games, setGames] = useState<GameListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const v = await getVenue(id!)
        if (!v) {
          if (!cancelled) setError('Venue not found.')
          return
        }
        if (!cancelled) setVenue(v)
        if (location) {
          const nearby = await getNearbyGames({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            radiusMeters: Math.max(radiusMeters, 25_000),
            limit: 20,
          })
          if (!cancelled) {
            setGames(nearby.filter((g) => g.venue?.id === id))
          }
        }
      } catch (e) {
        if (!cancelled) setError(toUserMessage(e, "Couldn't load venue."))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id, location, radiusMeters])

  if (loading) {
    return (
      <div>
        <Header title="Venue" backTo="/explore" />
        <div className="page-pad py-8">
          <div className="glass h-40 animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !venue) {
    return (
      <div>
        <Header title="Venue" backTo="/explore" />
        <div className="page-pad py-6">
          <EmptyState title="Venue unavailable" description={error ?? undefined} />
        </div>
      </div>
    )
  }

  const distance =
    venue.distanceLabel ||
    (venue.distanceKm != null
      ? formatDistanceMeters(venue.distanceKm * 1000)
      : location && venue.latitude != null && venue.longitude != null
        ? formatDistanceMeters(
            haversineMeters(
              location.coords.latitude,
              location.coords.longitude,
              venue.latitude,
              venue.longitude,
            ),
          )
        : null)

  const mapUrl =
    venue.mapUrl && isSafeHttpUrl(venue.mapUrl) ? venue.mapUrl : null

  return (
    <div>
      <Header title="Venue" backTo="/explore" />
      <div className="page-pad space-y-8 py-6">
        <header className="border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <VenueStatusBadge status={venue.status} />
            {distance ? (
              <span className="text-[12px] uppercase tracking-[0.06em] text-white/45">
                {distance}
              </span>
            ) : null}
          </div>
          <h1 className="display-xl mt-4">
            {venue.name}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-white/45">
            {venue.address}
            {venue.city ? `, ${venue.city}` : null}
            {venue.state ? `, ${venue.state}` : null}
          </p>
        </header>

        {venue.description ? (
          <p className="text-[14px] leading-relaxed text-white/70">{venue.description}</p>
        ) : null}

        {venue.sports.length ? (
          <div>
            <p className="label-caps">Sports</p>
            <p className="mt-2 text-[15px] font-medium text-white">
              {venue.sports.join(' · ')}
            </p>
          </div>
        ) : null}

        {venue.facilities.length ? (
          <div>
            <p className="label-caps">Facilities</p>
            <p className="mt-2 text-[14px] text-white/45">{venue.facilities.join(' · ')}</p>
          </div>
        ) : null}

        <div>
          <p className="label-caps mb-3">Map</p>
          {venue.latitude != null && venue.longitude != null ? (
            <iframe
              title="Venue map"
              className="map-frame mb-3 h-40 w-full"
              src={osmEmbedUrl(venue.latitude, venue.longitude)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : null}
          {mapUrl ? (
            <SecondaryButton
              fullWidth
              type="button"
              onClick={() =>
                window.open(mapUrl, '_blank', 'noopener,noreferrer')
              }
            >
              Open in Maps
            </SecondaryButton>
          ) : (
            <p className="text-[13px] text-white/45">
              Map link not available for this venue yet.
            </p>
          )}
        </div>

        <PrimaryButton
          fullWidth
          onClick={() => navigate(`/host?venueId=${venue.id}`)}
        >
          Host a game here
        </PrimaryButton>

        <section>
          <h2 className="section-label mb-4">
            Upcoming games
          </h2>
          {games.length ? (
            <div className="space-y-3">
              {games.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-white/45">
              No upcoming public games here yet.{' '}
              <Link
                to={`/host?venueId=${venue.id}`}
                className="font-semibold text-white underline-offset-2 hover:underline"
              >
                Be the first to host
              </Link>
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
