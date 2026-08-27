import { LoadingBlock } from '@/components/motion/LoadingBlock'
import { MotionNavRow } from '@/components/motion/MotionLink'
import { StatusTransition } from '@/components/motion/StatusTransition'
import { Header } from '@/components/layout/Header'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { PlayerAvatar } from '@/components/player/PlayerAvatar'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useAuth } from '@/contexts/AuthContext'
import { toUserMessage } from '@/lib/errors'
import { formatPhoneDisplay, isValidE164 } from '@/lib/phone'
import {
  getPlayerReliability,
  type PlayerReliability,
} from '@/services/reliability'
import {
  removeMyAvatar,
  updateMyProfile,
  uploadMyAvatar,
} from '@/services/profiles'
import { resendEmailVerification } from '@/services/verification'
import { Camera } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function ProfilePage() {
  const { user, profile, signOut, loading, refreshProfile, applyProfile } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [stats, setStats] = useState<PlayerReliability | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [phoneLocal, setPhoneLocal] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void getPlayerReliability(user.id)
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .catch((e) => {
        if (!cancelled) setStatsError(toUserMessage(e, "Couldn't load stats."))
      })
    return () => {
      cancelled = true
    }
  }, [user])

  function startEditing() {
    setDisplayName(profile?.display_name ?? '')
    setUsername(profile?.username ?? '')
    setBio(profile?.bio ?? '')
    setPhoneLocal(localDigitsFromE164(profile?.phone))
    setSaveError(null)
    setSaveOk(false)
    setEditing(true)
  }

  if (loading) {
    return (
      <div>
        <Header title="Profile" />
        <div className="page-pad py-8">
          <LoadingBlock />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div>
        <Header title="Profile" />
        <div className="page-pad space-y-4 py-6">
          <p className="text-[14px] text-white/45">Sign in to view your PLAYR profile.</p>
          <PrimaryButton fullWidth onClick={() => navigate('/auth')}>
            Sign in
          </PrimaryButton>
        </div>
      </div>
    )
  }

  const name = profile?.display_name || user.email || 'Player'
  const hasPhone = Boolean(profile?.phone && isValidE164(profile.phone))
  const emailVerified = Boolean(
    profile?.email_verified_at || user.email_confirmed_at,
  )

  async function verifyEmail() {
    setEmailBusy(true)
    setContactError(null)
    try {
      await resendEmailVerification()
      setEmailSent(true)
      await refreshProfile()
    } catch (e) {
      setContactError(toUserMessage(e, "Couldn't send confirmation email."))
    } finally {
      setEmailBusy(false)
    }
  }

  async function onPickPhoto(file: File | undefined) {
    if (!file) return
    setPhotoBusy(true)
    setSaveError(null)
    try {
      const updated = await uploadMyAvatar(file)
      applyProfile(updated)
    } catch (e) {
      setSaveError(toUserMessage(e, "Couldn't update your photo."))
    } finally {
      setPhotoBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onRemovePhoto() {
    setPhotoBusy(true)
    setSaveError(null)
    try {
      const updated = await removeMyAvatar()
      applyProfile(updated)
    } catch (e) {
      setSaveError(toUserMessage(e, "Couldn't remove your photo."))
    } finally {
      setPhotoBusy(false)
    }
  }

  async function saveProfile() {
    if (!displayName.trim()) {
      setSaveError('Enter your name.')
      return
    }
    const uname = username.trim().replace(/^@/, '').toLowerCase()
    if (uname && !/^[a-z0-9_]{3,30}$/.test(uname)) {
      setSaveError('Username must be 3–30 letters, numbers, or underscores.')
      return
    }
    setSaveBusy(true)
    setSaveError(null)
    setSaveOk(false)
    try {
      const phoneArg = phoneLocal.trim()
        ? phoneLocal.trim()
        : profile?.phone
          ? null
          : undefined

      const updated = await updateMyProfile({
        displayName: displayName.trim(),
        username: uname,
        bio: bio.trim(),
        phone: phoneArg,
      })
      applyProfile(updated)
      setEditing(false)
      setSaveOk(true)
    } catch (e) {
      setSaveError(toUserMessage(e, "Couldn't save your profile."))
    } finally {
      setSaveBusy(false)
    }
  }

  return (
    <div>
      <Header title="Profile" right={<NotificationBell />} />
      <div className="page-pad space-y-8 py-6 pb-10">
        <div className="flex items-center gap-4 border-b border-white/10 pb-6">
          <button
            type="button"
            className="relative shrink-0 rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy}
            aria-label="Change profile photo"
          >
            <PlayerAvatar
              player={{ name, avatarUrl: profile?.avatar_url }}
              size="xl"
            />
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-bg-3 text-white">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void onPickPhoto(e.target.files?.[0])}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-semibold tracking-tight text-white">
              {name}
            </h1>
            <p className="mt-1 text-[13px] text-white/45">
              {profile?.username ? `@${profile.username}` : user.email}
            </p>
            {!editing ? (
              <button
                type="button"
                className="mt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70 transition hover:text-white"
                onClick={startEditing}
              >
                Edit profile
              </button>
            ) : null}
          </div>
        </div>

        {photoBusy ? (
          <p className="text-[13px] text-white/45">Updating photo…</p>
        ) : null}

        {editing ? (
          <section className="glass space-y-5 p-4">
            <p className="label-caps">Edit profile</p>
            <Field label="Name">
              <input
                className="glass-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </Field>
            <Field label="Username">
              <input
                className="glass-input"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.replace(/^@/, '').toLowerCase())
                }
                placeholder="optional"
                autoComplete="username"
              />
            </Field>
            <Field label="Bio">
              <textarea
                className="glass-input"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Sports you play, usual times, area…"
                maxLength={280}
              />
            </Field>
            <Field label="Phone">
              <div className="glass-input flex min-h-11 items-center gap-2 !px-3">
                <span className="text-[14px] text-white/45">+91</span>
                <input
                  value={phoneLocal}
                  onChange={(e) =>
                    setPhoneLocal(e.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                  inputMode="numeric"
                  placeholder="9876543210"
                  className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
                  autoComplete="tel"
                />
              </div>
              <p className="mt-1.5 text-[12px] text-white/45">
                Optional. Hosts can use this to coordinate if you join a game.
                You can change it anytime.
              </p>
            </Field>
            {profile?.avatar_url ? (
              <button
                type="button"
                className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/45 transition hover:text-white"
                disabled={photoBusy}
                onClick={() => void onRemovePhoto()}
              >
                Remove photo
              </button>
            ) : null}
            {saveError ? (
              <p className="glass motion-error-in px-3 py-2 text-[13px] text-white">{saveError}</p>
            ) : null}
            <div className="flex gap-2">
              <SecondaryButton
                fullWidth
                disabled={saveBusy}
                onClick={() => {
                  setEditing(false)
                  setSaveError(null)
                }}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton
                fullWidth
                disabled={saveBusy}
                onClick={() => void saveProfile()}
              >
                {saveBusy ? 'Saving…' : 'Save'}
              </PrimaryButton>
            </div>
          </section>
        ) : (
          <>
            {saveOk ? (
              <StatusTransition phaseKey="saved">
                <p className="text-[13px] text-status-success">Profile updated.</p>
              </StatusTransition>
            ) : null}
            {saveError ? (
              <p className="glass motion-error-in px-3 py-2 text-[13px] text-white">{saveError}</p>
            ) : null}
            {profile?.bio ? (
              <p className="text-[14px] leading-relaxed text-white/70">{profile.bio}</p>
            ) : (
              <p className="text-[14px] text-white/45">
                Add a photo, bio, or phone so hosts know who they&apos;re playing with.
              </p>
            )}
          </>
        )}

        <section className="glass p-4">
          <p className="label-caps">Contact</p>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-medium text-white">Phone</p>
                <p className="mt-1 text-[13px] text-white/45">
                  {hasPhone && profile?.phone
                    ? formatPhoneDisplay(profile.phone)
                    : 'Not added'}
                </p>
              </div>
              <SecondaryButton onClick={startEditing}>
                {hasPhone ? 'Change' : 'Add'}
              </SecondaryButton>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div>
                <p className="text-[14px] font-medium text-white">Email</p>
                <p className="mt-1 text-[13px] text-white/45">{user.email}</p>
              </div>
              {emailVerified ? (
                <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-status-success">
                  ✓ Verified
                </span>
              ) : (
                <SecondaryButton disabled={emailBusy} onClick={() => void verifyEmail()}>
                  {emailBusy ? 'Sending…' : 'Verify'}
                </SecondaryButton>
              )}
            </div>
            {emailSent && !emailVerified ? (
              <p className="text-[12px] text-status-success">
                Check your inbox for a confirmation link.
              </p>
            ) : null}
            {contactError ? (
              <p className="glass motion-error-in px-3 py-2 text-[13px] text-white/70">{contactError}</p>
            ) : null}
          </div>
        </section>

        <section>
          <p className="label-caps">Reliability</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-white">
            {stats ? stats.label : 'Trust, not popularity'}
          </h2>
          {statsError ? (
            <p className="mt-2 text-[14px] text-white/45">{statsError}</p>
          ) : stats ? (
            <dl className="glass mt-5 space-y-3 p-4">
              <StatRow label="Games joined" value={stats.gamesJoined} />
              <StatRow label="Attended" value={stats.attended} />
              <StatRow label="Late cancellations" value={stats.lateCancellations} />
              <StatRow label="No-shows" value={stats.noShows} />
              {stats.attendanceRate != null ? (
                <StatRow label="Attendance rate" value={`${stats.attendanceRate}%`} />
              ) : null}
              {stats.gamesHosted > 0 ? (
                <>
                  <div className="border-t border-white/10 pt-3">
                    <p className="label-caps">Host</p>
                  </div>
                  <StatRow label="Games hosted" value={stats.gamesHosted} />
                  <StatRow label="Completed" value={stats.hostedCompleted} />
                  <StatRow label="Cancelled" value={stats.hostedCancelled} />
                  {stats.completionRate != null ? (
                    <StatRow
                      label="Completion rate"
                      value={`${stats.completionRate}%`}
                    />
                  ) : null}
                </>
              ) : null}
            </dl>
          ) : (
            <p className="mt-2 text-[14px] leading-relaxed text-white/45">
              Reliability comes from attendance, no-shows, cancellations, and
              game history — not likes or followers.
            </p>
          )}
        </section>

        <div className="glass overflow-hidden">
          <MotionNavRow to="/my-games" label="Upcoming / past games" />
          <MotionNavRow to="/groups" label="My groups" />
          <MotionNavRow to="/notifications" label="Notifications" />
          <MotionNavRow to="/venues/new?returnTo=create-game" label="Submit a venue" />
        </div>

        <div className="glass-elevated p-5">
          <p className="label-caps">Host</p>
          <p className="mt-2 text-[18px] font-semibold tracking-tight text-white">
            Ready to host?
          </p>
          <p className="mt-1 text-[13px] text-white/45">
            You book the venue. PLAYR helps you fill the roster.
          </p>
          <Link to="/host" className="mt-5 block">
            <PrimaryButton fullWidth>
              Host a game
            </PrimaryButton>
          </Link>
        </div>

        <SecondaryButton
          fullWidth
          onClick={() => {
            void signOut().then(() => navigate('/'))
          }}
        >
          Sign out
        </SecondaryButton>

        <p className="text-center text-[12px] text-white/45">
          PLAYR never handles money. Fees stay offline between players and hosts.
        </p>
      </div>
    </div>
  )
}

function localDigitsFromE164(phone: string | null | undefined): string {
  if (!phone) return ''
  if (phone.startsWith('+91') && phone.length === 13) return phone.slice(3)
  return phone.replace(/\D/g, '').slice(-10)
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[13px] text-white/45">{label}</dt>
      <dd className="text-[15px] font-semibold tabular-nums text-white">{value}</dd>
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
