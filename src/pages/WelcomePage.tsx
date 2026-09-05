import { Header } from '@/components/layout/Header'
import { Icon } from '@/components/ui/Icon'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { Tick02Icon } from '@/icons/actions'
import { useAuth } from '@/contexts/AuthContext'
import { formatPhoneDisplay, isValidE164 } from '@/lib/phone'
import { useEffect } from 'react'
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
  const doneCount = (name ? 1 : 0) + (hasPhone ? 1 : 0)
  const progress = (doneCount / 2) * 100

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
          <div className="mt-5">
            <p className="text-[13px] text-white/45">
              {doneCount} of 2 ready
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-white transition-[width] duration-[var(--motion-normal)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <ul className="space-y-2">
          <li className="glass flex items-start gap-4 p-4">
            <span
              className={
                name
                  ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-cta'
                  : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold'
              }
            >
              {name ? <Icon icon={Tick02Icon} size={18} /> : '1'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">Name</p>
              <p className="mt-1 text-[13px] text-white/45">
                {name || 'Add your name in profile'}
              </p>
            </div>
          </li>
          <li className="glass flex items-start gap-4 p-4">
            <span
              className={
                hasPhone
                  ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-cta'
                  : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold'
              }
            >
              {hasPhone ? <Icon icon={Tick02Icon} size={18} /> : '2'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">Phone</p>
              <p className="mt-1 text-[13px] text-white/45">
                {hasPhone && profile?.phone
                  ? formatPhoneDisplay(profile.phone)
                  : 'Add your number in profile'}
              </p>
            </div>
          </li>
        </ul>
      </div>

      <footer className="sticky bottom-0 z-10 border-t border-white/10 bg-bg/90 px-5 py-4 backdrop-blur-md pb-[max(1rem,env(safe-area-inset-bottom))]">
        <PrimaryButton fullWidth onClick={() => navigate(dest)}>
          Start playing
        </PrimaryButton>
        <button
          type="button"
          className="mt-3 flex min-h-11 w-full items-center justify-center text-[13px] font-medium text-white/45 transition hover:text-white"
          onClick={() => navigate('/profile')}
        >
          Set up profile
        </button>
      </footer>
    </div>
  )
}
