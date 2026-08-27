import { BottomNavigation } from '@/components/navigation/BottomNavigation'
import { SiteCredit } from '@/components/layout/SiteCredit'
import { FloatingInstallButton } from '@/components/pwa/FloatingInstallButton'
import { AnimatedOutlet } from '@/components/motion/AnimatedOutlet'

export function AppLayout() {
  return (
    <div className="app-shell min-h-dvh bg-transparent">
      <BottomNavigation />
      <FloatingInstallButton />
      <div className="lg:pl-52">
        <main className="chrome-scroll-main mx-auto min-h-dvh w-full max-w-3xl safe-bottom">
          <AnimatedOutlet />
          <SiteCredit />
        </main>
      </div>
    </div>
  )
}
