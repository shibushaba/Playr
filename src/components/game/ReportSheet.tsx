import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { toUserMessage } from '@/lib/errors'
import {
  REPORT_REASONS,
  blockUser,
  createReport,
  type ReportReason,
} from '@/services/reports'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  gameId?: string | null
  venueId?: string | null
  reportedUserId?: string | null
  messageId?: string | null
  allowBlock?: boolean
}

export function ReportSheet({
  open,
  onClose,
  title,
  gameId,
  venueId,
  reportedUserId,
  messageId,
  allowBlock,
}: Props) {
  const [reason, setReason] = useState<ReportReason>('other')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDone(false)
    setError(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await createReport({
        reason,
        description: description.trim() || undefined,
        gameId,
        venueId,
        reportedUserId,
        messageId,
      })
      setDone(true)
    } catch (e) {
      setError(toUserMessage(e, "Couldn't submit report."))
    } finally {
      setBusy(false)
    }
  }

  async function blockAndClose() {
    if (!reportedUserId) return
    setBusy(true)
    try {
      await blockUser(reportedUserId)
      if (!done) {
        await createReport({
          reason: 'harassment',
          description: 'Blocked user',
          reportedUserId,
          gameId,
        })
      }
      onClose()
    } catch (e) {
      setError(toUserMessage(e, "Couldn't block user."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 animate-fade-in sheet-scrim"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="glass-overlay relative z-10 max-h-[85dvh] w-full max-w-lg overflow-y-auto animate-fade-up p-5 sm:rounded-[8px]">
        <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-[18px] font-semibold tracking-tight text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="glass flex h-10 w-10 items-center justify-center text-white/70 transition hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="space-y-4">
            <p className="text-[14px] leading-relaxed text-white/45">
              Thanks — we received your report. PLAYR will review it.
            </p>
            {allowBlock && reportedUserId ? (
              <SecondaryButton fullWidth disabled={busy} onClick={() => void blockAndClose()}>
                Also block this player
              </SecondaryButton>
            ) : null}
            <PrimaryButton fullWidth onClick={onClose}>
              Done
            </PrimaryButton>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="label-caps mb-3">Reason</p>
              <div className="flex flex-wrap gap-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={
                      reason === r
                        ? 'min-h-9 rounded-[8px] border border-white/30 bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-cta'
                        : 'min-h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/70 transition hover:border-white/20'
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional details"
              className="glass-input min-h-24 w-full py-2 text-[14px]"
            />
            {error ? (
              <p className="glass px-3 py-2 text-[13px] text-white">
                {error}
              </p>
            ) : null}
            <PrimaryButton fullWidth disabled={busy} onClick={() => void submit()}>
              {busy ? 'Sending…' : 'Submit report'}
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  )
}
