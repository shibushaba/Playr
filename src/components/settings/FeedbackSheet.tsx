import { StatusTransition } from '@/components/motion/StatusTransition'
import { OverlaySheet } from '@/components/ui/OverlaySheet'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { toUserMessage } from '@/lib/errors'
import {
  submitAppFeedback,
  submitAppFeedbackDirect,
  type FeedbackKind,
} from '@/services/feedback'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

interface Props {
  open: boolean
  onClose: () => void
}

export function FeedbackSheet({ open, onClose }: Props) {
  const location = useLocation()
  const [kind, setKind] = useState<FeedbackKind>('feedback')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDone(false)
    setError(null)
    setMessage('')
    setKind('feedback')
  }, [open])

  if (!open) return null

  async function submit() {
    const trimmed = message.trim()
    if (trimmed.length < 3) {
      setError('Write at least a few words.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      try {
        await submitAppFeedback({
          kind,
          message: trimmed,
          pagePath: location.pathname,
        })
      } catch {
        await submitAppFeedbackDirect({
          kind,
          message: trimmed,
          pagePath: location.pathname,
        })
      }
      setDone(true)
    } catch (e) {
      setError(toUserMessage(e, "Couldn't send your message."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <OverlaySheet onClose={onClose} closeLabel="Close feedback" lockScroll>
      <div className="space-y-5 p-5">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-white">
            Feedback & suggestions
          </h2>
          <p className="mt-1.5 text-[14px] text-white/55">
            Tell us what&apos;s working, what&apos;s broken, or what you&apos;d love
            to see next.
          </p>
        </div>

        {done ? (
          <StatusTransition phaseKey="sent">
            <p className="text-[14px] text-status-success">
              Thanks — we saved your message.
            </p>
            <PrimaryButton fullWidth className="mt-4" onClick={onClose}>
              Done
            </PrimaryButton>
          </StatusTransition>
        ) : (
          <>
            <div className="flex gap-2">
              <KindChip
                active={kind === 'feedback'}
                label="Feedback"
                onClick={() => setKind('feedback')}
              />
              <KindChip
                active={kind === 'suggestion'}
                label="Suggestion"
                onClick={() => setKind('suggestion')}
              />
            </div>

            <label className="block">
              <span className="label-caps mb-2 block">Your message</span>
              <textarea
                className="glass-input min-h-[120px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What should we know?"
                maxLength={2000}
              />
            </label>

            {error ? (
              <p className="glass motion-error-in px-3 py-2 text-[13px] text-white">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2">
              <SecondaryButton fullWidth disabled={busy} onClick={onClose}>
                Cancel
              </SecondaryButton>
              <PrimaryButton
                fullWidth
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? 'Sending…' : 'Send'}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </OverlaySheet>
  )
}

function KindChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={
        active
          ? 'motion-chip rounded-full border border-white/20 bg-white/12 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-white'
          : 'motion-chip rounded-full border border-white/10 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/45'
      }
      onClick={onClick}
    >
      {label}
    </button>
  )
}
