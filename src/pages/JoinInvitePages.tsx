import { Header } from '@/components/layout/Header'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useAuth } from '@/contexts/AuthContext'
import { toUserMessage } from '@/lib/errors'
import {
  acceptGameInvite,
  acceptGroupInvite,
  validateGameInvite,
  validateGroupInvite,
} from '@/services/invites'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

export function JoinGameInvitePage() {
  const { token = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void validateGameInvite(token)
      .then((p) => setPreview(p as unknown as Record<string, unknown>))
      .catch((e) => setError(toUserMessage(e, 'Invite unavailable.')))
  }, [token])

  const valid = Boolean(preview?.valid)
  const gameId = (preview?.game_id as string) || (preview?.gameId as string)

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      const res = await acceptGameInvite(token)
      if (res.gameId) navigate(`/games/${res.gameId}/join`)
      else if (gameId) navigate(`/games/${gameId}/join`)
      else navigate('/home')
    } catch (e) {
      setError(toUserMessage(e, "Couldn't accept invite."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Header title="Game invite" backTo="/home" />
      <div className="page-pad space-y-6 py-6">
        {error ? (
          <p className="glass px-3 py-2 text-[13px] text-white/80">{error}</p>
        ) : null}

        {!preview ? (
          <p className="text-[14px] text-white/45">Checking invite…</p>
        ) : !valid ? (
          <div className="glass-elevated p-5">
            <p className="label-caps">Invalid</p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-tight text-white">
              Invite not valid
            </p>
            <p className="mt-2 text-[14px] text-white/45">
              {(preview.reason as string) === 'expired'
                ? 'This invite has expired.'
                : (preview.reason as string) === 'revoked'
                  ? 'This invite was revoked.'
                  : 'This invite link is not available.'}
            </p>
          </div>
        ) : (
          <div className="glass p-5">
            <p className="label-caps">Game invite</p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-tight text-white">
              {String(preview.title ?? 'Game')}
            </p>
            <p className="mt-2 text-[14px] text-white/45">
              {String(preview.game_date ?? '')} ·{' '}
              {String(preview.start_time ?? '').slice(0, 5)}
            </p>
            <p className="mt-4 text-[13px] text-white/40">
              Private game details stay hidden until the invite is validated.
            </p>
          </div>
        )}

        {!user ? (
          <PrimaryButton
            fullWidth
            onClick={() =>
              navigate(`/auth?next=${encodeURIComponent(`/join/game/${token}`)}`)
            }
          >
            Sign in to continue →
          </PrimaryButton>
        ) : valid ? (
          <PrimaryButton fullWidth disabled={busy} onClick={() => void accept()}>
            {busy ? 'Opening…' : 'Continue to join →'}
          </PrimaryButton>
        ) : (
          <SecondaryButton fullWidth onClick={() => navigate('/home')}>
            Go home
          </SecondaryButton>
        )}
      </div>
    </div>
  )
}

export function JoinGroupInvitePage() {
  const { token = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void validateGroupInvite(token)
      .then((p) => setPreview(p as unknown as Record<string, unknown>))
      .catch((e) => setError(toUserMessage(e, 'Invite unavailable.')))
  }, [token])

  const valid = Boolean(preview?.valid)
  const groupId = (preview?.group_id as string) || (preview?.groupId as string)

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      const res = await acceptGroupInvite(token)
      if (res.groupId) navigate(`/groups/${res.groupId}`)
      else if (groupId) navigate(`/groups/${groupId}`)
      else navigate('/groups')
    } catch (e) {
      setError(toUserMessage(e, "Couldn't accept invite."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Header title="Group invite" backTo="/groups" />
      <div className="page-pad space-y-6 py-6">
        {error ? (
          <p className="glass px-3 py-2 text-[13px] text-white/80">{error}</p>
        ) : null}

        {!preview ? (
          <p className="text-[14px] text-white/45">Checking invite…</p>
        ) : !valid ? (
          <div className="glass-elevated p-5">
            <p className="label-caps">Invalid</p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-tight text-white">
              Invite not valid
            </p>
            <p className="mt-2 text-[14px] text-white/45">
              This group invite is expired, revoked, or unknown.
            </p>
          </div>
        ) : (
          <div className="glass p-5">
            <p className="label-caps">Group invite</p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-tight text-white">
              {String(preview.name ?? 'Group')}
            </p>
            <p className="mt-2 text-[14px] text-white/45">
              You were invited to join this recurring group.
            </p>
          </div>
        )}

        {!user ? (
          <PrimaryButton
            fullWidth
            onClick={() =>
              navigate(`/auth?next=${encodeURIComponent(`/join/group/${token}`)}`)
            }
          >
            Sign in to continue →
          </PrimaryButton>
        ) : valid ? (
          <PrimaryButton fullWidth disabled={busy} onClick={() => void accept()}>
            {busy ? 'Joining…' : 'Accept invite →'}
          </PrimaryButton>
        ) : (
          <SecondaryButton fullWidth onClick={() => navigate('/groups')}>
            Browse groups
          </SecondaryButton>
        )}
      </div>
    </div>
  )
}
