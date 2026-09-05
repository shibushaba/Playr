import { FixedChrome } from '@/components/ui/ChromePosition'
import { GlassChromeBar } from '@/components/ui/GlassChromeBar'
import { GlassScrim } from '@/components/ui/GlassScrim'
import { Icon } from '@/components/ui/Icon'
import { Calendar03Icon, Add01Icon, Home01Icon, UserGroupIcon, UserIcon } from '@/icons/navigation'
import { Cancel01Icon } from '@/icons/actions'
import { cn } from '@/lib/format'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

const sideItems = [
  { to: '/home', label: 'Play', icon: Home01Icon, end: true },
  { to: '/my-games', label: 'Games', icon: Calendar03Icon, end: false },
  { to: '/groups', label: 'Clubs', icon: UserGroupIcon, end: false },
  { to: '/profile', label: 'You', icon: UserIcon, end: false },
] as const

const hostActions = [
  { to: '/host', label: 'Host a game', hint: 'One-off pickup' },
  { to: '/groups/new', label: 'Create a club', hint: 'Recurring schedule' },
] as const

export function BottomNavigation() {
  const [hostOpen, setHostOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setHostOpen(false)
  }, [location.pathname])

  const mobileNav = (
    <FixedChrome
      className="inset-x-3 bottom-3 mx-auto max-w-lg md:hidden"
      style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
    >
      <GlassChromeBar as="nav" className="nav-dock px-1 pb-1 pt-2" aria-label="Primary">
        <ul className="grid grid-cols-5 items-end">
          <SideItem item={sideItems[0]} />
          <SideItem item={sideItems[1]} />
          <li className="flex flex-col items-center justify-end pb-0.5">
            <button
              type="button"
              aria-label={hostOpen ? 'Close host actions' : 'Host'}
              aria-expanded={hostOpen}
              onClick={() => setHostOpen((open) => !open)}
              className={cn(
                'motion-btn flex h-12 w-12 flex-col items-center justify-center rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
                hostOpen || location.pathname === '/host' || location.pathname === '/groups/new'
                  ? 'bg-white text-cta ring-2 ring-white/35'
                  : 'bg-white text-cta hover:bg-white/90',
              )}
            >
              <Icon
                icon={hostOpen ? Cancel01Icon : Add01Icon}
                size={22}
                strokeWidth={2}
                aria-hidden
              />
            </button>
            <span className="pointer-events-none mt-0.5 text-[11px] font-medium text-white/50">
              Host
            </span>
          </li>
          <SideItem item={sideItems[2]} />
          <SideItem item={sideItems[3]} />
        </ul>
      </GlassChromeBar>
    </FixedChrome>
  )

  const hostSheet = hostOpen ? (
    <div className="fixed inset-0 z-[110] md:hidden">
      <GlassScrim
        aria-label="Close host actions"
        className="motion-scrim-in"
        onClick={() => setHostOpen(false)}
      />
      <div className="pointer-events-none absolute inset-x-3 bottom-[5.5rem] mx-auto max-w-lg pb-[env(safe-area-inset-bottom)]">
        <div className="pointer-events-auto glass-elevated motion-sheet-in space-y-1 p-2">
          {hostActions.map((action) => (
            <button
              key={action.to}
              type="button"
              className="motion-btn flex w-full items-center justify-between rounded-[8px] px-4 py-3 text-left hover:bg-white/[0.06]"
              onClick={() => {
                setHostOpen(false)
                navigate(action.to)
              }}
            >
              <span>
                <span className="block text-[15px] font-semibold text-white">
                  {action.label}
                </span>
                <span className="mt-0.5 block text-[12px] text-white/45">
                  {action.hint}
                </span>
              </span>
              <Icon icon={Add01Icon} size={16} className="text-white/40" />
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {typeof document !== 'undefined'
        ? createPortal(mobileNav, document.body)
        : mobileNav}
      {typeof document !== 'undefined' && hostSheet
        ? createPortal(hostSheet, document.body)
        : hostSheet}

      <aside className="chrome-sidebar fixed inset-y-0 left-0 z-40 hidden px-2 py-6 md:flex md:w-16 md:flex-col lg:w-52 lg:px-4">
        <NavLink to="/home" className="mb-8 flex items-center justify-center lg:mb-10 lg:justify-start lg:px-2">
          <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight text-white lg:text-[18px]">
            <span className="lg:hidden">P</span>
            <span className="hidden lg:inline">PLAYR</span>
          </span>
        </NavLink>
        <ul className="flex flex-1 flex-col gap-0.5">
          {sideItems.slice(0, 3).map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                title={item.label}
                className={({ isActive }) =>
                  cn(
                    'motion-btn flex min-h-11 items-center justify-center gap-3 rounded-[8px] px-2 py-2.5 text-[14px] font-medium lg:justify-start lg:px-3',
                    isActive
                      ? 'motion-nav-active bg-white/[0.1] text-white'
                      : 'text-white/45 hover:bg-white/[0.04] hover:text-white',
                  )
                }
              >
                <Icon icon={item.icon} size={18} />
                <span className="hidden lg:inline">{item.label}</span>
              </NavLink>
            </li>
          ))}
          <li className="pt-2">
            <NavLink
              to="/host"
              title="Host a game"
              className={({ isActive }) =>
                cn(
                  'motion-btn flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-white px-2 text-[14px] font-semibold text-cta lg:min-h-12 lg:px-3',
                  isActive ? 'ring-2 ring-white/40' : 'hover:bg-white/90',
                )
              }
            >
              <Icon icon={Add01Icon} size={16} strokeWidth={2} />
              <span className="hidden lg:inline">Host a game</span>
            </NavLink>
          </li>
          <li className="pt-1">
            <NavLink
              to="/groups/new"
              title="Create a club"
              className={({ isActive }) =>
                cn(
                  'motion-btn hidden min-h-10 items-center justify-center rounded-[8px] px-3 text-[13px] font-medium lg:flex lg:justify-start',
                  isActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/40 hover:text-white',
                )
              }
            >
              Create a club
            </NavLink>
          </li>
        </ul>
        <div className="mt-auto border-t border-white/10 pt-4">
          <NavLink
            to="/profile"
            title="You"
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center justify-center gap-3 rounded-[8px] px-2 py-2.5 text-[14px] font-medium lg:justify-start lg:px-3',
                isActive
                  ? 'bg-white/[0.1] text-white'
                  : 'text-white/45 hover:text-white',
              )
            }
          >
            <Icon icon={UserIcon} size={18} />
            <span className="hidden lg:inline">You</span>
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
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          cn(
            'motion-btn flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[8px] text-[11px] font-medium',
            isActive
              ? 'motion-nav-active text-white'
              : 'text-white/40 hover:text-white/70',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              icon={item.icon}
              size={20}
              strokeWidth={isActive ? 2 : 1.5}
            />
            {item.label}
          </>
        )}
      </NavLink>
    </li>
  )
}
