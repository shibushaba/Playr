import { AnimatedOutlet } from '@/components/motion/AnimatedOutlet'
import { cn } from '@/lib/format'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/venues/review', label: 'Venues' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/feedback', label: 'Feedback' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/activity', label: 'Activity' },
]

export function AdminLayout() {
  return (
    <div className="min-h-dvh bg-transparent">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl">
        <aside className="hidden w-52 shrink-0 border-r border-white/10 bg-bg-2/40 p-4 lg:block">
        <p className="label-caps mb-6 text-white/45">PLAYR Admin</p>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/55 hover:bg-white/5 hover:text-white/80',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <NavLink
            to="/home"
            className="mt-8 block px-3 text-[12px] text-white/40 hover:text-white/70"
          >
            ← Back to app
          </NavLink>
        </aside>

        <main className="flex-1 overflow-x-hidden">
          <div className="border-b border-white/10 px-4 py-3 lg:hidden">
            <p className="text-[13px] font-semibold text-white">PLAYR Admin</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'shrink-0 rounded-full px-3 py-1 text-[12px] font-medium',
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'bg-white/5 text-white/50',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
          <div className="px-4 py-6 lg:px-8 lg:py-8">
            <AnimatedOutlet />
          </div>
        </main>
      </div>
    </div>
  )
}
