import { FadeIn } from '@/components/motion/FadeIn'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="page-pad flex items-center justify-between border-b border-white/10 py-5">
        <p className="font-[family-name:var(--font-display)] text-[14px] font-semibold uppercase tracking-[0.14em] text-white">
          PLAYR
        </p>
        <Link to="/auth" className="motion-link text-[12px] font-semibold uppercase tracking-[0.08em] text-white/45">
          Sign in
        </Link>
      </header>

      <FadeIn>
      <main className="page-pad flex flex-1 flex-col justify-center py-16">
        <p className="label-caps">Pickup sports</p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-[clamp(3.5rem,18vw,6rem)] font-semibold leading-[0.9] tracking-tight text-white">
          PLAYR
        </h1>
        <p className="mt-6 max-w-sm text-[18px] leading-relaxed text-white/70">
          Find people. Find a game. Play.
        </p>
        <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/45">
          Discover nearby pickup games, join in minutes, or host your own —
          football, cricket, badminton, and more. No payments in the app. Just
          commitment and play.
        </p>
      </main>
      </FadeIn>

      <FadeIn delay={80}>
      <footer className="page-pad space-y-3 border-t border-white/10 py-8">
        <Link to="/auth" className="block">
          <PrimaryButton fullWidth>Sign in</PrimaryButton>
        </Link>
        <Link to="/home" className="block">
          <PrimaryButton fullWidth variant="outline">
            Browse
          </PrimaryButton>
        </Link>
        <p className="pt-2 text-center text-[12px] text-white/45">
          Host books the venue. Fees stay offline between players.
        </p>
      </footer>
      </FadeIn>
    </div>
  )
}
