import { LoadingBlock } from '@/components/motion/LoadingBlock'
import { EmptyState } from '@/components/ui/EmptyState'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { toUserMessage } from '@/lib/errors'
import {
  hideGameFeedback,
  listAdminGameFeedback,
  type AdminFeedbackItem,
} from '@/services/admin'
import { useCallback, useEffect, useState } from 'react'

function FeedbackRow({
  item,
  onAction,
}: {
  item: AdminFeedbackItem
  onAction: () => void
}) {
  const [busy, setBusy] = useState(false)

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] font-semibold text-white">
          {'★'.repeat(item.overall_rating)}
          <span className="sr-only">{item.overall_rating} stars</span>
        </p>
        {item.is_hidden ? (
          <span className="text-[11px] uppercase text-white/40">Hidden</span>
        ) : null}
      </div>
      <p className="mt-1 text-[13px] text-white/55">{item.game_title}</p>
      {item.comment ? (
        <p className="mt-2 text-[13px] text-white/70">{item.comment}</p>
      ) : null}
      <p className="mt-2 text-[12px] text-white/40">
        {item.author_name} · {new Date(item.created_at).toLocaleString()}
      </p>
      {!item.is_hidden ? (
        <SecondaryButton
          type="button"
          className="mt-4"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void hideGameFeedback(item.id)
              .then(onAction)
              .finally(() => setBusy(false))
          }}
        >
          Hide
        </SecondaryButton>
      ) : null}
    </div>
  )
}

export function AdminFeedbackPage() {
  const [items, setItems] = useState<AdminFeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await listAdminGameFeedback())
    } catch (e) {
      setError(toUserMessage(e, "Couldn't load feedback."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  if (loading) return <LoadingBlock />

  return (
    <div className="space-y-6">
      <header>
        <p className="label-caps text-white/45">Post-game</p>
        <h1 className="display-lg mt-2">Feedback</h1>
        <p className="mt-2 text-[14px] text-white/45">
          Individual comments are admin-only. Public venue scores use aggregates.
        </p>
      </header>

      {error ? <p className="text-[13px] text-status-danger">{error}</p> : null}

      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <FeedbackRow key={item.id} item={item} onAction={() => void reload()} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No game feedback yet"
          description="Player feedback after completed games will appear here."
        />
      )}
    </div>
  )
}
