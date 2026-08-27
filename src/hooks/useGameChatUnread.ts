import {
  hasUnreadChatMessages,
  isUnreadChatMessage,
  markChatRead,
} from '@/lib/chatRead'
import { listGameMessages, subscribeGameMessages } from '@/services/chat'
import { useEffect, useState } from 'react'

export function useGameChatUnread(
  gameId: string | undefined,
  userId: string | undefined,
  enabled: boolean,
  chatTabActive: boolean,
): boolean {
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    if (!enabled || !gameId || !userId) {
      setHasUnread(false)
      return
    }

    if (chatTabActive) {
      markChatRead(userId, gameId)
      setHasUnread(false)
      return
    }

    let cancelled = false

    void listGameMessages(gameId)
      .then((messages) => {
        if (!cancelled) {
          setHasUnread(hasUnreadChatMessages(messages, userId, gameId))
        }
      })
      .catch(() => {
        if (!cancelled) setHasUnread(false)
      })

    const unsub = subscribeGameMessages(gameId, {
      onInsert: (msg) => {
        if (cancelled) return
        if (isUnreadChatMessage(msg.createdAt, msg.senderId, userId, gameId)) {
          setHasUnread(true)
        }
      },
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [enabled, gameId, userId, chatTabActive])

  return hasUnread
}
