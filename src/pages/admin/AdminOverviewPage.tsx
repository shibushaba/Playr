import { LoadingBlock } from '@/components/motion/LoadingBlock'
import { EmptyState } from '@/components/ui/EmptyState'
import { toUserMessage } from '@/lib/errors'
import { getAdminOverview, type AdminOverview } from '@/services/admin'
import { useEffect, useState } from 'react'

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string
  value: number | string
  suffix?: string
}) {
  return (
    <div className="glass rounded-xl p-4">
      <p className="label-caps text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
        {value}
        {suffix ? (
          <span className="ml-1 text-sm font-medium text-white/45">{suffix}</span>
        ) : null}
      </p>
    </div>
  )
}

export function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void getAdminOverview()
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch((e) => {
        if (!cancelled) setError(toUserMessage(e, "Couldn't load overview."))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <LoadingBlock />
  if (error || !stats) {
    return (
      <EmptyState title="Overview unavailable" description={error ?? undefined} />
    )
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="label-caps text-white/45">Dashboard</p>
        <h1 className="display-lg mt-2">Overview</h1>
        <p className="mt-2 text-[14px] text-white/45">
          Live metrics from PLAYR (Asia/Kolkata day boundaries for games).
        </p>
      </header>

      <section>
        <h2 className="section-label mb-4">Games</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Today" value={stats.games_today} />
          <StatCard label="This week" value={stats.games_this_week} />
          <StatCard label="Completed" value={stats.completed_games} />
          <StatCard label="Cancelled" value={stats.cancelled_games} />
        </div>
      </section>

      <section>
        <h2 className="section-label mb-4">Community & moderation</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Players" value={stats.players} />
          <StatCard label="New users (7d)" value={stats.new_users_7d ?? 0} />
          <StatCard label="Active users (7d)" value={stats.active_users_7d ?? 0} />
          <StatCard label="Venues" value={stats.venues_total} />
          <StatCard label="Verified venues" value={stats.venues_verified} />
          <StatCard label="Community venues" value={stats.venues_community} />
          <StatCard label="Pending reviews" value={stats.pending_venue_reviews} />
          <StatCard label="Pending edits" value={stats.pending_edit_requests} />
          <StatCard label="Open reports" value={stats.open_reports} />
          <StatCard label="Game feedback" value={stats.feedback_count} />
          <StatCard
            label="Avg fill (7d)"
            value={
              stats.avg_fill_rate_7d == null
                ? '—'
                : Math.round(stats.avg_fill_rate_7d * 100)
            }
            suffix={stats.avg_fill_rate_7d == null ? undefined : '%'}
          />
        </div>
      </section>
    </div>
  )
}
