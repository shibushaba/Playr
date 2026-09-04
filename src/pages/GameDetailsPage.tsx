import { LoadingBlock } from '@/components/motion/LoadingBlock'
import { MotionTabPill } from '@/components/motion/MotionTab'
import { StatusTransition } from '@/components/motion/StatusTransition'
import { CallButton } from '@/components/game/CallButton'
import { Countdown, GameStatus } from '@/components/game/GameStatus'
import { GameChatPanel } from '@/components/game/GameChatPanel'
import { GameAvailability, ParticipantStatus } from '@/components/game/GameAvailability'
import { PlayerCount } from '@/components/game/PlayerCount'
import { ReportSheet } from '@/components/game/ReportSheet'
import { RosterCallButton } from '@/components/game/RosterCallButton'
import { GameFeedbackCard } from '@/components/game/GameFeedbackCard'
import { StatusBadge } from '@/components/game/StatusBadge'
import { VenueReachPanel } from '@/components/game/VenueReachPanel'
import { Header } from '@/components/layout/Header'
import { PlayerAvatar } from '@/components/player/PlayerAvatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { GlassChromeBar } from '@/components/ui/GlassChromeBar'
import { OverlaySheet } from '@/components/ui/OverlaySheet'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { UnreadDot } from '@/components/ui/UnreadDot'
import { useAuth } from '@/contexts/AuthContext'
import { toUserMessage } from '@/lib/errors'
import { resolveVenueDirectionsUrl } from '@/lib/maps'
import { formatPhoneDisplay } from '@/lib/phone'
import {
  formatDateTime,
  formatDay,
  formatInr,
  formatRelativeDeadline,
  formatTime,
} from '@/lib/format'
import {
  disputeAttendance,
  hostMarkAttendance,
} from '@/services/attendance'
import {
  checkInWithLocation,
  getCheckInWindow,
  hostManualCheckIn,
  listGameCheckIns,
  requestBrowserPosition,
  type CheckInWindow,
  type GameCheckIn,
} from '@/services/checkin'
import { getGameDetail, loadRosterContactPhones } from '@/services/games'
import { createGameInvite } from '@/services/invites'
import {
  confirmGameVenueBooking,
  getVenueContactPhone,
  publishGame,
} from '@/services/verification'
import type { GameDetail, GameParticipant } from '@/types/domain'
import {
  Flag,
  Info,
  Lock,
  MapPin,
  MessageCircle,
  Shield,
  Users,
} from 'lucide-react'
import { useGameChatUnread } from '@/hooks/useGameChatUnread'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

type Tab = 'players' | 'chat' | 'location'

export function GameDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [game, setGame] = useState<GameDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('players')
  const [checkIns, setCheckIns] = useState<GameCheckIn[]>([])
  const [windowInfo, setWindowInfo] = useState<CheckInWindow | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)
  const [bookingCheckbox, setBookingCheckbox] = useState(false)
  const [venuePhone, setVenuePhone] = useState<string | null>(null)
  const [playerPhones, setPlayerPhones] = useState<Record<string, string>>({})
  const [reportOpen, setReportOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<{
    title: string
    userId?: string
    messageId?: string
  } | null>(null)
  const [confirmNoShow, setConfirmNoShow] = useState<string | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)

  useEffect(() => {
    const state = location.state as { publishError?: string } | null
    if (state?.publishError) {
      setActionError(state.publishError)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  const reload = useCallback(async () => {
    if (!id) return
    const data = await getGameDetail(id)
    setGame(data)
    if (user && data) {
      try {
        const [checks, win] = await Promise.all([
          listGameCheckIns(id).catch(() => [] as GameCheckIn[]),
          getCheckInWindow(id).catch(() => null),
        ])
        setCheckIns(checks)
        setWindowInfo(win)
      } catch {
        /* optional for non-participants */
      }
    }
  }, [id, user])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        await reload()
      } catch (e) {
        if (!cancelled) setError(toUserMessage(e, "Couldn't load this game. Try again."))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id, reload])

  useEffect(() => {
    if (!game || !user) return
    const host =
      game.hostId === user.id ||
      game.myParticipation?.role === 'host' ||
      game.myParticipation?.role === 'co_host'
    if (!host || game.dbStatus !== 'draft' || !game.venue?.id) return
    let cancelled = false
    void getVenueContactPhone(game.venue.id).then((phone) => {
      if (!cancelled) setVenuePhone(phone)
    })
    return () => {
      cancelled = true
    }
  }, [game, user])

  useEffect(() => {
    if (!id || !game) return
    if (!['open', 'confirmed', 'live'].includes(game.dbStatus)) return

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void reload()
    }

    document.addEventListener('visibilitychange', refreshIfVisible)
    const interval = window.setInterval(refreshIfVisible, 30_000)
    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible)
      window.clearInterval(interval)
    }
  }, [id, game?.dbStatus, reload])

  const isHost = Boolean(
    user &&
      game &&
      (game.hostId === user.id ||
        game.myParticipation?.role === 'host' ||
        game.myParticipation?.role === 'co_host'),
  )

  const participantIdsKey = useMemo(
    () => (game?.players ?? []).map((p) => p.userId).sort().join(','),
    [game?.players],
  )

  useEffect(() => {
    if (!game || !user || !isHost) return
    let cancelled = false
    void loadRosterContactPhones(
      game.id,
      game.players.map((p) => p.userId),
      game.hostId,
    ).then((phones) => {
      if (!cancelled) setPlayerPhones(phones)
    })
    return () => {
      cancelled = true
    }
  }, [game, user, isHost, participantIdsKey])

  const checkInByUser = useMemo(() => {
    const map = new Map<string, GameCheckIn>()
    for (const c of checkIns) map.set(c.userId, c)
    return map
  }, [checkIns])

  const chatUnreadEnabled = Boolean(
    user &&
      game &&
      game.dbStatus !== 'cancelled' &&
      (isHost ||
        game.myParticipation?.status === 'confirmed' ||
        game.myParticipation?.status === 'attended'),
  )

  const chatUnread = useGameChatUnread(id, user?.id, chatUnreadEnabled, tab === 'chat')

  if (loading) {
    return (
      <div>
        <Header title="Game details" backTo="/home" />
        <div className="page-pad py-8">
          <LoadingBlock className="h-48" />
        </div>
      </div>
    )
  }

  if (error || !game) {
    return (
      <div>
        <Header title="Game details" backTo="/home" />
        <div className="page-pad py-6">
          <EmptyState
            title="Game unavailable"
            description={error ?? "This game couldn't be found or isn't visible to you."}
            action={
              <Link to="/home">
                <PrimaryButton>Back to Home</PrimaryButton>
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  const myStatus = game.myParticipation?.status
  const myRosterEntry = user
    ? game.players.find((p) => p.userId === user.id)
    : undefined
  const isReserved = myStatus === 'reserved' || myRosterEntry?.status === 'reserved'
  const isWaitlisted =
    myStatus === 'waitlisted' || myRosterEntry?.status === 'waitlisted'
  const isConfirmedPlayer =
    myStatus === 'confirmed' ||
    myStatus === 'attended' ||
    myRosterEntry?.status === 'confirmed' ||
    myRosterEntry?.status === 'attended' ||
    Boolean(isHost)
  const isFull = game.confirmedCount >= game.maxPlayers
  const deadlinePassed = new Date(game.confirmationDeadline).getTime() <= Date.now()
  const isCancelled = game.dbStatus === 'cancelled'
  const isGameConfirmed = game.dbStatus === 'confirmed'
  const isLive = game.dbStatus === 'live'
  const isCompleted = game.dbStatus === 'completed'
  const isDraft = game.dbStatus === 'draft'
  const isParticipant =
    isHost || isConfirmedPlayer || isReserved || isWaitlisted
  const hasVenueLocation = Boolean(
    game.venue &&
      ((game.venue.latitude != null && game.venue.longitude != null) ||
        resolveVenueDirectionsUrl(game.venue)),
  )
  const venueDirectionsUrl = game.venue
    ? resolveVenueDirectionsUrl(game.venue)
    : null
  const rosterLocked =
    isGameConfirmed ||
    isCancelled ||
    isCompleted ||
    isLive ||
    deadlinePassed

  const canChat =
    Boolean(user) &&
    (isHost || myStatus === 'confirmed' || myStatus === 'attended') &&
    !isCancelled

  const chatReadOnly = isCancelled || isCompleted

  const iCheckedIn = Boolean(
    user && (checkInByUser.has(user.id) || game.myParticipation?.checkedInAt),
  )

  const canSelfCheckIn =
    Boolean(user) &&
    (myStatus === 'confirmed' || myStatus === 'attended') &&
    !iCheckedIn &&
    !isCancelled &&
    (isGameConfirmed || isLive || isCompleted)

  const reservationLabel = (() => {
    if (!isReserved || !game.myParticipation?.reservationExpiresAt) return null
    const ms =
      new Date(game.myParticipation.reservationExpiresAt).getTime() - Date.now()
    if (ms <= 0) return 'Reservation expired'
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `Reserved · ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  })()

  const roster = game.players.filter((p) =>
    ['confirmed', 'reserved', 'attended', 'no_show'].includes(p.status),
  )

  async function doSelfCheckIn() {
    setBusy(true)
    setActionError(null)
    try {
      const pos = await requestBrowserPosition()
      await checkInWithLocation(
        game!.id,
        pos.coords.latitude,
        pos.coords.longitude,
      )
      await reload()
    } catch (e) {
      setActionError(toUserMessage(e, "Couldn't check in. Try again."))
    } finally {
      setBusy(false)
    }
  }

  async function doHostCheckIn(player: GameParticipant) {
    setBusy(true)
    setActionError(null)
    try {
      await hostManualCheckIn(game!.id, player.userId)
      await reload()
    } catch (e) {
      setActionError(toUserMessage(e, "Couldn't check in this player."))
    } finally {
      setBusy(false)
    }
  }

  async function markNoShow(userId: string) {
    setBusy(true)
    setActionError(null)
    try {
      await hostMarkAttendance(game!.id, userId, 'no_show')
      setConfirmNoShow(null)
      await reload()
    } catch (e) {
      setActionError(toUserMessage(e, "Couldn't update attendance."))
    } finally {
      setBusy(false)
    }
  }

  async function markAttended(userId: string) {
    setBusy(true)
    setActionError(null)
    try {
      await hostMarkAttendance(game!.id, userId, 'attended')
      await reload()
    } catch (e) {
      setActionError(toUserMessage(e, "Couldn't update attendance."))
    } finally {
      setBusy(false)
    }
  }

  async function submitDispute() {
    setBusy(true)
    setActionError(null)
    try {
      await disputeAttendance(
        game!.id,
        'attendance_dispute',
        'I believe my attendance was marked incorrectly.',
      )
      setActionError(null)
      alert('Dispute submitted. PLAYR will review it.')
    } catch (e) {
      setActionError(toUserMessage(e, "Couldn't submit dispute."))
    } finally {
      setBusy(false)
    }
  }

  function checkInHint(): string | null {
    if (iCheckedIn) return "✓ You're checked in"
    if (!canSelfCheckIn && !windowInfo) return null
    if (windowInfo?.tooEarly && windowInfo.opensAt) {
      return `Check-in opens at ${formatTime(windowInfo.opensAt)}.`
    }
    if (windowInfo?.tooEarly) return 'Check-in opens 30 minutes before the game.'
    if (windowInfo?.tooLate && !isHost) return 'Check-in window has closed.'
    if (windowInfo && !windowInfo.playerWindowOpen) {
      if (windowInfo.opensAt) {
        return `Check-in opens at ${formatTime(windowInfo.opensAt)}.`
      }
      return 'Check-in opens 30 minutes before the game.'
    }
    return null
  }

  async function publishDraftGame() {
    if (!game) return
    if (!game.venueBookingConfirmedAt && !bookingCheckbox) {
      setActionError('Confirm that the venue slot is booked before publishing.')
      return
    }
    setPublishBusy(true)
    setActionError(null)
    try {
      if (!game.venueBookingConfirmedAt) {
        await confirmGameVenueBooking(game.id)
      }
      await publishGame(game.id)
      await reload()
    } catch (e) {
      setActionError(toUserMessage(e, "Couldn't publish game."))
    } finally {
      setPublishBusy(false)
    }
  }

  return (
    <div className="lg:pb-24">
      <Header
        title="Game details"
        backTo="/home"
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="glass flex h-11 w-11 items-center justify-center text-white/45 transition hover:text-white"
              aria-label="Report game"
              onClick={() => {
                setReportTarget({ title: 'Report Game' })
                setReportOpen(true)
              }}
            >
              <Flag className="h-4 w-4" />
            </button>
            <StatusBadge status={game.status} />
          </div>
        }
      />

      <div className="page-pad space-y-8 py-6">
        {/* Hero: sport · large time · venue */}
        <header>
          <div className="flex flex-wrap items-center gap-3">
            <p className="label-caps">{game.sport.name}</p>
            {game.visibility !== 'public' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                <Lock className="h-3 w-3" />
                {game.visibility === 'private' ? 'Private' : 'Invite only'}
              </span>
            ) : null}
          </div>
          <p className="mt-4 font-[family-name:var(--font-display)] text-[48px] font-semibold leading-none tracking-tight tabular-nums text-white">
            {formatTime(game.startsAt)}
          </p>
          <p className="mt-3 text-[15px] text-white/45">
            {formatDay(game.startsAt)} · {formatDateTime(game.startsAt)}
          </p>
          {game.title ? (
            <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-white">
              {game.title}
            </h1>
          ) : null}
        </header>

        {/* Status banners — monochrome borders */}
        {isCancelled ? (
          <div className="glass-elevated glass-status-danger p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-status-danger/80">
              × Cancelled
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-white/45">
              This game was cancelled because the minimum number of players
              wasn&apos;t reached.
            </p>
          </div>
        ) : null}

        {isDraft && isHost ? (
          <section className="glass-elevated space-y-4 p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-status-warning">
                Draft — publish required
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-white/45">
                Confirm the venue slot for this occurrence, then publish to open
                it for players.
              </p>
            </div>
            {venuePhone ? (
              <div className="glass p-3">
                <p className="label-caps">Venue contact</p>
                <p className="mt-1 text-[14px] text-white">
                  {formatPhoneDisplay(venuePhone)}
                </p>
                <CallButton phone={venuePhone} label="Call venue" className="mt-3" />
              </div>
            ) : null}
            {!game.venueBookingConfirmedAt ? (
              <label className="glass flex cursor-pointer items-start gap-3 p-4">
                <input
                  type="checkbox"
                  checked={bookingCheckbox}
                  onChange={(e) => setBookingCheckbox(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-white"
                />
                <span className="text-[14px] leading-relaxed text-white">
                  Yes, the venue confirmed this slot.
                </span>
              </label>
            ) : (
              <p className="text-[13px] font-semibold text-status-success">
                ✓ Venue booking confirmed
              </p>
            )}
            <PrimaryButton
              fullWidth
              disabled={publishBusy || (!game.venueBookingConfirmedAt && !bookingCheckbox)}
              onClick={() => void publishDraftGame()}
            >
              {publishBusy ? 'Publishing…' : 'Publish game'}
            </PrimaryButton>
          </section>
        ) : null}

        {isDraft && !isHost ? (
          <div className="glass-elevated p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-status-warning">
              Not published yet
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-white/45">
              The host hasn&apos;t opened this game for players yet.
            </p>
          </div>
        ) : null}

        {isGameConfirmed ? (
          <div className="glass-elevated glass-status-success p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-status-success">
              ✓ Confirmed
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-white/45">
              Minimum players reached. Roster is locked — the host/venue
              commitment is protected.
            </p>
          </div>
        ) : null}

        {isLive ? (
          <div className="glass-elevated glass-status-live p-4">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-status-live animate-live-pulse">
              <span className="status-dot" aria-hidden />
              Live
            </p>
          </div>
        ) : null}

        {isCompleted ? (
          <div className="glass p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-status-neutral">
              ✓ Completed
            </p>
            {(myStatus === 'no_show' ||
              myStatus === 'attended' ||
              myStatus === 'confirmed') &&
            !isHost ? (
              <SecondaryButton
                className="mt-3"
                disabled={busy}
                onClick={() => void submitDispute()}
              >
                Dispute attendance
              </SecondaryButton>
            ) : null}
          </div>
        ) : null}

        {isCompleted ? <GameFeedbackCard gameId={game.id} /> : null}

        {/* Venue */}
        <section className="border-y border-white/10 py-5">
          <p className="label-caps">Venue</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-[28px] font-semibold leading-tight tracking-tight text-white">
            {game.venue?.name ?? 'Venue TBD'}
          </p>
          <p className="mt-1 text-[13px] text-white/45">
            {game.venue?.address}
            {game.venue?.city ? `, ${game.venue.city}` : null}
          </p>
          {game.distanceLabel ? (
            <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/70">
              {game.distanceLabel}
            </p>
          ) : null}
          {venueDirectionsUrl ? (
            <SecondaryButton
              className="mt-4 min-h-11"
              type="button"
              onClick={() =>
                window.open(venueDirectionsUrl, '_blank', 'noopener,noreferrer')
              }
            >
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Directions
              </span>
            </SecondaryButton>
          ) : null}
          {game.venueBookingConfirmedAt && game.dbStatus !== 'draft' ? (
            <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-status-success">
              ✓ Host confirmed venue
            </p>
          ) : null}
          {game.venueBookingConfirmedAt && game.dbStatus !== 'draft' ? (
            <p className="mt-1 text-[12px] text-white/45">
              Host has confirmed the venue slot for this game.
            </p>
          ) : !hasVenueLocation && !game.distanceLabel ? (
            <p className="mt-2 text-[12px] text-white/45">Host arranges venue</p>
          ) : null}
        </section>

        {/* Players + confirmation */}
        <section className="glass grid grid-cols-2 gap-4 p-5">
          <div className="col-span-2 sm:col-span-1">
            <p className="label-caps">Players</p>
            <div className="mt-2">
              {game.dbStatus === 'open' && !isGameConfirmed && !isLive && !isCompleted ? (
                <GameAvailability
                  currentPlayers={game.confirmedCount}
                  maximumPlayers={game.maxPlayers}
                />
              ) : (
                <PlayerCount
                  confirmed={game.confirmedCount}
                  max={game.maxPlayers}
                  min={game.minPlayers}
                  waitlist={game.waitlistCount}
                />
              )}
            </div>
            {isHost ? (
              <ParticipantStatus
                label="You're hosting"
                tone="neutral"
                className="mt-3"
              />
            ) : isConfirmedPlayer ? (
              <ParticipantStatus label="You're in" tone="success" className="mt-3" />
            ) : isReserved ? (
              <ParticipantStatus label="Spot held" tone="warning" className="mt-3" />
            ) : isWaitlisted ? (
              <ParticipantStatus label="On waitlist" tone="warning" className="mt-3" />
            ) : null}
          </div>
          <div>
            <p className="label-caps">Share</p>
            <p className="mt-2 text-[18px] font-semibold tabular-nums text-white">
              {formatInr(game.playerShareInr)}
              {game.playerShareInr != null ? (
                <span className="text-[12px] font-normal text-white/45"> /person</span>
              ) : null}
            </p>
          </div>
        </section>

        {!deadlinePassed && game.dbStatus === 'open' ? (
          <section>
            <p className="label-caps">Confirmation</p>
            <p className="mt-2 text-[14px] text-white/70">
              Closes in{' '}
              {formatRelativeDeadline(game.confirmationDeadline, true).replace(
                ' left to confirm',
                '',
              )}
            </p>
            <Countdown
              deadlineAt={game.confirmationDeadline}
              className="mt-3"
            />
          </section>
        ) : null}

        {!isCancelled && !isCompleted && !isLive ? (
          <GameStatus
            game={{
              status: game.status,
              confirmationDeadline: game.confirmationDeadline,
              confirmedCount: game.confirmedCount,
              minPlayers: game.minPlayers,
            }}
          />
        ) : null}

        {/* Compact action row for confirmed players / host */}
        {(isHost || isConfirmedPlayer) && !isCancelled ? (
          <div className="flex flex-wrap gap-2">
            {canSelfCheckIn && windowInfo?.playerWindowOpen ? (
              <PrimaryButton
                disabled={busy}
                onClick={() => void doSelfCheckIn()}
                className="min-h-11 flex-1"
              >
                {busy ? 'Checking in…' : 'Check in'}
              </PrimaryButton>
            ) : null}
            {game.hostPhone && !isHost ? (
              <CallButton phone={game.hostPhone} label="Call host" />
            ) : null}
            {canChat ? (
              <SecondaryButton
                className="min-h-11"
                onClick={() => setTab('chat')}
              >
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4" />
                  Chat
                  {chatUnread ? <UnreadDot /> : null}
                </span>
              </SecondaryButton>
            ) : null}
            {isHost ? (
              <SecondaryButton
                className="min-h-11"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  setActionError(null)
                  void createGameInvite({ gameId: game.id })
                    .then(async (inv) => {
                      const url = `${window.location.origin}/join/game/${inv.token}`
                      await navigator.clipboard.writeText(url)
                      setInviteCopied(true)
                      window.setTimeout(() => setInviteCopied(false), 2000)
                    })
                    .catch((e) =>
                      setActionError(toUserMessage(e, "Couldn't create invite.")),
                    )
                    .finally(() => setBusy(false))
                }}
              >
                {inviteCopied ? 'Link copied' : 'Invite players'}
              </SecondaryButton>
            ) : null}
          </div>
        ) : null}

        {actionError ? (
          <div className="glass motion-error-in px-3 py-2 text-[13px] text-white">
            {actionError}
            {actionError.toLowerCase().includes('location') ? (
              <p className="mt-1 text-white/45">Ask host to check you in.</p>
            ) : null}
          </div>
        ) : null}

        {checkInHint() ? (
          <p className="text-[13px] text-white/45">{checkInHint()}</p>
        ) : null}

        <p className="flex gap-2 text-[13px] leading-relaxed text-white/45">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
          Informational only. Paid offline directly to the host/venue. PLAYR
          never collects or holds money.
        </p>

        {game.description ? (
          <section className="glass p-4">
            <p className="label-caps">Host notes</p>
            <p className="mt-2 text-[14px] leading-relaxed text-white/70">
              {game.description}
            </p>
          </section>
        ) : null}

        {/* Host */}
        <section className="glass p-4">
          <div className="flex items-center justify-between">
            <p className="label-caps">Host</p>
            {game.hostPhone && !isHost ? (
              <CallButton phone={game.hostPhone} label="Call host" />
            ) : null}
          </div>
          <div className="mt-3">
            <PlayerAvatar
              player={{
                name: game.host.displayName,
                avatarUrl: game.host.avatarUrl,
              }}
              showName
              size="md"
            />
          </div>
        </section>

        {(canChat || isConfirmedPlayer || isHost || hasVenueLocation) ? (
          <GlassChromeBar className="flex gap-1 p-1">
            <TabBtn
              active={tab === 'players'}
              onClick={() => setTab('players')}
              icon={<Users className="h-4 w-4" />}
              label="Players"
            />
            {hasVenueLocation ? (
              <TabBtn
                active={tab === 'location'}
                onClick={() => setTab('location')}
                icon={<MapPin className="h-4 w-4" />}
                label="Location"
              />
            ) : null}
            <TabBtn
              active={tab === 'chat'}
              onClick={() => setTab('chat')}
              icon={<MessageCircle className="h-4 w-4" />}
              label="Chat"
              disabled={!canChat && !isHost}
              showUnreadDot={chatUnread}
            />
          </GlassChromeBar>
        ) : null}

        {tab === 'chat' && (canChat || isHost) ? (
          <div key={tab} className="motion-panel-in">
            <GameChatPanel
            gameId={game.id}
            currentUserId={user?.id}
            readOnly={chatReadOnly || (!canChat && !isHost)}
            onReportMessage={(messageId, senderId) => {
              setReportTarget({
                title: 'Report Message',
                messageId,
                userId: senderId,
              })
              setReportOpen(true)
            }}
          />
          </div>
        ) : tab === 'location' && game.venue && hasVenueLocation ? (
          <div key={tab} className="motion-panel-in">
          <div className="glass p-4">
            <VenueReachPanel
              venue={game.venue}
              showCheckInHint={
                isParticipant &&
                (myStatus === 'confirmed' ||
                  myStatus === 'attended' ||
                  isGameConfirmed ||
                  isLive)
              }
            />
          </div>
          </div>
        ) : (
          <section key={tab} className="motion-panel-in">
            <p className="label-caps">
              {isCompleted || isLive ? 'Attendance' : 'Roster'}
            </p>
            <div className="glass mt-4 overflow-hidden">
              {roster.map((p) => {
                const checked = checkInByUser.has(p.userId) || Boolean(p.checkedInAt)
                const isNoShow = p.status === 'no_show'
                const roleLabel = isNoShow
                  ? 'No-show'
                  : checked
                    ? 'Checked in'
                    : isLive || isCompleted
                      ? 'No check-in'
                      : p.role === 'host'
                        ? 'Host'
                        : p.role === 'co_host'
                          ? 'Co-host'
                          : p.status
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 border-b border-white/10 px-4 py-3 last:border-b-0"
                  >
                    <PlayerAvatar
                      player={{
                        name: p.profile.displayName,
                        avatarUrl: p.profile.avatarUrl,
                      }}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-white">
                        {p.profile.displayName}
                      </p>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/45">
                        {roleLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {isHost && p.userId !== user?.id ? (
                        <RosterCallButton
                          gameId={game.id}
                          userId={p.userId}
                          displayName={p.profile.displayName}
                          phone={playerPhones[p.userId]}
                        />
                      ) : null}
                      {!isHost &&
                      p.role === 'host' &&
                      game.hostPhone ? (
                        <CallButton
                          phone={game.hostPhone}
                          label="Call host"
                          iconOnly
                        />
                      ) : null}
                      {isHost &&
                      !isCancelled &&
                      !checked &&
                      !isNoShow &&
                      ['confirmed', 'attended'].includes(p.status) &&
                      windowInfo?.hostWindowOpen ? (
                        <SecondaryButton
                          className="!min-h-9 !px-2.5 !py-1.5 text-[11px]"
                          disabled={busy}
                          onClick={() => void doHostCheckIn(p)}
                        >
                          Check in
                        </SecondaryButton>
                      ) : null}
                      {isHost &&
                      (isLive || isCompleted) &&
                      p.userId !== user?.id &&
                      !isNoShow ? (
                        <SecondaryButton
                          className="!min-h-9 !px-2.5 !py-1.5 text-[12px]"
                          disabled={busy}
                          onClick={() => setConfirmNoShow(p.userId)}
                        >
                          No show
                        </SecondaryButton>
                      ) : null}
                      {isHost && isNoShow ? (
                        <SecondaryButton
                          className="!min-h-9 !px-2.5 !py-1.5 text-[12px]"
                          disabled={busy}
                          onClick={() => void markAttended(p.userId)}
                        >
                          Mark attended
                        </SecondaryButton>
                      ) : null}
                      {user && p.userId !== user.id ? (
                        <button
                          type="button"
                          className="glass p-2 text-white/45 transition hover:text-white"
                          aria-label="Report player"
                          onClick={() => {
                            setReportTarget({
                              title: 'Report Player',
                              userId: p.userId,
                            })
                            setReportOpen(true)
                          }}
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
              {roster.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-white/45">
                  No players visible yet.
                </p>
              ) : null}
            </div>
            <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-white/45">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Player phone numbers are visible only to the host — not to other
              players. Your number is not publicly displayed.
            </p>
          </section>
        )}

        {game.groupId ? (
          <Link
            to={`/groups/${game.groupId}`}
            className="glass block px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:border-white/20"
          >
            Part of a recurring group →
          </Link>
        ) : null}

        <GameActionDock>
          <GameActionButton
            user={user}
            game={game}
            busy={busy || publishBusy}
            isCancelled={isCancelled}
            isDraft={isDraft}
            canSelfCheckIn={canSelfCheckIn}
            windowInfo={windowInfo}
            isConfirmedPlayer={isConfirmedPlayer}
            isHost={isHost}
            isGameConfirmed={isGameConfirmed}
            isLive={isLive}
            isCompleted={isCompleted}
            isReserved={isReserved}
            isWaitlisted={isWaitlisted}
            rosterLocked={rosterLocked}
            isFull={isFull}
            iCheckedIn={iCheckedIn}
            reservationLabel={reservationLabel}
            onSelfCheckIn={() => void doSelfCheckIn()}
            onPublishDraft={() => void publishDraftGame()}
            onNavigate={navigate}
          />
        </GameActionDock>
      </div>

      {confirmNoShow ? (
        <OverlaySheet
          onClose={() => setConfirmNoShow(null)}
          closeLabel="Close"
          panelClassName="max-w-md p-5"
        >
            <p className="text-[18px] font-semibold tracking-tight text-white">
              Mark no-show?
            </p>
            <p className="mt-2 text-[14px] text-white/45">
              Are you sure this player did not attend? This is recorded as an
              attendance event — it does not auto-ban anyone.
            </p>
            <div className="mt-4 flex gap-2">
              <SecondaryButton fullWidth onClick={() => setConfirmNoShow(null)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton
                fullWidth
                disabled={busy}
                onClick={() => void markNoShow(confirmNoShow)}
              >
                Confirm no-show
              </PrimaryButton>
            </div>
        </OverlaySheet>
      ) : null}

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={reportTarget?.title ?? 'Report'}
        gameId={game.id}
        reportedUserId={reportTarget?.userId}
        messageId={reportTarget?.messageId}
        allowBlock={Boolean(reportTarget?.userId)}
      />

    </div>
  )
}

function GameActionDock({ children }: { children: ReactNode }) {
  return (
    <div className="game-action-dock">
      <GlassChromeBar className="p-3 lg:rounded-[8px]">{children}</GlassChromeBar>
    </div>
  )
}

function gameActionPhaseKey({
  user,
  isCancelled,
  isDraft,
  isHost,
  iCheckedIn,
  canSelfCheckIn,
  windowInfo,
  isConfirmedPlayer,
  isReserved,
  isWaitlisted,
  isGameConfirmed,
  rosterLocked,
  isFull,
  isLive,
  isCompleted,
}: {
  user: ReturnType<typeof useAuth>['user']
  isCancelled: boolean
  isDraft: boolean
  isHost: boolean
  iCheckedIn: boolean
  canSelfCheckIn: boolean
  windowInfo: CheckInWindow | null
  isConfirmedPlayer: boolean
  isReserved: boolean
  isWaitlisted: boolean
  isGameConfirmed: boolean
  rosterLocked: boolean
  isFull: boolean
  isLive: boolean
  isCompleted: boolean
}): string {
  if (!user) return 'guest'
  if (isCancelled) return 'cancelled'
  if (isDraft && isHost) return 'draft-host'
  if (isDraft) return 'draft'
  if (iCheckedIn) return 'checked-in'
  if (canSelfCheckIn && windowInfo?.playerWindowOpen) return 'check-in'
  if (isHost) {
    if (isCompleted) return 'host-completed'
    if (isLive) return 'host-live'
    if (isGameConfirmed) return 'host-confirmed'
    return 'host'
  }
  if (isConfirmedPlayer || isReserved || isWaitlisted) {
    if (isWaitlisted) return 'waitlisted'
    if (isReserved) return 'reserved'
    return 'confirmed'
  }
  if (isGameConfirmed || rosterLocked) return 'roster-locked'
  if (isFull) return 'full'
  return 'join'
}

function GameActionButton({
  user,
  game,
  busy,
  isCancelled,
  isDraft,
  canSelfCheckIn,
  windowInfo,
  isConfirmedPlayer,
  isHost,
  isGameConfirmed,
  isLive,
  isCompleted,
  isReserved,
  isWaitlisted,
  rosterLocked,
  isFull,
  iCheckedIn,
  reservationLabel,
  onSelfCheckIn,
  onPublishDraft,
  onNavigate,
}: {
  user: ReturnType<typeof useAuth>['user']
  game: GameDetail
  busy: boolean
  isCancelled: boolean
  isDraft: boolean
  canSelfCheckIn: boolean
  windowInfo: CheckInWindow | null
  isConfirmedPlayer: boolean
  isHost: boolean
  isGameConfirmed: boolean
  isLive: boolean
  isCompleted: boolean
  isReserved: boolean
  isWaitlisted: boolean
  rosterLocked: boolean
  isFull: boolean
  iCheckedIn: boolean
  reservationLabel: string | null
  onSelfCheckIn: () => void
  onPublishDraft: () => void
  onNavigate: ReturnType<typeof useNavigate>
}) {
  const phaseKey = gameActionPhaseKey({
    user,
    isCancelled,
    isDraft,
    isHost,
    iCheckedIn,
    canSelfCheckIn,
    windowInfo,
    isConfirmedPlayer,
    isReserved,
    isWaitlisted,
    isGameConfirmed,
    rosterLocked,
    isFull,
    isLive,
    isCompleted,
  })

  let button: ReactNode

  if (!user) {
    button = (
      <PrimaryButton
        fullWidth
        onClick={() =>
          onNavigate(`/auth?next=${encodeURIComponent(`/games/${game.id}`)}`)
        }
      >
        Sign in to join
      </PrimaryButton>
    )
  } else if (isCancelled) {
    button = (
      <PrimaryButton fullWidth disabled variant="outline">
        Game cancelled
      </PrimaryButton>
    )
  } else if (isDraft && isHost) {
    button = (
      <PrimaryButton fullWidth disabled={busy} onClick={onPublishDraft}>
        Publish game
      </PrimaryButton>
    )
  } else if (isDraft) {
    button = (
      <PrimaryButton fullWidth disabled variant="outline">
        Not published yet
      </PrimaryButton>
    )
  } else if (iCheckedIn) {
    button = (
      <PrimaryButton fullWidth disabled variant="outline">
        ✓ You&apos;re checked in
      </PrimaryButton>
    )
  } else if (canSelfCheckIn && windowInfo?.playerWindowOpen) {
    button = (
      <PrimaryButton fullWidth disabled={busy} onClick={onSelfCheckIn}>
        Check in
      </PrimaryButton>
    )
  } else if (isHost) {
    button = (
      <PrimaryButton fullWidth disabled variant="outline">
        {isCompleted
          ? 'Completed'
          : isLive
            ? 'Live'
            : isGameConfirmed
              ? 'Hosting'
              : "You're hosting"}
      </PrimaryButton>
    )
  } else if (isConfirmedPlayer || isReserved || isWaitlisted) {
    button = (
      <PrimaryButton
        fullWidth
        disabled={!isReserved && !isWaitlisted}
        variant={isReserved || isWaitlisted ? 'solid' : 'outline'}
        onClick={() => {
          if (isReserved || isWaitlisted) {
            onNavigate(`/games/${game.id}/join`)
          }
        }}
      >
        {isWaitlisted
          ? 'On waitlist'
          : isReserved
            ? reservationLabel ?? 'Reserved — confirm'
            : "You're in"}
      </PrimaryButton>
    )
  } else if (isGameConfirmed || rosterLocked) {
    button = (
      <PrimaryButton fullWidth disabled variant="outline">
        Roster locked
      </PrimaryButton>
    )
  } else if (isFull) {
    button = (
      <PrimaryButton
        fullWidth
        onClick={() => onNavigate(`/games/${game.id}/join?mode=waitlist`)}
      >
        Join waitlist
      </PrimaryButton>
    )
  } else {
    button = (
      <PrimaryButton fullWidth onClick={() => onNavigate(`/games/${game.id}/join`)}>
        Join
      </PrimaryButton>
    )
  }

  return <StatusTransition phaseKey={phaseKey}>{button}</StatusTransition>
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
  disabled,
  showUnreadDot,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  disabled?: boolean
  showUnreadDot?: boolean
}) {
  return (
    <MotionTabPill active={active} onClick={onClick} disabled={disabled}>
      {icon}
      <span className="inline-flex items-center gap-1">
        {label}
        {showUnreadDot ? <UnreadDot /> : null}
      </span>
    </MotionTabPill>
  )
}
