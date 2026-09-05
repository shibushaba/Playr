import { LoadingBall } from '@/components/motion/LoadingBall'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/format'
import {
  enrichGameMessageSender,
  listGameMessages,
  mergeGameMessages,
  sendGameMessage,
  subscribeGameMessages,
  type GameMessage,
  type RealtimeHealth,
} from '@/services/chat'
import { Flag01Icon } from '@/icons/actions'
import { Icon } from '@/components/ui/Icon'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  gameId: string
  currentUserId: string | undefined
  readOnly: boolean
  onReportMessage: (messageId: string, senderId: string) => void
}

const POLL_MS = 12_000

export function GameChatPanel({
  gameId,
  currentUserId,
  readOnly,
  onReportMessage,
}: Props) {
  const [messages, setMessages] = useState<GameMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const realtimeHealthRef = useRef<RealtimeHealth>('connecting')
  const pollRef = useRef<number | null>(null)

  const applyMessages = useCallback((incoming: GameMessage[]) => {
    setMessages((prev) => mergeGameMessages(prev, incoming))
  }, [])

  const refreshMessages = useCallback(async () => {
    const list = await listGameMessages(gameId)
    applyMessages(list)
    return list
  }, [applyMessages, gameId])

  const handleRealtimeInsert = useCallback(
    (msg: GameMessage) => {
      applyMessages([msg])
      void enrichGameMessageSender(msg)
        .then((enriched) => applyMessages([enriched]))
        .catch(() => undefined)
    },
    [applyMessages],
  )

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollRef.current != null) return
    pollRef.current = window.setInterval(() => {
      void refreshMessages().catch(() => undefined)
    }, POLL_MS)
  }, [refreshMessages])

  const handleHealthChange = useCallback(
    (health: RealtimeHealth) => {
      realtimeHealthRef.current = health
      if (health === 'healthy') {
        stopPolling()
        return
      }
      if (health === 'unhealthy') {
        startPolling()
      }
    },
    [startPolling, stopPolling],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void refreshMessages()
      .catch((e) => {
        if (!cancelled) setError(toUserMessage(e, "Couldn't load chat."))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const unsub = subscribeGameMessages(gameId, {
      onInsert: (msg) => {
        if (!cancelled) handleRealtimeInsert(msg)
      },
      onHealthChange: (health) => {
        if (!cancelled) handleHealthChange(health)
      },
    })

    return () => {
      cancelled = true
      unsub()
      stopPolling()
    }
  }, [gameId, handleHealthChange, handleRealtimeInsert, refreshMessages, stopPolling])

  useEffect(() => {
    const fallback = window.setTimeout(() => {
      if (realtimeHealthRef.current !== 'healthy') {
        startPolling()
      }
    }, 5_000)
    return () => window.clearTimeout(fallback)
  }, [gameId, startPolling])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send() {
    const text = draft.trim()
    if (!text || busy || readOnly) return
    setBusy(true)
    setError(null)
    try {
      const msg = await sendGameMessage(gameId, text)
      applyMessages([msg])
      setDraft('')
    } catch (e) {
      setError(toUserMessage(e, "Couldn't send message."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass flex min-h-[280px] flex-col">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-[13px] font-medium text-white/55">Chat</p>
      </div>

      <div className="max-h-72 flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <LoadingBall size="sm" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-white/45">
            No messages yet.
            <br />
            Say hello to the group.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId
            return (
              <div key={m.id} className={cn('motion-message-in', mine ? 'text-right' : 'text-left')}>
                <div
                  className="mb-0.5 flex items-center gap-2"
                  style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/45">
                    {mine ? 'You' : m.sender.displayName}
                  </p>
                  {!mine ? (
                    <button
                      type="button"
                      className="text-white/45 transition hover:text-white"
                      aria-label="Report message"
                      onClick={() => onReportMessage(m.id, m.senderId)}
                    >
                      <Icon icon={Flag01Icon} size={12} />
                    </button>
                  ) : null}
                </div>
                <div
                  className={
                    mine
                      ? 'inline-block max-w-[85%] rounded-[8px] border border-white/20 bg-white/[0.14] px-3 py-2 text-left text-[14px] text-white'
                      : 'inline-block max-w-[85%] rounded-[8px] border border-white/10 bg-white/[0.06] px-3 py-2 text-[14px] text-white/85'
                  }
                >
                  {m.message}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="border-t border-white/10 px-4 py-2 text-[13px] text-white">{error}</p>
      ) : null}

      {readOnly ? (
        <p className="border-t border-white/10 px-4 py-3 text-[13px] text-white/45">
          Chat is read-only for this game.
        </p>
      ) : (
        <form
          className="flex gap-2 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder="Type a message…"
            aria-label="Type a message"
            enterKeyHint="send"
            autoComplete="off"
            className="glass-input min-h-11 min-w-0 flex-1 !py-2.5 text-[14px]"
          />
          <PrimaryButton
            type="submit"
            disabled={busy || !draft.trim()}
            className="min-h-11 shrink-0 px-4"
            aria-label="Send message"
          >
            Send
          </PrimaryButton>
        </form>
      )}
    </div>
  )
}
