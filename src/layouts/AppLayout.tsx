import { BottomNavigation } from '@/components/navigation/BottomNavigation'
import { Outlet } from 'react-router-dom'

export function AppLayout() {
  return (
    <div className="app-shell min-h-dvh bg-transparent">
      <BottomNavigation />
      <div className="lg:pl-52">
        <main className="mx-auto min-h-dvh w-full max-w-3xl safe-bottom">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
