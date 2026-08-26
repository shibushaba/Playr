import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { countUnread } from '@/services/notifications'

export function NotificationBell() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) {
      setCount(0)
      return
    }
    let cancelled = false
    void countUnread()
      .then((n) => {
        if (!cancelled) setCount(n)
      })
      .catch(() => {
        if (!cancelled) setCount(0)
      })
    const t = window.setInterval(() => {
      void countUnread()
        .then((n) => {
          if (!cancelled) setCount(n)
        })
        .catch(() => undefined)
    }, 45_000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [user])

  if (!user) return null

  return (
    <Link
      to="/notifications"
      className="glass relative flex h-10 w-10 items-center justify-center text-white transition hover:border-white/20"
      aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
    >
      <Bell className="h-4 w-4" strokeWidth={1.75} />
      {count > 0 ? (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white" />
      ) : null}
    </Link>
  )
}
