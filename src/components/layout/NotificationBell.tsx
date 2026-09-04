import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { countUnread } from '@/services/notifications'

export function NotificationBell() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)
  const prevCount = useRef(0)
  const [badgePop, setBadgePop] = useState(false)

  useEffect(() => {
    if (!user) {
      setCount(0)
      prevCount.current = 0
      return
    }
    let cancelled = false
    void countUnread()
      .then((n) => {
        if (!cancelled) {
          if (n > prevCount.current && prevCount.current >= 0) {
            setBadgePop(true)
          }
          prevCount.current = n
          setCount(n)
        }
      })
      .catch(() => {
        if (!cancelled) setCount(0)
      })
    const t = window.setInterval(() => {
      void countUnread()
        .then((n) => {
          if (!cancelled) {
            if (n > prevCount.current) setBadgePop(true)
            prevCount.current = n
            setCount(n)
          }
        })
        .catch(() => undefined)
    }, 45_000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [user])

  useEffect(() => {
    if (!badgePop) return
    const t = window.setTimeout(() => setBadgePop(false), 400)
    return () => window.clearTimeout(t)
  }, [badgePop])

  if (!user) return null

  return (
    <Link
      to="/notifications"
      className="glass motion-btn relative flex h-11 w-11 items-center justify-center text-white hover:border-white/20"
      aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
    >
      <Bell className="h-4 w-4" strokeWidth={1.75} />
      {count > 0 ? (
        <span
          className={
            badgePop
              ? 'motion-badge-pop absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white'
              : 'absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white'
          }
        />
      ) : null}
    </Link>
  )
}
