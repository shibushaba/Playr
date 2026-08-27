import { Header } from '@/components/layout/Header'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'
import { formatPhoneDisplay, isValidE164 } from '@/lib/phone'
import { useNavigate, useSearchParams } from 'react-router-dom'

/** Lightweight post-signup onboarding — profile details can be added anytime. */
export function WelcomePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/home'
  const { user, profile, refreshProfile } = useAuth()

  useEffect(() => {
    if (!user) {
      navigate(
        `/auth?next=${encodeURIComponent(`/welcome?next=${encodeURIComponent(next)}`)}`,
        { replace: true },
      )
      return
    }
    void refreshProfile()
  }, [user, navigate, next, refreshProfile])

  if (!user) return null

  const dest = next.startsWith('/') ? next : '/home'
  const name = profile?.display_name?.trim()
  const hasPhone = isValidE164(profile?.phone)

  return (
    <div className="min-h-dvh pb-10">
      <Header title="Welcome to PLAYR" backTo="/home" />
      <div className="page-pad space-y-8 py-8">
        <div>
          <h1 className="display-lg">
            {name ? `You're in, ${name}.` : "You're in."}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-white/45">
            Your account is ready. Browse games, join pickups, and host when
            you&apos;re ready.
          </p>
        </div>

        <ul className="glass space-y-0 overflow-hidden">
          <li className="flex items-start gap-4 border-b border-white/10 p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold">
              1
            </span>
            <div>
              <p className="text-[15px] font-semibold text-white">Name</p>
              <p className="mt-1 text-[13px] text-white/45">
                {name || 'Add your name in profile'}
              </p>
            </div>
            <span className="ml-auto text-[12px] font-semibold uppercase tracking-[0.06em] text-status-success">
              {name ? 'Done' : '—'}
            </span>
          </li>
          <li className="flex items-start gap-4 border-b border-white/10 p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold">
              2
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">Phone</p>
              <p className="mt-1 text-[13px] text-white/45">
                {hasPhone && profile?.phone
                  ? formatPhoneDisplay(profile.phone)
                  : 'Add your number in profile'}
              </p>
            </div>
            <span
              className={
                hasPhone
                  ? 'ml-auto text-[12px] font-semibold uppercase tracking-[0.06em] text-status-success'
                  : 'ml-auto text-[12px] font-semibold uppercase tracking-[0.06em] text-status-warning'
              }
            >
              {hasPhone ? 'Done' : 'Required'}
            </span>
          </li>
          <li className="flex items-start gap-4 p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold">
              3
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">Photo & bio</p>
              <p className="mt-1 text-[13px] text-white/45">
                Optional. Add anytime from your profile.
              </p>
            </div>
          </li>
        </ul>

        <div className="space-y-3">
          <PrimaryButton fullWidth onClick={() => navigate(dest)}>
            Start exploring
          </PrimaryButton>
          <SecondaryButton fullWidth onClick={() => navigate('/profile')}>
            Set up profile
          </SecondaryButton>
        </div>
      </div>
    </div>
  )
}
