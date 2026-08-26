import { Header } from '@/components/layout/Header'
import { SportChip } from '@/components/sport/SportChip'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { VenueCard } from '@/components/venue/VenueCard'
import { useAuth } from '@/contexts/AuthContext'
import { useLocationDiscovery } from '@/contexts/LocationContext'
import { toUserMessage } from '@/lib/errors'
import type { GameVisibility } from '@/types/database'
import { getNearbyVenues } from '@/services/discovery'
import { createGame } from '@/services/games'
import { listSports } from '@/services/sports'
import { getVenue, listVenues } from '@/services/venues'
import type { SportRecord, VenueRecord } from '@/types/domain'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const STEPS = ['What', 'Where', 'When', 'Who', 'Review'] as const

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
  const { user } = useAuth()
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
  const [hostConfirm, setHostConfirm] = useState(false)
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

  const selectedSport = sports.find((s) => s.id === sportId)
  const selectedVenue = venues.find((v) => v.id === venueId)
  const nearbyVenues = useMemo(() => {
    if (!selectedSport) return venues
    const slug = selectedSport.slug
    const matched = venues.filter((v) => v.sports.includes(slug))
    return matched.length ? matched : venues
  }, [venues, selectedSport])

  async function publish() {
    if (!user) {
      navigate('/auth?next=/host')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const game = await createGame({
        title,
        description: notes || undefined,
        sportId,
        venueId,
        gameDate,
        startTime: `${startTime}:00`.slice(0, 8),
        endTime: `${addMinutes(startTime, 90)}:00`.slice(0, 8),
        minimumPlayers: minPlayers,
        maximumPlayers: maxPlayers,
        playerShare: share ? Number(share) : null,
        visibility,
      })
      navigate(`/games/${game.id}`)
    } catch (e) {
      setError(toUserMessage(e, "Couldn't create game. Try again."))
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <div>
        <Header title="Host a game" backTo="/home" />
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
        subtitle={`${STEPS[step - 1]} · ${step} of ${STEPS.length}`}
        backTo={step > 1 ? undefined : '/home'}
        onBack={step > 1 ? () => setStep((s) => s - 1) : undefined}
      />

      <div className="page-pad py-6">
        <nav className="mb-8 flex gap-1" aria-label="Steps">
          {STEPS.map((label, i) => {
            const n = i + 1
            const active = n === step
            const done = n < step
            return (
              <div key={label} className="flex-1">
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
                  {label}
                </p>
              </div>
            )
          })}
        </nav>

        {error ? (
          <p className="glass mb-4 px-3 py-2 text-[13px] text-white">
            {error}
          </p>
        ) : null}

        {step === 1 ? (
          <div className="space-y-6 animate-fade-up">
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
                className="field"
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
          <div className="space-y-6 animate-fade-up">
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
                  Selected ✓
                </p>
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
          <div className="space-y-6 animate-fade-up">
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
                  className="field"
                  type="date"
                  value={gameDate}
                  onChange={(e) => setGameDate(e.target.value)}
                />
              </Field>
              <Field label="Start time">
                <input
                  className="field"
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
          <div className="space-y-6 animate-fade-up">
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
                  className="field"
                  type="number"
                  min={2}
                  value={minPlayers}
                  onChange={(e) => setMinPlayers(Number(e.target.value))}
                />
              </Field>
              <Field label="Max players">
                <input
                  className="field"
                  type="number"
                  min={minPlayers}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                />
              </Field>
            </div>
            <Field label="Expected player share (₹, optional)">
              <input
                className="field"
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
          <div className="space-y-6 animate-fade-up">
            <div>
              <h2 className="display-lg">
                Review
              </h2>
              <p className="mt-1 text-[14px] text-white/45">
                Confirm details and publish.
              </p>
            </div>

            <div className="glass p-4 space-y-3">
              <p className="label-caps">{selectedSport?.name}</p>
              <p className="text-[22px] font-semibold tracking-tight text-white">
                {title}
              </p>
              <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-[13px]">
                <div>
                  <p className="label-caps">Venue</p>
                  <p className="mt-1 text-white">{selectedVenue?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="label-caps">When</p>
                  <p className="mt-1 text-white">
                    {gameDate} · {startTime}
                  </p>
                </div>
                <div>
                  <p className="label-caps">Players</p>
                  <p className="mt-1 text-white">
                    {minPlayers}–{maxPlayers}
                  </p>
                </div>
                <div>
                  <p className="label-caps">Share</p>
                  <p className="mt-1 text-white">
                    {share ? `₹${share}/person` : 'Free'}
                  </p>
                </div>
              </div>
            </div>

            <Field label="Notes for players">
              <textarea
                className="field min-h-24 py-3"
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
                I confirm I am responsible for selecting, booking, and paying the
                venue. PLAYR does not book or pay venues.
              </span>
            </label>

            <PrimaryButton
              fullWidth
              disabled={!hostConfirm || busy}
              onClick={() => void publish()}
            >
              {busy ? 'Publishing…' : 'Publish game'}
            </PrimaryButton>
            <SecondaryButton fullWidth onClick={() => navigate('/groups/new')}>
              Or create a recurring group
            </SecondaryButton>
          </div>
        ) : null}
      </div>

      <style>{`
        .field {
          width: 100%;
          min-height: 3rem;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.045);
          padding: 0 1rem;
          outline: none;
          color: #fff;
        }
        .field:focus {
          border-color: rgba(255, 255, 255, 0.45);
          background: rgba(255, 255, 255, 0.07);
        }
      `}</style>
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
