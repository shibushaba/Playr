import { Header } from '@/components/layout/Header'
import { SportChip } from '@/components/sport/SportChip'
import { CallButton } from '@/components/game/CallButton'
import { HostPublishChecklist } from '@/components/trust/HostPublishChecklist'
import { ProfileCompletionGate } from '@/components/trust/ProfileCompletionGate'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { VenueCard } from '@/components/venue/VenueCard'
import { useAuth } from '@/contexts/AuthContext'
import { useLocationDiscovery } from '@/contexts/LocationContext'
import { toUserMessage } from '@/lib/errors'
import { formatPhoneDisplay } from '@/lib/phone'
import { canHostGame, getProfileCompletion, hasVerifiedEmail } from '@/lib/profileCompletion'
import type { GameVisibility } from '@/types/database'
import { getNearbyVenues } from '@/services/discovery'
import { createGame } from '@/services/games'
import { listSports } from '@/services/sports'
import { getVenue, listVenues } from '@/services/venues'
import {
  confirmGameVenueBooking,
  getVenueContactPhone,
  publishGame,
} from '@/services/verification'
import type { SportRecord, VenueRecord } from '@/types/domain'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const STEPS = [
  { n: 1, label: 'Sport' },
  { n: 2, label: 'Venue' },
  { n: 3, label: 'Time' },
  { n: 4, label: 'Players' },
  { n: 5, label: 'Review' },
] as const

function tomorrowDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export function HostPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const preselectedVenue = params.get('venueId')
  const { user, profile } = useAuth()
  const { location, radiusMeters } = useLocationDiscovery()
  const [step, setStep] = useState(preselectedVenue ? 2 : 1)
  const [sports, setSports] = useState<SportRecord[]>([])
  const [venues, setVenues] = useState<VenueRecord[]>([])
  const [sportId, setSportId] = useState('')
  const [title, setTitle] = useState('Evening pickup')
  const [minPlayers, setMinPlayers] = useState(10)
  const [maxPlayers, setMaxPlayers] = useState(14)
  const [share, setShare] = useState('120')
  const [visibility, setVisibility] = useState<GameVisibility>('public')
  const [venueId, setVenueId] = useState(preselectedVenue ?? '')
  const [bookingCheckbox, setBookingCheckbox] = useState(false)
  const [venuePhone, setVenuePhone] = useState<string | null>(null)
  const [venuePhoneLoading, setVenuePhoneLoading] = useState(false)
  const [bookingResetNotice, setBookingResetNotice] = useState(false)
  const [notes, setNotes] = useState('')
  const [gameDate, setGameDate] = useState(tomorrowDate())
  const [startTime, setStartTime] = useState('19:00')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (preselectedVenue) {
      setVenueId(preselectedVenue)
      setStep(2)
    }
  }, [preselectedVenue])

  useEffect(() => {
    void listSports()
      .then((s) => {
        setSports(s)
        if (s[0]) setSportId(s[0].id)
      })
      .catch((e) => setError(toUserMessage(e, "Couldn't load sports.")))
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadVenues() {
      try {
        let list: VenueRecord[] = []
        if (location) {
          list = await getNearbyVenues({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            radiusMeters: Math.max(radiusMeters, 25_000),
            limit: 30,
          })
        } else {
          list = await listVenues()
        }

        if (preselectedVenue && !list.some((v) => v.id === preselectedVenue)) {
          const created = await getVenue(preselectedVenue)
          if (created) list = [created, ...list]
        }

        if (!cancelled) {
          setVenues(list)
          if (preselectedVenue) {
            setVenueId(preselectedVenue)
          } else if (!venueId && list[0]) {
            setVenueId(list[0].id)
          }
        }
      } catch (e) {
        if (!cancelled) setError(toUserMessage(e, "Couldn't load venues."))
      }
    }
    void loadVenues()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid refetch loops on venueId
  }, [location, radiusMeters, preselectedVenue])

  useEffect(() => {
    if (!venueId || !user) {
      setVenuePhone(null)
      return
    }
    let cancelled = false
    setVenuePhoneLoading(true)
    void getVenueContactPhone(venueId)
      .then((phone) => {
        if (!cancelled) setVenuePhone(phone)
      })
      .catch(() => {
        if (!cancelled) setVenuePhone(null)
      })
      .finally(() => {
        if (!cancelled) setVenuePhoneLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [venueId, user])

  const [hostConfirm, setHostConfirm] = useState(false)

  useEffect(() => {
    setBookingCheckbox(false)
    setHostConfirm(false)
    setBookingResetNotice(true)
  }, [venueId, gameDate, startTime])

  const selectedSport = sports.find((s) => s.id === sportId)
  const selectedVenue = venues.find((v) => v.id === venueId)
  const nearbyVenues = useMemo(() => {
    if (!selectedSport) return venues
    const slug = selectedSport.slug
    const matched = venues.filter((v) => v.sports.includes(slug))
    return matched.length ? matched : venues
  }, [venues, selectedSport])

  const hostReady = canHostGame(profile, user)
  const profileCompletion = getProfileCompletion(profile, user)
  const endTime = `${addMinutes(startTime, 90)}:00`.slice(0, 8)

  const checklistItems = useMemo(() => {
    const nameDone = Boolean(profile?.display_name?.trim())
    const emailDone = hasVerifiedEmail(profile, user)
    const venueDone = Boolean(venueId && selectedVenue)
    const contactDone = Boolean(venuePhone)
    const bookingDone = bookingCheckbox
    const detailsDone = Boolean(sportId && title.trim() && gameDate && startTime)

    return [
      {
        id: 'profile',
        label: 'Profile',
        detail: nameDone ? profile?.display_name ?? 'Complete' : 'Add display name',
        done: nameDone,
      },
      {
        id: 'email',
        label: 'Email verified',
        detail: emailDone ? 'Verified' : 'Required to host',
        done: emailDone,
      },
      {
        id: 'venue',
        label: 'Venue',
        detail: selectedVenue?.name ?? 'Select a venue',
        done: venueDone,
      },
      {
        id: 'contact',
        label: 'Venue contact',
        detail: venuePhoneLoading
          ? 'Loading…'
          : venuePhone
            ? formatPhoneDisplay(venuePhone)
            : 'Phone required',
        done: contactDone,
        action: venuePhone ? (
          <CallButton phone={venuePhone} label="Call venue →" compact />
        ) : null,
      },
      {
        id: 'booking',
        label: 'Venue booking',
        detail: bookingDone ? 'Ready to confirm on publish' : 'Confirm slot with venue',
        done: bookingDone,
      },
      {
        id: 'details',
        label: 'Game details',
        detail: detailsDone ? 'Ready' : 'Complete earlier steps',
        done: detailsDone,
      },
    ]
  }, [
    profile,
    user,
    venueId,
    selectedVenue,
    venuePhone,
    venuePhoneLoading,
    bookingCheckbox,
    sportId,
    title,
    gameDate,
    startTime,
  ])

  async function publish() {
    if (!user) {
      navigate('/auth?next=/host')
      return
    }
    if (!hostReady) {
      setError(profileCompletion.message)
      return
    }
    if (!sportId) {
      setError('Select a sport.')
      return
    }
    if (!venueId) {
      setError('Select a venue.')
      return
    }
    if (!venuePhone) {
      setError('Venue phone is required. Choose another venue or add contact details.')
      return
    }
    if (!bookingCheckbox) {
      setError('Confirm that the venue slot is booked before publishing.')
      return
    }
    if (!hostConfirm) {
      setError('Acknowledge host responsibility before publishing.')
      return
    }
    setBusy(true)
    setError(null)
    setBookingResetNotice(false)
    let createdGameId: string | null = null
    try {
      const game = await createGame({
        title,
        description: notes || undefined,
        sportId,
        venueId,
        gameDate,
        startTime: `${startTime}:00`.slice(0, 8),
        endTime,
        minimumPlayers: minPlayers,
        maximumPlayers: maxPlayers,
        playerShare: share ? Number(share) : null,
        visibility,
      })
      createdGameId = game.id
      await confirmGameVenueBooking(game.id)
      await publishGame(game.id)
      navigate(`/games/${game.id}`)
    } catch (e) {
      const message = toUserMessage(e, "Couldn't publish game. Try again.")
      if (createdGameId) {
        navigate(`/games/${createdGameId}`, {
          state: { publishError: message },
        })
        return
      }
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <div>
        <Header title="Host a game" />
        <div className="page-pad space-y-4 py-6">
          <p className="text-[14px] text-muted">Please sign in to host a game.</p>
          <PrimaryButton fullWidth onClick={() => navigate('/auth?next=/host')}>
            Sign in
          </PrimaryButton>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-10">
      <Header
        title="Host a game"
        subtitle={`${String(STEPS[step - 1].n).padStart(2, '0')} ${STEPS[step - 1].label.toUpperCase()} · ${step} of ${STEPS.length}`}
        onBack={step > 1 ? () => setStep((s) => s - 1) : undefined}
      />

      <div className="page-pad py-6">
        <nav className="mb-8 flex gap-1" aria-label="Steps">
          {STEPS.map((s) => {
            const n = s.n
            const active = n === step
            const done = n < step
            return (
              <div key={s.label} className="flex-1">
                <div
                  className={
                    active
                      ? 'h-0.5 bg-white'
                      : done
                        ? 'h-0.5 bg-white/60'
                        : 'h-0.5 bg-white/10'
                  }
                />
                <p
                  className={
                    active
                      ? 'mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white'
                      : 'mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45'
                  }
                >
                  {String(s.n).padStart(2, '0')} {s.label}
                </p>
              </div>
            )
          })}
        </nav>

        {error ? (
          <p className="glass motion-error-in mb-4 px-3 py-2 text-[13px] text-white">
            {error}
          </p>
        ) : null}

        {step === 1 ? (
          <div className="space-y-6 motion-step-in">
            <div>
              <h2 className="display-lg">
                What
              </h2>
              <p className="mt-1 text-[14px] text-white/45">
                Pick a sport and name the game.
              </p>
            </div>
            <div>
              <p className="label-caps mb-3">Sport</p>
              <div className="flex flex-wrap gap-2">
                {sports.map((s) => (
                  <SportChip
                    key={s.id}
                    sport={s}
                    selected={sportId === s.id}
                    onClick={() => setSportId(s.id)}
                  />
                ))}
              </div>
            </div>
            <Field label="Game title">
              <input
                className="glass-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <PrimaryButton
              fullWidth
              disabled={!sportId || !title.trim()}
              onClick={() => setStep(2)}
            >
              Where
            </PrimaryButton>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6 motion-step-in">
            <div>
              <h2 className="display-lg">
                Where
              </h2>
              <p className="mt-1 text-[14px] text-white/45">
                Nearby venues, sorted by distance.
              </p>
            </div>

            {selectedVenue ? (
              <div className="glass-elevated p-4">
                <p className="label-caps">Venue</p>
                <p className="mt-2 text-[18px] font-semibold tracking-tight text-white">
                  {selectedVenue.name}
                </p>
                <p className="mt-1 text-[13px] text-white/45">
                  {[
                    selectedVenue.address,
                    selectedVenue.city,
                    selectedVenue.distanceLabel,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">
                  Selected ✓ — selecting does not book the venue
                </p>
                {venuePhone ? (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="label-caps">Phone</p>
                    <p className="mt-1 text-[14px] text-white">
                      {formatPhoneDisplay(venuePhone)}
                    </p>
                    <CallButton phone={venuePhone} label="Call venue" className="mt-3" />
                  </div>
                ) : venuePhoneLoading ? (
                  <p className="mt-4 text-[12px] text-white/45">Loading venue contact…</p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              {nearbyVenues.map((v) => (
                <VenueCard
                  key={v.id}
                  venue={v}
                  selected={venueId === v.id}
                  onClick={() => setVenueId(v.id)}
                />
              ))}
            </div>
            <SecondaryButton
              fullWidth
              onClick={() => navigate('/venues/new?returnTo=create-game')}
            >
              + Add a new venue
            </SecondaryButton>
            <PrimaryButton
              fullWidth
              disabled={!venueId}
              onClick={() => setStep(3)}
            >
              When
            </PrimaryButton>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6 motion-step-in">
            <div>
              <h2 className="display-lg">
                When
              </h2>
              <p className="mt-1 text-[14px] text-white/45">
                Date and kickoff time.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input
                  className="glass-input"
                  type="date"
                  value={gameDate}
                  onChange={(e) => setGameDate(e.target.value)}
                />
              </Field>
              <Field label="Start time">
                <input
                  className="glass-input"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>
            </div>
            <p className="text-[13px] text-muted">
              Confirmation deadline is set to 3 hours before kickoff.
            </p>
            <PrimaryButton fullWidth onClick={() => setStep(4)}>
              Who
            </PrimaryButton>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-6 motion-step-in">
            <div>
              <h2 className="display-lg">
                Who
              </h2>
              <p className="mt-1 text-[14px] text-white/45">
                Capacity, share, and visibility.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min players">
                <input
                  className="glass-input"
                  type="number"
                  min={2}
                  value={minPlayers}
                  onChange={(e) => setMinPlayers(Number(e.target.value))}
                />
              </Field>
              <Field label="Max players">
                <input
                  className="glass-input"
                  type="number"
                  min={minPlayers}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                />
              </Field>
            </div>
            <Field label="Expected player share (₹, optional)">
              <input
                className="glass-input"
                inputMode="numeric"
                value={share}
                onChange={(e) => setShare(e.target.value)}
                placeholder="e.g. 100"
              />
              <p className="mt-1.5 text-[12px] text-muted">
                Display only. Collected offline — PLAYR never processes payments.
              </p>
            </Field>
            <div>
              <p className="label-caps mb-3">Visibility</p>
              <div className="grid grid-cols-3 gap-2">
                {(['public', 'private', 'invite_only'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={
                      visibility === v
                        ? 'min-h-11 rounded-[8px] border border-white/30 bg-white text-[12px] font-semibold uppercase tracking-[0.06em] text-cta'
                        : 'glass min-h-11 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/70 transition hover:border-white/20'
                    }
                  >
                    {v === 'invite_only' ? 'Invite' : v}
                  </button>
                ))}
              </div>
            </div>
            <PrimaryButton fullWidth onClick={() => setStep(5)}>
              Review
            </PrimaryButton>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-6 motion-step-in">
            <div>
              <h2 className="display-lg">Review</h2>
              <p className="mt-1 text-[14px] text-white/45">
                Confirm venue booking and publish when ready.
              </p>
            </div>

            {!hostReady ? (
              <ProfileCompletionGate requiredFor="host" />
            ) : null}

            {bookingResetNotice ? (
              <p className="glass-status-warning rounded-[8px] px-4 py-3 text-[13px] text-status-warning">
                Venue confirmation reset — game details changed. Confirm booking again before publishing.
              </p>
            ) : null}

            <HostPublishChecklist
              items={checklistItems}
              venuePhone={venuePhone}
              showBookingPanel
              venueName={selectedVenue?.name}
              gameDate={gameDate}
              startTime={`${startTime}:00`.slice(0, 8)}
              endTime={endTime}
              bookingCheckbox={bookingCheckbox}
              onBookingCheckboxChange={setBookingCheckbox}
            />

            <Field label="Notes for players">
              <textarea
                className="glass-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Kits, skill level, parking…"
              />
            </Field>

            <label className="glass flex cursor-pointer items-start gap-3 p-4">
              <input
                type="checkbox"
                checked={hostConfirm}
                onChange={(e) => setHostConfirm(e.target.checked)}
                className="mt-1 h-4 w-4 accent-white"
              />
              <span className="text-[14px] leading-relaxed text-white">
                I confirm that I contacted the venue and they confirmed this slot.
                PLAYR does not automatically reserve the venue.
              </span>
            </label>

            <PrimaryButton
              fullWidth
              disabled={
                !hostReady ||
                !hostConfirm ||
                !bookingCheckbox ||
                !venuePhone ||
                busy
              }
              onClick={() => void publish()}
            >
              {busy ? 'Publishing…' : 'Publish game →'}
            </PrimaryButton>
            <SecondaryButton fullWidth onClick={() => navigate('/groups/new')}>
              Or create a recurring group
            </SecondaryButton>
          </div>
        ) : null}
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
