import { Header } from '@/components/layout/Header'
import { ProfileCompletionGate } from '@/components/trust/ProfileCompletionGate'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { VenueMapPicker } from '@/components/venue/VenueMapPicker'
import { useAuth } from '@/contexts/AuthContext'
import { useLocationDiscovery } from '@/contexts/LocationContext'
import { formatDistanceMeters } from '@/lib/location'
import { toUserMessage, AppError } from '@/lib/errors'
import { normalizePhoneE164 } from '@/lib/phone'
import type { PlaceSuggestion } from '@/lib/maps'
import { listSports } from '@/services/sports'
import {
  createVenue,
  findSimilarVenues,
  type SimilarVenue,
} from '@/services/venues'
import type { SportRecord } from '@/types/domain'
import { canJoinGame } from '@/lib/profileCompletion'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export function AddVenuePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returnTo = params.get('returnTo')
  const { user, profile } = useAuth()
  const { refreshAreas } = useLocationDiscovery()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')
  const [stateName, setStateName] = useState('Kerala')
  const [place, setPlace] = useState<PlaceSuggestion | null>(null)
  const [sports, setSports] = useState<SportRecord[]>([])
  const [selectedSports, setSelectedSports] = useState<string[]>([])
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [similar, setSimilar] = useState<SimilarVenue[]>([])
  const [showDuplicate, setShowDuplicate] = useState(false)

  const backTo = useMemo(() => {
    if (returnTo === 'create-game' || returnTo === 'host') return '/host'
    if (returnTo === 'venue-select') return '/venues'
    return '/host'
  }, [returnTo])

  useEffect(() => {
    void listSports().then((s) => {
      setSports(s)
      if (s[0]) setSelectedSports([s[0].slug])
    })
  }, [])

  function toggleSport(slug: string) {
    setSelectedSports((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    )
  }

  function onConfirmPlace(p: PlaceSuggestion) {
    setPlace(p)
    setShowDuplicate(false)
    setSimilar([])
    if (!name.trim()) setName(p.name)
    if (p.address) setAddress(p.address)
    if (p.city) setArea(p.city)
    if (p.state) setStateName(p.state)
  }

  function goWithVenue(venueId: string) {
    if (returnTo === 'venue-select') {
      navigate(`/venues?venueId=${venueId}`, { replace: true })
      return
    }
    navigate(`/host?venueId=${venueId}`, { replace: true })
  }

  async function submit(forceCreate = false) {
    if (!place) {
      setError('Select the venue location on the map.')
      return
    }
    if (!name.trim()) {
      setError('Enter a venue name.')
      return
    }
    if (!area.trim()) {
      setError('City or area is required.')
      return
    }
    if (selectedSports.length === 0) {
      setError('Select at least one sport.')
      return
    }
    const venuePhone = normalizePhoneE164(phone)
    if (!venuePhone) {
      setError('Enter a valid venue phone number.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      if (!forceCreate) {
        const matches = await findSimilarVenues({
          latitude: place.latitude,
          longitude: place.longitude,
          name: name.trim(),
          radiusMeters: 80,
        })
        if (matches.length > 0) {
          setSimilar(matches)
          setShowDuplicate(true)
          setBusy(false)
          return
        }
      }

      const venue = await createVenue({
        name: name.trim(),
        address: address.trim() || place.address,
        city: area.trim(),
        state: stateName.trim() || place.state || 'Kerala',
        sports: selectedSports,
        latitude: place.latitude,
        longitude: place.longitude,
        mapUrl: place.mapUrl,
        phone: venuePhone,
        forceCreate,
      })
      refreshAreas()
      goWithVenue(venue.id)
    } catch (err) {
      if (err instanceof AppError && err.code === 'SIMILAR_VENUE_EXISTS') {
        const matches = await findSimilarVenues({
          latitude: place.latitude,
          longitude: place.longitude,
          name: name.trim(),
        })
        setSimilar(matches)
        setShowDuplicate(true)
      } else {
        setError(toUserMessage(err, "Couldn't create venue. Try again."))
      }
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <div>
        <Header title="Add venue" backTo={backTo} />
        <div className="page-pad space-y-4 py-6">
          <p className="text-[14px] text-muted">Please sign in to add a venue.</p>
          <PrimaryButton
            fullWidth
            onClick={() =>
              navigate(
                `/auth?next=${encodeURIComponent(`/venues/new?returnTo=${returnTo ?? 'create-game'}`)}`,
              )
            }
          >
            Sign in
          </PrimaryButton>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Add venue" backTo={backTo} subtitle="Exact map location required" />
      <div className="page-pad py-6">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            void submit(false)
          }}
        >
          {error ? (
            <p className="glass px-3 py-2 text-[13px] text-white">
              {error}
            </p>
          ) : null}

          {!canJoinGame(profile, user) ? (
            <ProfileCompletionGate requiredFor="venue" />
          ) : null}

          <Field label="Venue name">
            <input
              required
              className="glass-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Arena Football Turf"
            />
          </Field>

          <VenueMapPicker onConfirm={onConfirmPlace} confirmed={place} />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Address">
              <input
                className="glass-input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street / landmark"
              />
              <p className="mt-1.5 text-[12px] text-muted">
                Editing address does not change the map coordinates.
              </p>
            </Field>
            <Field label="City / area">
              <input
                required
                className="glass-input"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. Kozhikode"
              />
            </Field>
          </div>

          <Field label="Venue phone (required)">
            <div className="glass-input flex min-h-11 items-center gap-2 !px-3">
              <span className="text-[14px] text-white/45">+91</span>
              <input
                required
                className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="numeric"
                placeholder="9876543210"
                autoComplete="tel"
              />
            </div>
            <p className="mt-1.5 text-[12px] text-muted">
              Business contact for hosts to confirm bookings. Not shown in public discovery.
            </p>
          </Field>

          <div>
            <p className="label-caps mb-3">Sports available</p>
            <div className="flex flex-wrap gap-2">
              {sports.map((s) => {
                const on = selectedSports.includes(s.slug)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSport(s.slug)}
                    className={
                      on
                        ? 'min-h-10 rounded-[8px] border border-white/30 bg-white px-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-cta'
                        : 'glass min-h-10 px-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/70 transition hover:border-white/20'
                    }
                  >
                    {s.name}
                  </button>
                )
              })}
            </div>
          </div>

          {showDuplicate && similar.length > 0 ? (
            <div className="glass-elevated space-y-3 p-4">
              <p className="text-[15px] font-semibold text-white">
                A similar venue already exists nearby.
              </p>
              {similar.map((v) => (
                <div key={v.id} className="glass p-3">
                  <p className="text-[14px] font-medium text-white">{v.name}</p>
                  <p className="mt-1 text-[13px] text-muted">
                    {[v.city, formatDistanceMeters(v.distanceMeters)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <SecondaryButton
                    type="button"
                    className="mt-3"
                    fullWidth
                    onClick={() => goWithVenue(v.id)}
                  >
                    Use existing
                  </SecondaryButton>
                </div>
              ))}
              <PrimaryButton
                type="button"
                fullWidth
                disabled={busy}
                onClick={() => void submit(true)}
              >
                Create anyway
              </PrimaryButton>
            </div>
          ) : null}

          <PrimaryButton
            type="submit"
            fullWidth
            disabled={
              busy ||
              !canJoinGame(profile, user) ||
              !name.trim() ||
              !area.trim() ||
              !place ||
              !phone.trim() ||
              selectedSports.length === 0
            }
          >
            {busy ? 'Creating…' : 'Create venue'}
          </PrimaryButton>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="label-caps mb-2 block">{label}</span>
      {children}
    </label>
  )
}
