import { CallButton } from '@/components/game/CallButton'
import { Countdown, GameStatus } from '@/components/game/GameStatus'
import { GameChatPanel } from '@/components/game/GameChatPanel'
import { PlayerCount } from '@/components/game/PlayerCount'
import { ReportSheet } from '@/components/game/ReportSheet'
import { StatusBadge } from '@/components/game/StatusBadge'
import { Header } from '@/components/layout/Header'
import { PlayerAvatar } from '@/components/player/PlayerAvatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useAuth } from '@/contexts/AuthContext'
import { toUserMessage } from '@/lib/errors'
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
import { getContactPhone, getGameDetail } from '@/services/games'
import { createGameInvite } from '@/services/invites'
import type { GameDetail, GameParticipant } from '@/types/domain'
import {
  Flag,
  Info,
  Lock,
  MessageCircle,
  Shield,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

type Tab = 'players' | 'chat'

export function GameDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [game, setGame] = useState<GameDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('players')
  const [checkIns, setCheckIns] = useState<GameCheckIn[]>([])
  const [windowInfo, setWindowInfo] = useState<CheckInWindow | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [playerPhones, setPlayerPhones] = useState<Record<string, string>>({})
  const [reportOpen, setReportOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<{
    title: string
    userId?: string
    messageId?: string
  } | null>(null)
  const [confirmNoShow, setConfirmNoShow] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

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

  const isHost = Boolean(
    user && game && (game.hostId === user.id || game.myParticipation?.role === 'co_host'),
  )

  useEffect(() => {
    if (!game || !user || !isHost) return
    let cancelled = false
    async function loadPhones() {
      const roster = game!.players.filter((p) =>
        ['confirmed', 'reserved', 'attended'].includes(p.status),
      )
      const entries: Record<string, string> = {}
      await Promise.all(
        roster.map(async (p) => {
          if (p.userId === user!.id) return
          const phone = await getContactPhone(game!.id, p.userId)
          if (phone) entries[p.userId] = phone
        }),
      )
      if (!cancelled) setPlayerPhones(entries)
    }
    void loadPhones()
    return () => {
      cancelled = true
    }
  }, [game, user, isHost])

  const checkInByUser = useMemo(() => {
    const map = new Map<string, GameCheckIn>()
    for (const c of checkIns) map.set(c.userId, c)
    return map
  }, [checkIns])

  if (loading) {
    return (
      <div>
        <Header title="Game details" backTo="/home" />
        <div className="page-pad py-8">
          <div className="glass h-48 animate-pulse" />
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
  const isReserved = myStatus === 'reserved'
  const isConfirmedPlayer =
    myStatus === 'confirmed' || myStatus === 'attended' || Boolean(isHost)
  const isWaitlisted = myStatus === 'waitlisted'
  const isFull = game.confirmedCount >= game.maxPlayers
  const deadlinePassed = new Date(game.confirmationDeadline).getTime() <= Date.now()
  const isCancelled = game.dbStatus === 'cancelled'
  const isGameConfirmed = game.dbStatus === 'confirmed'
  const isLive = game.dbStatus === 'live'
  const isCompleted = game.dbStatus === 'completed'
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
    if (!canSelfCheckIn) return null
    if (windowInfo?.tooEarly) return 'Check-in opens 30 minutes before the game.'
    if (windowInfo?.tooLate && !isHost) return 'Check-in window has closed.'
    if (windowInfo && !windowInfo.playerWindowOpen) {
      return 'Check-in opens 30 minutes before the game.'
    }
    return null
  }

  return (
    <div className="pb-28">
      <Header
        title="Game details"
        backTo="/home"
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="glass flex h-10 w-10 items-center justify-center text-white/45 transition hover:text-white"
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
          <div className="glass-elevated p-4">
            <p className="label-caps">Cancelled</p>
            <p className="mt-2 text-[14px] leading-relaxed text-white/45">
              This game was cancelled because the minimum number of players
              wasn&apos;t reached.
            </p>
          </div>
        ) : null}

        {isGameConfirmed ? (
          <div className="glass-elevated p-4">
            <p className="label-caps">Confirmed</p>
            <p className="mt-2 text-[14px] leading-relaxed text-white/45">
              Minimum players reached. Roster is locked — the host/venue
              commitment is protected.
            </p>
          </div>
        ) : null}

        {isLive ? (
          <div className="glass-elevated p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
              Live
            </p>
          </div>
        ) : null}

        {isCompleted ? (
          <div className="glass p-4">
            <p className="label-caps">Completed</p>
            <p className="mt-2 text-[14px] text-white/45">How was the game?</p>
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
          ) : (
            <p className="mt-2 text-[12px] text-white/45">Host arranges venue</p>
          )}
        </section>

        {/* Players + confirmation */}
        <section className="glass grid grid-cols-2 gap-4 p-5">
          <div>
            <p className="label-caps">Players</p>
            <div className="mt-2">
              <PlayerCount
                confirmed={game.confirmedCount}
                max={game.maxPlayers}
                min={game.minPlayers}
                waitlist={game.waitlistCount}
              />
            </div>
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

        <GameStatus
          game={{
            status: game.status,
            confirmationDeadline: game.confirmationDeadline,
            confirmedCount: game.confirmedCount,
            minPlayers: game.minPlayers,
          }}
        />

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
              <CallButton phone={game.hostPhone} label="Call Host" />
            ) : null}
            {canChat ? (
              <SecondaryButton
                className="min-h-11"
                onClick={() => setTab('chat')}
              >
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4" />
                  Chat
                </span>
              </SecondaryButton>
            ) : null}
            {isHost ? (
              <SecondaryButton
                className="min-h-11"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void createGameInvite({ gameId: game.id })
                    .then((inv) => {
                      setInviteUrl(`${window.location.origin}/join/game/${inv.token}`)
                    })
                    .catch((e) =>
                      setActionError(toUserMessage(e, "Couldn't create invite.")),
                    )
                    .finally(() => setBusy(false))
                }}
              >
                Invite players
              </SecondaryButton>
            ) : null}
          </div>
        ) : null}

        {inviteUrl ? (
          <div className="glass p-3 text-[12px] break-all text-white/45">
            {inviteUrl}
          </div>
        ) : null}

        {actionError ? (
          <div className="glass px-3 py-2 text-[13px] text-white">
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
          <section>
            <p className="label-caps">Host notes</p>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              {game.description}
            </p>
          </section>
        ) : null}

        {/* Host */}
        <section className="glass p-4">
          <div className="flex items-center justify-between">
            <p className="label-caps">Host</p>
            {game.hostPhone && !isHost ? (
              <CallButton phone={game.hostPhone} label="Call Host" />
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

        {(canChat || isConfirmedPlayer || isHost) ? (
          <div className="glass flex gap-0 overflow-hidden">
            <TabBtn
              active={tab === 'players'}
              onClick={() => setTab('players')}
              icon={<Users className="h-4 w-4" />}
              label="Players"
            />
            <TabBtn
              active={tab === 'chat'}
              onClick={() => setTab('chat')}
              icon={<MessageCircle className="h-4 w-4" />}
              label="Chat"
              disabled={!canChat && !isHost}
            />
          </div>
        ) : null}

        {tab === 'chat' && (canChat || isHost) ? (
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
        ) : (
          <section>
            <p className="label-caps">
              {isCompleted || isLive ? 'Attendance' : 'Roster'}
            </p>
            <div className="glass mt-4 divide-y divide-white/10">
              {roster.map((p) => {
                const checked = checkInByUser.has(p.userId) || Boolean(p.checkedInAt)
                const isNoShow = p.status === 'no_show'
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <PlayerAvatar
                        player={{
                          name: p.profile.displayName,
                          avatarUrl: p.profile.avatarUrl,
                        }}
                        showName
                      />
                      <p className="mt-0.5 pl-11 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                        {isNoShow
                          ? 'No-show'
                          : checked
                            ? 'Checked in'
                            : isLive || isCompleted
                              ? 'No check-in'
                              : p.role === 'host'
                                ? 'Host'
                                : p.role === 'co_host'
                                  ? 'Co-host'
                                  : p.status}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {isHost && playerPhones[p.userId] ? (
                        <CallButton
                          phone={playerPhones[p.userId]}
                          label="Call"
                          compact
                        />
                      ) : null}
                      {isHost &&
                      !checked &&
                      !isNoShow &&
                      ['confirmed', 'attended'].includes(p.status) &&
                      windowInfo?.hostWindowOpen ? (
                        <SecondaryButton
                          className="!min-h-9 !px-2.5 !py-1.5 text-[12px]"
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
                <p className="py-4 text-[13px] text-muted">No players visible yet.</p>
              ) : null}
            </div>
            <p className="mt-4 flex gap-2 text-[12px] leading-relaxed text-muted">
              <Shield className="h-3.5 w-3.5 shrink-0" />
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
      </div>

      {confirmNoShow ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setConfirmNoShow(null)}
          />
          <div className="glass-overlay relative z-10 w-full max-w-md p-5 sm:rounded-[8px]">
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
          </div>
        </div>
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

      <div className="glass-nav fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-50 p-4 lg:bottom-0 lg:left-52">
        <div className="mx-auto flex max-w-3xl gap-3">
          {!user ? (
            <PrimaryButton
              fullWidth
              onClick={() =>
                navigate(`/auth?next=${encodeURIComponent(`/games/${game.id}`)}`)
              }
            >
              Sign in to join
            </PrimaryButton>
          ) : isCancelled ? (
            <PrimaryButton fullWidth disabled>
              Cancelled
            </PrimaryButton>
          ) : canSelfCheckIn && windowInfo?.playerWindowOpen ? (
            <PrimaryButton fullWidth disabled={busy} onClick={() => void doSelfCheckIn()}>
              Check in
            </PrimaryButton>
          ) : isConfirmedPlayer && !isHost ? (
            <PrimaryButton fullWidth disabled>
              You&apos;re In
            </PrimaryButton>
          ) : isHost && (isGameConfirmed || isLive || isCompleted) ? (
            <PrimaryButton fullWidth disabled>
              {isCompleted ? 'Completed' : isLive ? 'Live' : 'Hosting'}
            </PrimaryButton>
          ) : isReserved ? (
            <PrimaryButton fullWidth onClick={() => navigate(`/games/${game.id}/join`)}>
              {reservationLabel ?? 'Reserved'}
            </PrimaryButton>
          ) : isWaitlisted ? (
            <PrimaryButton fullWidth onClick={() => navigate(`/games/${game.id}/join`)}>
              On waitlist
            </PrimaryButton>
          ) : isGameConfirmed || rosterLocked ? (
            <PrimaryButton fullWidth disabled>
              Locked
            </PrimaryButton>
          ) : isFull ? (
            <PrimaryButton fullWidth onClick={() => navigate(`/games/${game.id}/join?mode=waitlist`)}>
              Join Waitlist
            </PrimaryButton>
          ) : (
            <PrimaryButton fullWidth onClick={() => navigate(`/games/${game.id}/join`)}>
              Join
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        active
          ? 'flex flex-1 items-center justify-center gap-1.5 border-r border-white/10 bg-white py-2.5 text-[13px] font-semibold text-cta last:border-r-0'
          : 'flex flex-1 items-center justify-center gap-1.5 border-r border-white/10 py-2.5 text-[13px] font-semibold text-white/45 last:border-r-0 disabled:opacity-40'
      }
    >
      {icon}
      {label}
    </button>
  )
}
