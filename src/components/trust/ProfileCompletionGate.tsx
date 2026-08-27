import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useAuth } from '@/contexts/AuthContext'
import { toUserMessage } from '@/lib/errors'
import {
  canCreateGroup,
  canHostGame,
  canJoinGame,
  getProfileCompletion,
  type ProfileCompletionStatus,
} from '@/lib/profileCompletion'
import { resendEmailVerification } from '@/services/verification'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  requiredFor: 'join' | 'host' | 'venue'
}

export function ProfileCompletionGate({ requiredFor }: Props) {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [emailSent, setEmailSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready =
    requiredFor === 'host'
      ? canHostGame(profile, user)
      : requiredFor === 'venue'
        ? canCreateGroup(profile, user)
        : canJoinGame(profile, user)

  if (ready) return null

  const completion = getProfileCompletion(profile, user)
  const title =
    requiredFor === 'host'
      ? completion.status === 'email_required'
        ? 'Confirm your email to host'
        : completion.status === 'phone_required'
          ? 'Add your phone to host'
          : 'Complete your profile to host'
      : completion.status === 'phone_required'
        ? 'Add your phone to continue'
        : 'Add your name to continue'

  async function sendEmailVerification() {
    setBusy(true)
    setError(null)
    try {
      await resendEmailVerification()
      setEmailSent(true)
      await refreshProfile()
    } catch (e) {
      setError(toUserMessage(e, "Couldn't send confirmation email."))
    } finally {
      setBusy(false)
    }
  }

  function actionForStatus(status: ProfileCompletionStatus) {
    if (status === 'email_required' && requiredFor === 'host') {
      return (
        <PrimaryButton fullWidth disabled={busy} onClick={() => void sendEmailVerification()}>
          {busy ? 'Sending…' : emailSent ? 'Resend confirmation email' : 'Verify email'}
        </PrimaryButton>
      )
    }
    return (
      <SecondaryButton fullWidth onClick={() => navigate('/profile')}>
        Edit profile
      </SecondaryButton>
    )
  }

  return (
    <section className="glass-elevated space-y-4 p-5">
      <p className="label-caps">Profile</p>
      <h2 className="text-[20px] font-semibold tracking-tight text-white">{title}</h2>
      <p className="text-[14px] leading-relaxed text-white/45">{completion.message}</p>
      {emailSent && completion.status === 'email_required' ? (
        <p className="text-[13px] text-status-success">
          Check your inbox for a confirmation link, then return here.
        </p>
      ) : null}
      {error ? <p className="glass motion-error-in px-3 py-2 text-[13px] text-white">{error}</p> : null}
      {actionForStatus(completion.status)}
    </section>
  )
}
