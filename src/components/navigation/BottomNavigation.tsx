import { FixedChrome } from '@/components/ui/ChromePosition'
import { GlassChromeBar } from '@/components/ui/GlassChromeBar'
import { cn } from '@/lib/format'
import {
  CalendarDays,
  Home,
  Plus,
  User,
  Users,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'

const sideItems = [
  { to: '/home', label: 'Play', icon: Home, end: true },
  { to: '/my-games', label: 'Games', icon: CalendarDays, end: false },
  { to: '/groups', label: 'Clubs', icon: Users, end: false },
  { to: '/profile', label: 'You', icon: User, end: false },
] as const

export function BottomNavigation() {
  const mobileNav = (
    <FixedChrome
      className="inset-x-3 bottom-3 mx-auto max-w-lg lg:hidden"
      style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
    >
      <GlassChromeBar as="nav" className="px-1 pb-1 pt-2" aria-label="Primary">
        <ul className="grid grid-cols-5 items-end">
          <SideItem item={sideItems[0]} />
          <SideItem item={sideItems[1]} />
          <li className="flex flex-col items-center justify-end pb-0.5">
            <NavLink
              to="/host"
              aria-label="Host a game"
              className={({ isActive }) =>
                cn(
                  'motion-btn flex h-14 w-14 -translate-y-2 flex-col items-center justify-center rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
                  isActive
                    ? 'bg-white text-cta ring-2 ring-white/35'
                    : 'bg-white text-cta hover:bg-white/90',
                )
              }
            >
              <Plus className="h-6 w-6" strokeWidth={2.25} aria-hidden />
            </NavLink>
            <span className="pointer-events-none text-[10px] font-semibold uppercase tracking-[0.06em] text-white/45">
              Host
            </span>
          </li>
          <SideItem item={sideItems[2]} />
          <SideItem item={sideItems[3]} />
        </ul>
      </GlassChromeBar>
    </FixedChrome>
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
          {sideItems.slice(0, 3).map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'motion-btn flex min-h-11 items-center gap-3 rounded-[8px] px-3 py-2.5 text-[12px] font-medium uppercase tracking-[0.08em]',
                    isActive
                      ? 'motion-nav-active bg-white/[0.1] text-white'
                      : 'text-white/45 hover:bg-white/[0.04] hover:text-white',
                  )
                }
              >
                <item.icon className="h-4 w-4" strokeWidth={1.6} />
                {item.label}
              </NavLink>
            </li>
          ))}
          <li className="pt-2">
            <NavLink
              to="/host"
              className={({ isActive }) =>
                cn(
                  'motion-btn flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-white px-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-cta',
                  isActive ? 'ring-2 ring-white/40' : 'hover:bg-white/90',
                )
              }
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} />
              Host a game
            </NavLink>
          </li>
        </ul>
        <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-3 rounded-[8px] px-3 py-2.5 text-[12px] font-medium uppercase tracking-[0.08em]',
                isActive
                  ? 'bg-white/[0.1] text-white'
                  : 'text-white/45 hover:text-white',
              )
            }
          >
            <User className="h-4 w-4" strokeWidth={1.6} />
            You
          </NavLink>
        </div>
      </aside>
    </>
  )
}

function SideItem({
  item,
}: {
  item: (typeof sideItems)[number]
}) {
  const Icon = item.icon
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          cn(
            'motion-btn flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[8px] text-[10px] font-semibold uppercase tracking-[0.06em]',
            isActive
              ? 'motion-nav-active text-white'
              : 'text-white/40 hover:text-white/70',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.6} />
            {item.label}
          </>
        )}
      </NavLink>
    </li>
  )
}
