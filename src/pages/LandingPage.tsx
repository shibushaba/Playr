import { FadeIn } from '@/components/motion/FadeIn'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="page-pad flex items-center justify-between pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <p className="font-[family-name:var(--font-display)] text-[16px] font-semibold tracking-tight text-white">
          PLAYR
        </p>
        <Link
          to="/auth"
          className="motion-link flex min-h-11 items-center text-[14px] font-medium text-white/55"
        >
          Sign in
        </Link>
      </header>

      <FadeIn>
        <main className="page-pad flex flex-1 flex-col justify-end pb-6 pt-10">
          <p className="text-[13px] text-white/45">Pickup sports</p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(3rem,16vw,5.5rem)] font-semibold leading-[0.9] tracking-tight text-white">
            Find a game.
          </h1>
          <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-white/70">
            Nearby pickup. Join in minutes. Host when you&apos;re ready.
          </p>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-white/40">
            Football, cricket, badminton, and more. No payments in the app.
          </p>
        </main>
      </FadeIn>

      <FadeIn delay={80}>
        <footer className="page-pad space-y-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
          <Link to="/auth" className="block">
            <PrimaryButton fullWidth>Get started</PrimaryButton>
          </Link>
          <Link to="/home" className="block">
            <PrimaryButton fullWidth variant="outline">
              Browse nearby
            </PrimaryButton>
          </Link>
        </footer>
      </FadeIn>
    </div>
  )
}
