import { Header } from '@/components/layout/Header'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
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
    <div className="flex min-h-dvh flex-col">
      <Header title="You're in" backTo="/home" />
      <div className="page-pad flex-1 space-y-8 py-8">
        <div>
          <h1 className="display-lg">
            {name ? `Hi, ${name}.` : "You're in."}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-white/45">
            Browse nearby games now. Add a photo or bio anytime from You.
          </p>
        </div>

        <ul className="glass space-y-0 overflow-hidden">
          <li className="flex items-start gap-4 border-b border-white/10 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold">
              1
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">Name</p>
              <p className="mt-1 text-[13px] text-white/45">
                {name || 'Add your name in profile'}
              </p>
            </div>
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-status-success">
              {name ? 'Done' : '—'}
            </span>
          </li>
          <li className="flex items-start gap-4 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold">
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
                  ? 'text-[12px] font-semibold uppercase tracking-[0.06em] text-status-success'
                  : 'text-[12px] font-semibold uppercase tracking-[0.06em] text-status-warning'
              }
            >
              {hasPhone ? 'Done' : 'Required'}
            </span>
          </li>
        </ul>
      </div>

      <footer className="sticky bottom-0 z-10 border-t border-white/10 bg-bg/90 px-5 py-4 backdrop-blur-md pb-[max(1rem,env(safe-area-inset-bottom))]">
        <PrimaryButton fullWidth onClick={() => navigate(dest)}>
          Start playing
        </PrimaryButton>
        <button
          type="button"
          className="mt-3 flex min-h-11 w-full items-center justify-center text-[12px] font-semibold uppercase tracking-[0.08em] text-white/45 transition hover:text-white"
          onClick={() => navigate('/profile')}
        >
          Set up profile
        </button>
      </footer>
    </div>
  )
}
