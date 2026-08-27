import { LoadingBlock } from '@/components/motion/LoadingBlock'
import { EmptyState } from '@/components/ui/EmptyState'
import { toUserMessage } from '@/lib/errors'
import { listModerationActions, type ModerationActionItem } from '@/services/admin'
import { useEffect, useState } from 'react'

export function AdminActivityPage() {
  const [items, setItems] = useState<ModerationActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listModerationActions()
      .then(setItems)
      .catch((e) => setError(toUserMessage(e, "Couldn't load activity.")))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingBlock />

  return (
    <div className="space-y-6">
      <header>
        <p className="label-caps text-white/45">Audit</p>
        <h1 className="display-lg mt-2">Activity</h1>
      </header>

      {error ? <p className="text-[13px] text-status-danger">{error}</p> : null}

      {items.length ? (
        <div className="glass overflow-hidden rounded-xl">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Admin</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Entity</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/5 transition-colors hover:bg-white/5"
                >
                  <td className="px-4 py-3 text-white/55">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-white/70">{row.admin_name}</td>
                  <td className="px-4 py-3 text-white">{row.action}</td>
                  <td className="px-4 py-3 text-white/45">
                    {row.entity_type}:{row.entity_id.slice(0, 8)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No moderation activity yet"
          description="Admin actions will be logged here."
        />
      )}
    </div>
  )
}
