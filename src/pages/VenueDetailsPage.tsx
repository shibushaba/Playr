import { LoadingBlock } from '@/components/motion/LoadingBlock'
import { GameCard } from '@/components/game/GameCard'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useLocationDiscovery } from '@/contexts/LocationContext'
import { toUserMessage } from '@/lib/errors'
import { formatDistanceMeters, haversineMeters } from '@/lib/location'
import { isSafeHttpUrl, osmEmbedUrl } from '@/lib/maps'
import { getNearbyGames } from '@/services/discovery'
import { getVenue } from '@/services/venues'
import type { GameListItem, VenueRecord } from '@/types/domain'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { VenueStatusBadge } from '@/components/game/StatusBadge'
import { VenueEditSheet } from '@/components/venue/VenueEditSheet'
import { useAuth } from '@/contexts/AuthContext'
import { getVenueRatingSummary, type VenueRatingSummary } from '@/services/community'

export function VenueDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { location, radiusMeters } = useLocationDiscovery()
  const [venue, setVenue] = useState<VenueRecord | null>(null)
  const [games, setGames] = useState<GameListItem[]>([])
  const [rating, setRating] = useState<VenueRatingSummary | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [v, nearby, ratingSummary] = await Promise.all([
          getVenue(id!),
          location
            ? getNearbyGames({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                radiusMeters: Math.max(radiusMeters, 25_000),
                limit: 20,
              })
            : Promise.resolve([] as GameListItem[]),
          getVenueRatingSummary(id!),
        ])
        if (!v) {
          if (!cancelled) setError('Venue not found.')
          return
        }
        if (!cancelled) {
          setVenue(v)
          setGames(nearby.filter((g) => g.venue?.id === id))
          setRating(ratingSummary)
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
          <LoadingBlock />
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
            {venue.status === 'community_added' ? (
              <span className="text-[12px] text-white/45">
                Added by the PLAYR community. Verification is pending.
              </span>
            ) : null}
            {rating?.display === 'rated' && rating.average_rating != null ? (
              <span className="text-[12px] text-white/55">
                ★ {rating.average_rating} ({rating.review_count} reviews)
              </span>
            ) : rating?.display === 'insufficient' ? (
              <span className="text-[12px] text-white/45">Not enough reviews</span>
            ) : null}
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

        {user && (venue.status === 'community_added' || venue.status === 'verified') ? (
          <SecondaryButton fullWidth type="button" onClick={() => setEditOpen(true)}>
            Edit venue
          </SecondaryButton>
        ) : null}

        <VenueEditSheet
          open={editOpen}
          venue={venue}
          onClose={() => setEditOpen(false)}
          onSubmitted={() => setEditOpen(false)}
        />

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
