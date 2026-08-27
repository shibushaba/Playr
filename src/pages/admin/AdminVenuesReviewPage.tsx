import { LoadingBlock } from '@/components/motion/LoadingBlock'
import { StatusTransition } from '@/components/motion/StatusTransition'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { toUserMessage } from '@/lib/errors'
import {
  approveVenueEdit,
  archiveVenue,
  listVenueEditRequests,
  listVenueReviewQueue,
  rejectVenue,
  rejectVenueEdit,
  requestVenueEditInfo,
  verifyVenue,
  type VenueEditRequestItem,
  type VenueReviewItem,
} from '@/services/admin'
import { useCallback, useEffect, useState } from 'react'

function VenueReviewRow({
  item,
  onAction,
}: {
  item: VenueReviewItem
  onAction: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onAction()
    } catch (e) {
      setError(toUserMessage(e, 'Action failed. Refresh and try again.'))
    } finally {
      setBusy(false)
    }
  }

  const sports = Array.isArray(item.sports) ? (item.sports as string[]).join(', ') : ''

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-white">{item.name}</h3>
          <p className="mt-1 text-[13px] text-white/45">
            {[item.address, item.city, item.state].filter(Boolean).join(', ')}
          </p>
          <p className="mt-2 text-[12px] text-white/40">
            By {item.submitter_name ?? 'Unknown'} ·{' '}
            {new Date(item.created_at).toLocaleDateString()}
          </p>
          {sports ? (
            <p className="mt-1 text-[12px] text-white/55">{sports}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-warning">
          Community added
        </span>
      </div>

      {item.nearby_venues?.length ? (
        <div className="mt-4 rounded-lg bg-white/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-status-warning">
            Possible duplicates nearby
          </p>
          <ul className="mt-2 space-y-1 text-[12px] text-white/55">
            {item.nearby_venues.map((n) => (
              <li key={n.id}>
                {n.name} · {n.distance_meters}m · {n.status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <PrimaryButton
          type="button"
          disabled={busy}
          onClick={() => void act(() => verifyVenue(item.id))}
        >
          Verify
        </PrimaryButton>
        <SecondaryButton
          type="button"
          disabled={busy}
          onClick={() => void act(() => rejectVenue(item.id))}
        >
          Reject
        </SecondaryButton>
        <SecondaryButton
          type="button"
          disabled={busy}
          onClick={() => void act(() => archiveVenue(item.id))}
        >
          Archive
        </SecondaryButton>
      </div>
      {error ? <p className="mt-2 text-[12px] text-status-danger">{error}</p> : null}
    </div>
  )
}

function currentVenueField(item: VenueEditRequestItem, key: string): unknown {
  const map: Record<string, unknown> = {
    name: item.venue_name,
    address: item.venue_address,
    phone: item.venue_phone,
    sports: item.venue_sports,
    map_url: item.venue_map_url,
    description: item.venue_description,
    latitude: item.venue_latitude,
    longitude: item.venue_longitude,
  }
  return map[key]
}

function EditRequestRow({
  item,
  onAction,
}: {
  item: VenueEditRequestItem
  onAction: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changes = item.proposed_changes ?? {}

  async function act(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onAction()
    } catch (e) {
      setError(toUserMessage(e, 'Action failed. Refresh and try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass rounded-xl p-4">
      <h3 className="text-[15px] font-semibold text-white">{item.venue_name}</h3>
      <p className="mt-1 text-[12px] text-white/45">
        {item.submitter_name} · {new Date(item.created_at).toLocaleDateString()}
      </p>
      {item.reason ? (
        <p className="mt-2 text-[13px] text-white/55">{item.reason}</p>
      ) : null}

      <div className="mt-4 space-y-2">
        {Object.entries(changes).map(([key, proposed]) => {
          const current = currentVenueField(item, key)
          return (
            <div key={key} className="rounded-lg bg-white/5 p-3 text-[12px]">
              <p className="font-semibold uppercase tracking-wide text-white/45">{key}</p>
              <p className="mt-1 text-white/55">
                <span className="text-white/35">Current:</span>{' '}
                {String(current ?? '—')}
              </p>
              <p className="mt-1 text-white/80">
                <span className="text-white/35">Proposed:</span>{' '}
                {typeof proposed === 'object'
                  ? JSON.stringify(proposed)
                  : String(proposed)}
              </p>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <PrimaryButton
          type="button"
          disabled={busy}
          onClick={() => void act(() => approveVenueEdit(item.id))}
        >
          Approve changes
        </PrimaryButton>
        <SecondaryButton
          type="button"
          disabled={busy}
          onClick={() => void act(() => rejectVenueEdit(item.id))}
        >
          Reject
        </SecondaryButton>
        <SecondaryButton
          type="button"
          disabled={busy}
          onClick={() =>
            void act(() =>
              requestVenueEditInfo(
                item.id,
                'Please provide clearer details and resubmit.',
              ),
            )
          }
        >
          Request info
        </SecondaryButton>
      </div>
      {error ? <p className="mt-2 text-[12px] text-status-danger">{error}</p> : null}
    </div>
  )
}

export function AdminVenuesReviewPage() {
  const [queue, setQueue] = useState<VenueReviewItem[]>([])
  const [edits, setEdits] = useState<VenueEditRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [q, e] = await Promise.all([
        listVenueReviewQueue(),
        listVenueEditRequests('pending'),
      ])
      setQueue(q)
      setEdits(e)
    } catch (err) {
      setError(toUserMessage(err, "Couldn't load venues."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  if (loading) return <LoadingBlock />

  return (
    <div className="space-y-10">
      <header>
        <p className="label-caps text-white/45">Verification</p>
        <h1 className="display-lg mt-2">Venues</h1>
      </header>

      {error ? (
        <p className="text-[13px] text-status-danger">{error}</p>
      ) : null}

      <section>
        <h2 className="section-label mb-4">Review queue</h2>
        <StatusTransition phaseKey={`queue-${queue.length}`}>
          {queue.length ? (
            <div className="space-y-3">
              {queue.map((item) => (
                <VenueReviewRow key={item.id} item={item} onAction={() => void reload()} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No pending venue reviews"
              description="Community-added venues awaiting verification will appear here."
            />
          )}
        </StatusTransition>
      </section>

      <section>
        <h2 className="section-label mb-4">Edit requests</h2>
        <StatusTransition phaseKey={`edits-${edits.length}`}>
          {edits.length ? (
            <div className="space-y-3">
              {edits.map((item) => (
                <EditRequestRow key={item.id} item={item} onAction={() => void reload()} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No pending edits"
              description="Proposed venue changes will appear here for review."
            />
          )}
        </StatusTransition>
      </section>
    </div>
  )
}
