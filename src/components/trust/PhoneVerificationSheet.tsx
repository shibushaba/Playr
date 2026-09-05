import { OverlaySheet } from '@/components/ui/OverlaySheet'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useAuth } from '@/contexts/AuthContext'
import { toUserMessage } from '@/lib/errors'
import { formatPhoneDisplay, normalizePhoneE164 } from '@/lib/phone'
import {
  confirmPhoneVerification,
  requestPhoneVerification,
} from '@/services/verification'
import { Tick02Icon } from '@/icons/actions'
import { Icon } from '@/components/ui/Icon'
import { useEffect, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  onVerified: () => void
  title?: string
  description?: string
}

export function PhoneVerificationSheet({
  open,
  onClose,
  onVerified,
  title = 'Verify phone',
  description = 'To join real-world games, hosts need a verified number to coordinate with you.',
}: Props) {
  const { refreshProfile } = useAuth()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [normalized, setNormalized] = useState<string | null>(null)
  const [step, setStep] = useState<'enter' | 'code' | 'done'>('enter')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setStep('enter')
      setCode('')
      setChallengeId(null)
      setNormalized(null)
      setError(null)
    }
  }, [open])

  if (!open) return null

  async function sendCode() {
    const e164 = normalizePhoneE164(phone)
    if (!e164) {
      setError('Enter a valid phone number.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await requestPhoneVerification(e164)
      setChallengeId(result.challengeId)
      setNormalized(result.phone)
      setStep('code')
    } catch (e) {
      setError(toUserMessage(e, "Couldn't send verification code."))
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode() {
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await confirmPhoneVerification(code.trim(), challengeId ?? undefined)
      await refreshProfile()
      setStep('done')
      onVerified()
    } catch (e) {
      setError(toUserMessage(e, "Couldn't verify that code."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <OverlaySheet
      onClose={onClose}
      closeLabel="Close"
      lockScroll
      panelClassName="max-w-lg"
    >
        <div className="border-b border-white/10 px-5 py-5">
          <h2 className="text-[18px] font-semibold tracking-tight text-white">
            {step === 'done' ? 'Phone verified' : title}
          </h2>
          {step !== 'done' ? (
            <p className="mt-1 text-[13px] leading-relaxed text-white/45">
              {description}
            </p>
          ) : null}
        </div>

        <div className="space-y-5 px-5 py-6">
          {step === 'enter' ? (
            <>
              <label className="block">
                <span className="label-caps mb-2 block">Phone</span>
                <div className="glass-input flex min-h-11 items-center gap-2 !px-3">
                  <span className="text-[14px] text-white/45">+91</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    inputMode="numeric"
                    placeholder="9876543210"
                    className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
                    autoComplete="tel"
                  />
                </div>
              </label>
              {error ? (
                <p className="glass motion-error-in px-3 py-2 text-[13px] text-white">{error}</p>
              ) : null}
              <PrimaryButton fullWidth disabled={busy} onClick={() => void sendCode()}>
                {busy ? 'Sending…' : 'Send code'}
              </PrimaryButton>
            </>
          ) : null}

          {step === 'code' ? (
            <>
              <p className="text-[13px] text-white/45">
                Code sent to{' '}
                <span className="text-white">
                  {normalized ? formatPhoneDisplay(normalized) : 'your phone'}
                </span>
              </p>
              <label className="block">
                <span className="label-caps mb-2 block">Verification code</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="_ _ _ _ _ _"
                  className="glass-input text-center text-[20px] tracking-[0.3em]"
                  autoComplete="one-time-code"
                />
              </label>
              {error ? (
                <p className="glass motion-error-in px-3 py-2 text-[13px] text-white">{error}</p>
              ) : null}
              <PrimaryButton fullWidth disabled={busy} onClick={() => void verifyCode()}>
                {busy ? 'Verifying…' : 'Verify'}
              </PrimaryButton>
              <SecondaryButton
                fullWidth
                disabled={busy}
                onClick={() => {
                  setStep('enter')
                  setCode('')
                  setError(null)
                }}
              >
                Change number
              </SecondaryButton>
            </>
          ) : null}

          {step === 'done' ? (
            <>
              <div className="flex items-center justify-center gap-2 text-status-success">
                <Icon icon={Tick02Icon} size={20} />
                <span className="text-[15px] font-semibold">Phone verified</span>
              </div>
              <PrimaryButton fullWidth onClick={onClose}>
                Continue
              </PrimaryButton>
            </>
          ) : null}
        </div>
    </OverlaySheet>
  )
}
