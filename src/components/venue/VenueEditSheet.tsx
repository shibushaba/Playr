import { StatusTransition } from '@/components/motion/StatusTransition'
import { OverlaySheet } from '@/components/ui/OverlaySheet'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { toUserMessage } from '@/lib/errors'
import { submitVenueEditRequest, type VenueEditChanges } from '@/services/community'
import type { VenueRecord } from '@/types/domain'
import { useEffect, useState } from 'react'

interface Props {
  open: boolean
  venue: VenueRecord
  onClose: () => void
  onSubmitted: () => void
}

export function VenueEditSheet({ open, venue, onClose, onSubmitted }: Props) {
  const [name, setName] = useState(venue.name)
  const [address, setAddress] = useState(venue.address ?? '')
  const [phone, setPhone] = useState(venue.phone ?? '')
  const [description, setDescription] = useState(venue.description ?? '')
  const [mapUrl, setMapUrl] = useState(venue.mapUrl ?? '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(venue.name)
    setAddress(venue.address ?? '')
    setPhone(venue.phone ?? '')
    setDescription(venue.description ?? '')
    setMapUrl(venue.mapUrl ?? '')
    setReason('')
    setDone(false)
    setError(null)
  }, [open, venue])

  if (!open) return null

  async function submit() {
    const changes: VenueEditChanges = {}
    if (name.trim() && name.trim() !== venue.name) changes.name = name.trim()
    if (address.trim() !== (venue.address ?? '')) changes.address = address.trim()
    if (description.trim() !== (venue.description ?? '')) {
      changes.description = description.trim()
    }
    if (mapUrl.trim() && mapUrl.trim() !== (venue.mapUrl ?? '')) {
      changes.map_url = mapUrl.trim()
    }
    if (phone.trim() && phone.trim() !== (venue.phone ?? '')) changes.phone = phone.trim()

    if (Object.keys(changes).length === 0) {
      setError('Change at least one field.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await submitVenueEditRequest({
        venueId: venue.id,
        proposedChanges: changes,
        reason: reason.trim() || undefined,
      })
      setDone(true)
      onSubmitted()
    } catch (e) {
      setError(toUserMessage(e, "Couldn't submit your edit."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <OverlaySheet onClose={onClose} lockScroll>
      <StatusTransition phaseKey={done ? 'done' : 'form'}>
        <div className="space-y-4 p-5">
          <div>
            <p className="label-caps text-white/45">Edit venue</p>
            <h2 className="display-md mt-2">{venue.name}</h2>
            <p className="mt-2 text-[13px] text-white/55">
              Changes will be reviewed by PLAYR before appearing publicly.
            </p>
          </div>

          {done ? (
            <div className="glass rounded-xl p-4">
              <p className="text-[13px] font-semibold text-status-success">
                ✓ Edit submitted
              </p>
              <p className="mt-2 text-[13px] text-white/55">
                We&apos;ll notify you when your changes are reviewed.
              </p>
              <PrimaryButton className="mt-4" type="button" onClick={onClose}>
                Done
              </PrimaryButton>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="label-caps">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[14px] text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="label-caps">Address</span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[14px] text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="label-caps">Phone (if changing)</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Current number"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[14px] text-white outline-none placeholder:text-white/35"
                />
              </label>
              <label className="block">
                <span className="label-caps">Map URL</span>
                <input
                  value={mapUrl}
                  onChange={(e) => setMapUrl(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[14px] text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="label-caps">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[14px] text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="label-caps">Why these changes?</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Optional context for reviewers"
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[14px] text-white outline-none placeholder:text-white/35"
                />
              </label>

              {error ? <p className="text-[12px] text-status-danger">{error}</p> : null}

              <div className="flex gap-2 pt-2">
                <PrimaryButton
                  type="button"
                  fullWidth
                  disabled={busy}
                  onClick={() => void submit()}
                >
                  Submit for review
                </PrimaryButton>
                <SecondaryButton type="button" disabled={busy} onClick={onClose}>
                  Cancel
                </SecondaryButton>
              </div>
            </>
          )}
        </div>
      </StatusTransition>
    </OverlaySheet>
  )
}
