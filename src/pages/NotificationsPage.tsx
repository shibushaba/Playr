import { ListPageSkeleton } from '@/components/motion/Skeleton'
import { MotionTextLink } from '@/components/motion/MotionLink'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useAuth } from '@/contexts/AuthContext'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/format'
import {
  notificationDotClass,
  notificationSemantic,
} from '@/lib/notificationSemantics'
import {
  listNotifications,
  markAllRead,
  markRead,
} from '@/services/notifications'
import type { NotificationItem } from '@/types/domain'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function reload() {
    const list = await listNotifications(30)
    setItems(list)
  }

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void reload()
      .catch((e) => setError(toUserMessage(e, "Couldn't load notifications.")))
      .finally(() => setLoading(false))
  }, [user])

  if (!user) {
    return (
      <div>
        <Header title="Notifications" backTo="/home" />
        <div className="page-pad py-6">
          <PrimaryButton fullWidth onClick={() => navigate('/auth?next=/notifications')}>
            Sign in
          </PrimaryButton>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header
        title="Notifications"
        backTo="/home"
        right={
          items.some((n) => !n.readAt) ? (
            <MotionTextLink
              disabled={busy}
              className={busy ? 'opacity-40' : undefined}
              onClick={() => {
                setBusy(true)
                void markAllRead()
                  .then(() => {
                    setItems((prev) =>
                      prev.map((item) =>
                        item.readAt
                          ? item
                          : { ...item, readAt: new Date().toISOString() },
                      ),
                    )
                  })
                  .catch((e) => setError(toUserMessage(e, "Couldn't update.")))
                  .finally(() => setBusy(false))
              }}
            >
              Mark all read
            </MotionTextLink>
          ) : null
        }
      />
      <div className="page-pad space-y-0 py-2">
        {loading ? (
          <ListPageSkeleton />
        ) : error ? (
          <div className="py-4">
            <EmptyState title="Couldn't load" description={error} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-4">
            <EmptyState
              title="You're all caught up"
              description="No notifications right now."
            />
          </div>
        ) : (
          <ul className="glass divide-y divide-white/10">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={cn(
                    'motion-row flex w-full gap-3 px-4 py-4 text-left',
                    !n.readAt && 'motion-read-fade',
                  )}
                  onClick={() => {
                    const prevReadAt = n.readAt
                    if (!n.readAt) {
                      setItems((prev) =>
                        prev.map((item) =>
                          item.id === n.id
                            ? { ...item, readAt: new Date().toISOString() }
                            : item,
                        ),
                      )
                      void markRead([n.id]).catch(() => {
                        setItems((prev) =>
                          prev.map((item) =>
                            item.id === n.id
                              ? { ...item, readAt: prevReadAt }
                              : item,
                          ),
                        )
                        setError("Couldn't mark notification as read.")
                      })
                    }
                    if (n.gameId) {
                      if (n.type === 'waitlist_spot') {
                        navigate(`/games/${n.gameId}/join`)
                      } else {
                        navigate(`/games/${n.gameId}`)
                      }
                    } else if (n.groupId) navigate(`/groups/${n.groupId}`)
                  }}
                >
                  <span className="mt-1.5 flex w-3 shrink-0 justify-center">
                    {!n.readAt ? (
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          notificationDotClass(notificationSemantic(n.type)),
                        )}
                        aria-label="Unread"
                      />
                    ) : (
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full opacity-50',
                          notificationDotClass(notificationSemantic(n.type)),
                        )}
                        aria-hidden
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-white">{n.title}</p>
                    {n.body ? (
                      <p className="mt-1 text-[13px] leading-relaxed text-white/45">
                        {n.body}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[11px] uppercase tracking-[0.06em] text-white/45">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="pt-6">
          <Link to="/home">
            <SecondaryButton fullWidth>Back to Home</SecondaryButton>
          </Link>
        </div>
      </div>
    </div>
  )
}
