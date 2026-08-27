import { SiteCredit } from '@/components/layout/SiteCredit'
import { FloatingInstallButton } from '@/components/pwa/FloatingInstallButton'
import { AnimatedOutlet } from '@/components/motion/AnimatedOutlet'

export function PublicLayout() {
  return (
    <div className="app-shell min-h-dvh bg-transparent">
      <FloatingInstallButton />
      <main className="mx-auto min-h-dvh w-full max-w-lg">
        <AnimatedOutlet />
        <SiteCredit />
      </main>
    </div>
  )
}
