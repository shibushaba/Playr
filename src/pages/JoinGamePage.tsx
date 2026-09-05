import { StatusTransition } from '@/components/motion/StatusTransition'
import { SuccessFeedback } from '@/components/motion/SuccessFeedback'
import { DetailHeroSkeleton } from '@/components/motion/Skeleton'
import { ParticipantStatus } from '@/components/game/GameAvailability'
import { Header } from '@/components/layout/Header'
import { ProfileCompletionGate } from '@/components/trust/ProfileCompletionGate'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useAuth } from '@/contexts/AuthContext'
import { parsePlayrRpcError, toUserMessage } from '@/lib/errors'
import { cn, formatDateTime, formatInr, formatTime } from '@/lib/format'
import { canJoinGame } from '@/lib/profileCompletion'
import {
  cancelParticipation,
  confirmReservation,
  getGameDetail,
  joinWaitlist,
  reserveGameSpot,
} from '@/services/games'
import type { GameDetail } from '@/types/domain'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

export function JoinGamePage() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const waitlistMode = search.get('mode') === 'waitlist'
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const [game, setGame] = useState<GameDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [agreed, setAgreed] = useState(false)
  const [phase, setPhase] = useState<
    'verify' | 'disclose' | 'holding' | 'done' | 'hosting'
  >('disclose')
  const [remaining, setRemaining] = useState(8 * 60)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [waitlisted, setWaitlisted] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    void getGameDetail(id)
      .then((g) => {
        if (cancelled) return
        setGame(g)
        if (!g) {
          setError("This game couldn't be found or isn't visible to you.")
          return
        }
        if (g.myParticipation?.status === 'reserved') {
          setPhase('holding')
          const expires = g.myParticipation.reservationExpiresAt
          if (expires) {
            setRemaining(
              Math.max(
                0,
                Math.floor((new Date(expires).getTime() - Date.now()) / 1000),
              ),
            )
          }
        } else if (
          user &&
          (g.hostId === user.id ||
            g.myParticipation?.role === 'host' ||
            g.myParticipation?.role === 'co_host')
        ) {
          setPhase('hosting')
        } else if (
          g.myParticipation?.status === 'confirmed' ||
          g.myParticipation?.status === 'waitlisted' ||
          g.myParticipation?.status === 'attended'
        ) {
          setWaitlisted(g.myParticipation.status === 'waitlisted')
          setPhase('done')
        }
      })
      .catch((e) => {
        if (!cancelled) setError(toUserMessage(e, "Couldn't load this game. Try again."))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, user])

  useEffect(() => {
    if (!user || !game || phase === 'holding' || phase === 'done' || phase === 'hosting') {
      return
    }
    if (!canJoinGame(profile, user)) {
      setPhase('verify')
    } else if (phase === 'verify') {
      setPhase('disclose')
    }
  }, [user, profile, game, phase])

  useEffect(() => {
    if (phase !== 'holding') return
    const timer = window.setInterval(() => {
      setRemaining((s) => Math.max(0, s - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  if (authLoading || loading) {
    return (
      <div>
        <Header title="Join game" backTo={id ? `/games/${id}` : '/home'} />
        <div className="page-pad py-8">
          <DetailHeroSkeleton />
        </div>
      </div>
    )
  }

  if (!user) {
    const next = id
      ? `/auth?next=${encodeURIComponent(`/games/${id}/join${waitlistMode ? '?mode=waitlist' : ''}`)}`
      : '/auth'
    return (
      <div>
        <Header title="Join game" backTo={id ? `/games/${id}` : '/home'} />
        <div className="page-pad space-y-4 py-6">
          <p className="text-[14px] text-white/45">Sign in to join this game.</p>
          <PrimaryButton fullWidth onClick={() => navigate(next)}>
            Sign in
          </PrimaryButton>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div>
        <Header title="Join game" backTo="/home" />
        <div className="page-pad py-6">
          <EmptyState
            title="Game unavailable"
            description={error ?? "This game couldn't be found."}
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

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const isFull = game.confirmedCount >= game.maxPlayers
  const useWaitlist = waitlistMode || isFull

  async function startReservation() {
    setBusy(true)
    setError(null)
    try {
      if (useWaitlist) {
        await joinWaitlist(game!.id)
        setWaitlisted(true)
        setPhase('done')
      } else {
        const row = await reserveGameSpot(game!.id)
        const expires = row.reservation_expires_at
          ? Math.max(
              0,
              Math.floor(
                (new Date(row.reservation_expires_at).getTime() - Date.now()) / 1000,
              ),
            )
          : 8 * 60
        setRemaining(expires)
        setPhase('holding')
      }
    } catch (e) {
      const parsed = parsePlayrRpcError(e, "Couldn't join this game. Try again.")
      if (parsed.code === 'GAME_FULL' && id) {
        setError('That spot may have been taken. Refreshing availability…')
        try {
          const refreshed = await getGameDetail(id)
          setGame(refreshed)
          if (refreshed && refreshed.confirmedCount >= refreshed.maxPlayers) {
            setError('That game is full. You can join the waitlist instead.')
          }
        } catch {
          setError(parsed.message)
        }
      } else {
        setError(parsed.message)
      }
    } finally {
      setBusy(false)
    }
  }

  async function confirmSpot() {
    setBusy(true)
    setError(null)
    try {
      await confirmReservation(game!.id)
      setPhase('done')
    } catch (e) {
      setError(toUserMessage(e, "Couldn't confirm your spot. Try again."))
    } finally {
      setBusy(false)
    }
  }

  async function cancelSpot() {
    setBusy(true)
    try {
      await cancelParticipation(game!.id)
      navigate(`/games/${game!.id}`)
    } catch (e) {
      setError(toUserMessage(e, "Couldn't cancel. Try again."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Header
        title={useWaitlist ? 'Join waitlist' : 'Join game'}
        backTo={`/games/${game.id}`}
      />

      <div className="page-pad space-y-8 py-6">
        <div>
          <p className="label-caps">{game.sport.name}</p>
          <p className="mt-3 font-[family-name:var(--font-display)] text-[36px] font-semibold tracking-tight tabular-nums text-white">
            {formatTime(game.startsAt)}
          </p>
          <p className="mt-2 text-[15px] text-white">{game.venue?.name}</p>
          <p className="mt-1 text-[13px] text-white/45">{formatDateTime(game.startsAt)}</p>
          <div className="glass mt-6 grid grid-cols-2 gap-4 p-4">
            <div>
              <p className="label-caps">Players</p>
              <p className="mt-1 text-[18px] font-semibold tabular-nums text-white">
                {game.confirmedCount} / {game.maxPlayers}
              </p>
            </div>
            <div>
              <p className="label-caps">Share</p>
              <p className="mt-1 text-[18px] font-semibold text-white">
                {formatInr(game.playerShareInr)}
                {game.playerShareInr != null ? (
                  <span className="text-[12px] font-normal text-white/45"> at venue</span>
                ) : null}
              </p>
            </div>
          </div>
          <p className="mt-4 text-[13px] text-white/45">
            Confirmation closes {formatDateTime(game.confirmationDeadline)}.
          </p>
        </div>

        {error ? (
          <p className="glass motion-error-in px-3 py-2 text-[13px] text-status-danger">
            {error}
          </p>
        ) : null}

        {phase === 'verify' ? (
          <ProfileCompletionGate requiredFor="join" />
        ) : null}

        {phase === 'disclose' ? (
          <StatusTransition phaseKey="disclose">
            <>
              <section>
                <h2 className="section-label">Contact disclosure</h2>
                <p className="mt-3 text-[14px] leading-relaxed text-white/45">
                  Your phone number is visible to the host if you&apos;ve added one
                  on your profile — you can add or change it anytime.
                </p>
                {!useWaitlist ? (
                  <p className="mt-2 text-[14px] leading-relaxed text-white/45">
                    A temporary hold lasts up to 8 minutes — confirm before it
                    expires.
                  </p>
                ) : (
                  <p className="mt-2 text-[14px] leading-relaxed text-white/45">
                    Waitlist does not count toward capacity. You may be promoted if
                    a seat opens.
                  </p>
                )}
              </section>

              <label
                className={cn(
                  'glass flex cursor-pointer items-start gap-3 p-4 transition-colors',
                  agreed && 'border-white/20 bg-white/[0.06]',
                )}
              >
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border border-white/30 bg-transparent accent-white"
                />
                <span className="text-[14px] leading-relaxed text-white">
                  I understand and agree
                </span>
              </label>

              {!agreed ? (
                <p className="text-center text-[12px] text-white/40">
                  Check the box above to {useWaitlist ? 'join the waitlist' : 'reserve your spot'}.
                </p>
              ) : null}

              <PrimaryButton
                fullWidth
                disabled={!agreed || busy}
                onClick={() => void startReservation()}
              >
                {busy
                  ? 'Joining…'
                  : useWaitlist
                    ? 'Join waitlist'
                    : 'Reserve spot'}
              </PrimaryButton>
            </>
          </StatusTransition>
        ) : null}

        {phase === 'holding' ? (
          <StatusTransition phaseKey="holding">
            <section className="glass-elevated glass-status-warning p-6 text-center">
              <ParticipantStatus label="Spot held" tone="warning" className="justify-center" />
              <p
                className={cn(
                  'mt-4 font-[family-name:var(--font-display)] text-[48px] font-semibold tabular-nums tracking-tight text-status-warning',
                  remaining <= 30 && 'status-emphasis animate-urgency-pulse',
                  remaining <= 120 && remaining > 30 && 'status-emphasis',
                )}
              >
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </p>
              <p className="mt-3 text-[13px] text-white/45">
                {remaining <= 0
                  ? 'Reservation expired — refreshing availability…'
                  : remaining <= 30
                    ? 'Last seconds — confirm now.'
                    : remaining <= 120
                      ? 'Hurry — your spot expires soon.'
                      : 'Confirm before this timer ends.'}
              </p>
              <div className="mt-8 space-y-3">
                <PrimaryButton
                  fullWidth
                  disabled={busy || remaining <= 0}
                  onClick={() => void confirmSpot()}
                >
                  {busy ? 'Confirming…' : 'Confirm'}
                </PrimaryButton>
                <SecondaryButton
                  fullWidth
                  disabled={busy}
                  onClick={() => void cancelSpot()}
                >
                  Cancel reservation
                </SecondaryButton>
              </div>
            </section>
          </StatusTransition>
        ) : null}

        {phase === 'hosting' ? (
          <StatusTransition phaseKey="hosting">
            <section className="glass-elevated p-6 text-center">
              <p className="display-lg">You&apos;re hosting.</p>
              <p className="mt-3 text-[14px] text-white/45">
                You created this game — manage it from game details.
              </p>
              <div className="mt-8 flex flex-col gap-3">
                <Link to="/my-games">
                  <PrimaryButton fullWidth>My Games</PrimaryButton>
                </Link>
                <Link to={`/games/${game.id}`}>
                  <SecondaryButton fullWidth>Game details</SecondaryButton>
                </Link>
              </div>
            </section>
          </StatusTransition>
        ) : null}

        {phase === 'done' ? (
          <StatusTransition phaseKey={waitlisted ? 'waitlist-done' : 'join-done'}>
            <section className="glass-elevated p-6 text-center">
              {waitlisted ? (
                <SuccessFeedback label="You're on the waitlist" tone="amber" />
              ) : (
                <SuccessFeedback label="You're in" tone="success" />
              )}
              <p className="mt-4 text-[14px] text-white/45">
                {waitlisted
                  ? 'You’ll move up if a player leaves.'
                  : 'See you on the field.'}
              </p>
              <div className="mt-8 flex flex-col gap-3">
                <Link to="/my-games">
                  <PrimaryButton fullWidth>My Games</PrimaryButton>
                </Link>
                <Link to={`/games/${game.id}`}>
                  <SecondaryButton fullWidth>Game details</SecondaryButton>
                </Link>
                {!waitlisted ? (
                  <SecondaryButton fullWidth onClick={() => void cancelSpot()}>
                    Leave this game
                  </SecondaryButton>
                ) : null}
              </div>
            </section>
          </StatusTransition>
        ) : null}
      </div>
    </div>
  )
}
