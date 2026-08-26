import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { toUserMessage } from '@/lib/errors'
import {
  listGameMessages,
  sendGameMessage,
  subscribeGameMessages,
  type GameMessage,
} from '@/services/chat'
import { Flag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  gameId: string
  currentUserId: string | undefined
  readOnly: boolean
  onReportMessage: (messageId: string, senderId: string) => void
}

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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listGameMessages(gameId)
      .then((list) => {
        if (!cancelled) setMessages(list)
      })
      .catch((e) => {
        if (!cancelled) setError(toUserMessage(e, "Couldn't load chat."))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const unsub = subscribeGameMessages(gameId, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      void listGameMessages(gameId)
        .then((list) => {
          if (!cancelled) setMessages(list)
        })
        .catch(() => undefined)
    })

    const poll = window.setInterval(() => {
      void listGameMessages(gameId)
        .then((list) => {
          if (!cancelled) setMessages(list)
        })
        .catch(() => undefined)
    }, 12_000)

    return () => {
      cancelled = true
      unsub()
      window.clearInterval(poll)
    }
  }, [gameId])

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
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
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
        <p className="label-caps">Chat</p>
      </div>

      <div className="max-h-72 flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-2 py-4">
            <div className="glass h-8 w-2/3 animate-pulse" />
            <div className="glass ml-auto h-8 w-1/2 animate-pulse" />
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
              <div key={m.id} className={mine ? 'text-right' : 'text-left'}>
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
                      <Flag className="h-3 w-3" />
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
