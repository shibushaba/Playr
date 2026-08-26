import { GlassChromeBar } from '@/components/ui/GlassChromeBar'
import { cn } from '@/lib/format'
import {
  CalendarDays,
  Compass,
  Home,
  Users,
  User,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/my-games', label: 'Games', icon: CalendarDays },
  { to: '/profile', label: 'Profile', icon: User },
] as const

export function BottomNavigation() {
  const mobileNav = (
    <GlassChromeBar
      as="nav"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-lg px-1 py-1 lg:hidden"
      style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-[0.08em] transition duration-200',
                  isActive
                    ? 'bg-white/[0.1] text-white'
                    : 'text-white/40 hover:text-white/70',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className="h-4 w-4"
                    strokeWidth={isActive ? 2.25 : 1.6}
                  />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </GlassChromeBar>
  )

  return (
    <>
      {typeof document !== 'undefined'
        ? createPortal(mobileNav, document.body)
        : mobileNav}

      <aside className="chrome-sidebar fixed inset-y-0 left-0 z-40 hidden w-52 px-4 py-6 lg:flex lg:flex-col">
        <NavLink to="/home" className="mb-10 px-2">
          <span className="font-[family-name:var(--font-display)] text-[18px] font-semibold uppercase tracking-[0.18em] text-white">
            PLAYR
          </span>
        </NavLink>
        <ul className="flex flex-1 flex-col gap-0.5">
          {items.slice(0, 4).map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-[12px] font-medium uppercase tracking-[0.08em] transition duration-200',
                    isActive
                      ? 'bg-white/[0.1] text-white'
                      : 'text-white/45 hover:bg-white/[0.04] hover:text-white',
                  )
                }
              >
                <Icon className="h-4 w-4" strokeWidth={1.6} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-[12px] font-medium uppercase tracking-[0.08em]',
                isActive
                  ? 'bg-white/[0.1] text-white'
                  : 'text-white/45 hover:text-white',
              )
            }
          >
            <User className="h-4 w-4" strokeWidth={1.6} />
            Profile
          </NavLink>
        </div>
      </aside>
    </>
  )
}
