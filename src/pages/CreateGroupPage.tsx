import { Header } from '@/components/layout/Header'
import { SportChip } from '@/components/sport/SportChip'
import { ProfileCompletionGate } from '@/components/trust/ProfileCompletionGate'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { VenueCard } from '@/components/venue/VenueCard'
import { useAuth } from '@/contexts/AuthContext'
import { useLocationDiscovery } from '@/contexts/LocationContext'
import { toUserMessage } from '@/lib/errors'
import { canCreateGroup } from '@/lib/profileCompletion'
import type { GroupVisibility, RecurrenceType } from '@/types/database'
import { getNearbyVenues } from '@/services/discovery'
import { createGroup } from '@/services/groups'
import { listSports } from '@/services/sports'
import { listVenues } from '@/services/venues'
import type { SportRecord, VenueRecord } from '@/types/domain'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const WEEKDAYS = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 7, label: 'Sun' },
]

export function CreateGroupPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { location, radiusMeters } = useLocationDiscovery()
  const [step, setStep] = useState(1)
  const [sports, setSports] = useState<SportRecord[]>([])
  const [venues, setVenues] = useState<VenueRecord[]>([])
  const [sportId, setSportId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [venueId, setVenueId] = useState('')
  const [startTime, setStartTime] = useState('19:00')
  const [duration, setDuration] = useState(60)
  const [repeat, setRepeat] = useState<'daily' | 'weekly' | 'custom'>('daily')
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5])
  const [endsOn, setEndsOn] = useState('')
  const [minPlayers, setMinPlayers] = useState(10)
  const [maxPlayers, setMaxPlayers] = useState(14)
  const [visibility, setVisibility] = useState<GroupVisibility>('public')
  const [autoOpen, setAutoOpen] = useState(true)
  const [priorityHours, setPriorityHours] = useState(6)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void listSports()
      .then((s) => {
        setSports(s)
        if (s[0]) {
          setSportId(s[0].id)
          setName(`${s[0].name} regulars`)
        }
      })
      .catch((e) => setError(toUserMessage(e, "Couldn't load sports.")))
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (location) {
          const list = await getNearbyVenues({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            radiusMeters: Math.max(radiusMeters, 25_000),
            limit: 30,
          })
          if (!cancelled) {
            setVenues(list)
            if (!venueId && list[0]) setVenueId(list[0].id)
          }
        } else {
          const list = await listVenues()
          if (!cancelled) {
            setVenues(list)
            if (!venueId && list[0]) setVenueId(list[0].id)
          }
        }
      } catch (e) {
        if (!cancelled) setError(toUserMessage(e, "Couldn't load venues."))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [location, radiusMeters, venueId])

  if (!user) {
    return (
      <div>
        <Header title="Create group" backTo="/groups" />
        <div className="page-pad space-y-4 py-6">
          <p className="text-[14px] text-muted">Sign in to create a recurring group.</p>
          <PrimaryButton fullWidth onClick={() => navigate('/auth?next=/groups/new')}>
            Sign in
          </PrimaryButton>
        </div>
      </div>
    )
  }

  const sport = sports.find((s) => s.id === sportId)
  const venue = venues.find((v) => v.id === venueId)

  function toggleDay(id: number) {
    setWeekdays((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id].sort(),
    )
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const recurrenceType: RecurrenceType =
        repeat === 'daily' ? 'daily' : repeat === 'weekly' ? 'weekly' : 'custom'
      const recurrenceConfig =
        repeat === 'daily'
          ? { timezone: 'Asia/Kolkata' }
          : {
              timezone: 'Asia/Kolkata',
              weekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5, 6, 7],
            }

      const group = await createGroup({
        name: name.trim() || 'Recurring group',
        description: description.trim() || undefined,
        sportId,
        venueId: venueId || undefined,
        recurrenceType,
        recurrenceConfig,
        startTime: startTime.length === 5 ? `${startTime}:00` : startTime,
        durationMinutes: duration,
        minimumPlayers: minPlayers,
        maximumPlayers: maxPlayers,
        visibility,
        autoOpenMissingSpots: autoOpen,
        priorityHours,
        endsOn: endsOn || null,
      })
      navigate(`/groups/${group.id}?created=1`)
    } catch (e) {
      setError(toUserMessage(e, "Couldn't create group."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-24">
      <Header title="Create group" backTo="/groups" subtitle={`Step ${step} of 4`} />
      <div className="page-pad space-y-6 py-6">
        {error ? (
          <p className="glass motion-error-in px-3 py-2 text-[13px] text-white">
            {error}
          </p>
        ) : null}

        {step === 1 ? (
          <div key="step-1" className="motion-step-in space-y-6">
            <div>
              <h2 className="display-lg">
                Sport + name
              </h2>
              <p className="mt-1 text-[14px] text-white/45">Start your club.</p>
            </div>
            <div>
              <p className="label-caps mb-3">Sport</p>
              <div className="flex flex-wrap gap-2">
                {sports.map((s) => (
                  <SportChip
                    key={s.id}
                    sport={s}
                    selected={sportId === s.id}
                    onClick={() => {
                      setSportId(s.id)
                      if (!name || name.endsWith('regulars'))
                        setName(`${s.name} regulars`)
                    }}
                  />
                ))}
              </div>
            </div>
            <Field label="Group name">
              <input
                className="glass-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Daily 7 PM Football"
              />
            </Field>
            <Field label="Description">
              <textarea
                className="glass-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Regular pickup — show up ready to play"
              />
            </Field>
            <PrimaryButton
              fullWidth
              disabled={!sportId || !name.trim()}
              onClick={() => setStep(2)}
            >
              Continue
            </PrimaryButton>
          </div>
        ) : null}

        {step === 2 ? (
          <div key="step-2" className="motion-step-in space-y-6">
            <div>
              <h2 className="display-lg">
                Venue + schedule
              </h2>
              <p className="mt-1 text-[14px] text-white/45">Where and when you play.</p>
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {venues.map((v) => (
                <VenueCard
                  key={v.id}
                  venue={v}
                  selected={venueId === v.id}
                  onClick={() => setVenueId(v.id)}
                />
              ))}
            </div>
            <Field label="Start time">
              <input
                type="time"
                className="glass-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </Field>
            <Field label="Duration (minutes)">
              <input
                type="number"
                className="glass-input"
                min={30}
                max={240}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 60)}
              />
            </Field>
            <div>
              <p className="label-caps mb-3">Repeat</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['daily', 'Every day'],
                    ['weekly', 'Selected weekdays'],
                    ['custom', 'Custom weekdays'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRepeat(id)}
                    className={
                      repeat === id
                        ? 'min-h-10 rounded-[8px] border border-white/30 bg-white px-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-cta'
                        : 'glass min-h-10 px-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/70 transition hover:border-white/20'
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {repeat !== 'daily' ? (
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDay(d.id)}
                    className={
                      weekdays.includes(d.id)
                        ? 'min-h-10 rounded-[8px] border border-white/30 bg-white px-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-cta'
                        : 'glass min-h-10 px-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/45 transition hover:border-white/20'
                    }
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            ) : null}
            <Field label="Optional end date">
              <input
                type="date"
                className="glass-input"
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
              />
              <span className="mt-1.5 block text-[12px] text-muted">
                Leave empty to continue until paused.
              </span>
            </Field>
            <div className="flex gap-2">
              <SecondaryButton fullWidth onClick={() => setStep(1)}>
                Back
              </SecondaryButton>
              <PrimaryButton fullWidth disabled={!venueId} onClick={() => setStep(3)}>
                Continue
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div key="step-3" className="motion-step-in space-y-6">
            <div>
              <h2 className="display-lg">
                Players + visibility
              </h2>
              <p className="mt-1 text-[14px] text-white/45">Capacity and who can join.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum">
                <input
                  type="number"
                  className="glass-input"
                  min={2}
                  value={minPlayers}
                  onChange={(e) => setMinPlayers(Number(e.target.value) || 2)}
                />
              </Field>
              <Field label="Maximum">
                <input
                  type="number"
                  className="glass-input"
                  min={minPlayers}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value) || minPlayers)}
                />
              </Field>
            </div>
            <div>
              <p className="label-caps mb-3">Visibility</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['public', 'Public'],
                    ['private', 'Private'],
                    ['invite_only', 'Invite only'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setVisibility(id)}
                    className={
                      visibility === id
                        ? 'min-h-10 rounded-[8px] border border-white/30 bg-white px-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-cta'
                        : 'glass min-h-10 px-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/70 transition hover:border-white/20'
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="glass flex cursor-pointer items-start gap-3 p-4">
              <input
                type="checkbox"
                checked={autoOpen}
                onChange={(e) => setAutoOpen(e.target.checked)}
                className="mt-1 h-4 w-4 accent-white"
              />
              <span className="text-[14px] leading-relaxed text-white">
                Auto-open missing spots to nearby PLAYR players after regulars
                get priority.
              </span>
            </label>
            {autoOpen ? (
              <Field label="Regular member priority (hours)">
                <input
                  type="number"
                  className="glass-input"
                  min={0}
                  max={72}
                  value={priorityHours}
                  onChange={(e) => setPriorityHours(Number(e.target.value) || 0)}
                />
              </Field>
            ) : null}
            <div className="flex gap-2">
              <SecondaryButton fullWidth onClick={() => setStep(2)}>
                Back
              </SecondaryButton>
              <PrimaryButton fullWidth onClick={() => setStep(4)}>
                Review
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div key="step-4" className="motion-step-in space-y-6">
            <div>
              <h2 className="display-lg">
                Review
              </h2>
              <p className="mt-1 text-[14px] text-white/45">Confirm and create.</p>
            </div>

            {!canCreateGroup(profile, user) ? (
              <ProfileCompletionGate requiredFor="venue" />
            ) : null}

            <div className="glass space-y-3 p-4">
              <p className="label-caps">{sport?.name}</p>
              <p className="text-[22px] font-semibold tracking-tight text-white">
                {name}
              </p>
              <div className="space-y-2 border-t border-white/10 pt-3 text-[13px] text-white/45">
                <p className="text-white">{venue?.name}</p>
                <p>
                  {repeat === 'daily'
                    ? 'Every day'
                    : weekdays
                        .map((d) => WEEKDAYS.find((w) => w.id === d)?.label)
                        .join(' · ')}{' '}
                  · {startTime} · {duration} min
                </p>
                <p>
                  {minPlayers}–{maxPlayers} players ·{' '}
                  {visibility.replace('_', ' ')}
                </p>
                <p>
                  Auto-open spots:{' '}
                  {autoOpen ? `On (${priorityHours}h priority)` : 'Off'}
                </p>
                {endsOn ? <p>Ends on {endsOn}</p> : <p>No end date</p>}
              </div>
            </div>
            <p className="text-[12px] text-muted">
              Changing venue later only affects newly generated games — existing
              occurrences keep their venue.
            </p>
            <div className="flex gap-2">
              <SecondaryButton fullWidth onClick={() => setStep(3)}>
                Back
              </SecondaryButton>
              <PrimaryButton
                fullWidth
                disabled={busy || !canCreateGroup(profile, user)}
                onClick={() => void submit()}
              >
                {busy ? 'Creating…' : 'Create Group'}
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        <Link
          to="/host"
          className="motion-link block text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-white/45"
        >
          Prefer a one-off game instead?
        </Link>
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
