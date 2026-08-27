import { LoadingBlock } from '@/components/motion/LoadingBlock'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { toUserMessage } from '@/lib/errors'
import {
  listAdminReports,
  updateAdminReport,
  type AdminReportItem,
} from '@/services/admin'
import { useCallback, useEffect, useState } from 'react'

function ReportRow({
  item,
  onAction,
}: {
  item: AdminReportItem
  onAction: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function act(status: 'resolved' | 'dismissed' | 'reviewing') {
    setBusy(true)
    try {
      await updateAdminReport(item.id, status)
      onAction()
    } catch {
      // parent reload handles empty state; row stays
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] font-semibold text-white">{item.reason}</p>
        <span className="text-[11px] uppercase tracking-wide text-white/45">
          {item.status}
        </span>
      </div>
      {item.description ? (
        <p className="mt-2 text-[13px] text-white/55">{item.description}</p>
      ) : null}
      <p className="mt-2 text-[12px] text-white/40">
        {item.reporter_name} → {item.reported_user_name ?? 'entity'} ·{' '}
        {new Date(item.created_at).toLocaleString()}
      </p>
      {item.status === 'open' || item.status === 'reviewing' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton
            type="button"
            disabled={busy}
            onClick={() => void act('resolved')}
          >
            Resolve
          </PrimaryButton>
          <SecondaryButton
            type="button"
            disabled={busy}
            onClick={() => void act('dismissed')}
          >
            Dismiss
          </SecondaryButton>
          <SecondaryButton
            type="button"
            disabled={busy}
            onClick={() => void act('reviewing')}
          >
            Escalate
          </SecondaryButton>
        </div>
      ) : null}
    </div>
  )
}

export function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setReports(await listAdminReports())
    } catch (e) {
      setError(toUserMessage(e, "Couldn't load reports."))
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
        <p className="label-caps text-white/45">Moderation</p>
        <h1 className="display-lg mt-2">Reports</h1>
      </header>

      {error ? <p className="text-[13px] text-status-danger">{error}</p> : null}

      {reports.length ? (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportRow key={r.id} item={r} onAction={() => void reload()} />
          ))}
        </div>
      ) : (
        <EmptyState title="No reports" description="User reports will appear here." />
      )}
    </div>
  )
}
