import { StatusTransition } from '@/components/motion/StatusTransition'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/format'
import {
  getGameFeedbackState,
  submitGameExperienceFeedback,
  type GameFeedbackState,
} from '@/services/community'
import { useEffect, useState } from 'react'

const TAGS = [
  'Great game',
  'Good organization',
  'Venue was good',
  'Players were friendly',
  'Game started late',
  'Poor venue',
  'Host communication issue',
]

interface Props {
  gameId: string
}

export function GameFeedbackCard({ gameId }: Props) {
  const [state, setState] = useState<GameFeedbackState | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getGameFeedbackState(gameId).then((s) => {
      if (cancelled) return
      setState(s)
      if (s.submitted && s.rating) {
        setRating(s.rating)
        setComment(s.comment ?? '')
        setDone(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [gameId])

  if (!state?.eligible || dismissed) return null
  if (state.submitted && done) {
    return (
      <div className="glass p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-status-success">
          ✓ Thank you
        </p>
        <p className="mt-2 text-[13px] text-white/55">
          Your feedback helps improve PLAYR.
        </p>
      </div>
    )
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  async function submit() {
    if (rating < 1) {
      setError('Choose a star rating.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await submitGameExperienceFeedback({
        gameId,
        rating,
        comment: comment.trim() || undefined,
        tags: selectedTags,
      })
      setDone(true)
    } catch (e) {
      setError(toUserMessage(e, "Couldn't submit feedback."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <StatusTransition phaseKey="feedback">
      <div className="glass p-4">
        <p className="label-caps text-white/45">Optional</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-[20px] font-semibold text-white">
          How was the game?
        </h2>

        <div className="mt-4 flex gap-1" role="group" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
              disabled={busy || done}
              onClick={() => setRating(star)}
              className={cn(
                'motion-press rounded p-1 text-2xl transition-all',
                star <= rating
                  ? 'scale-100 text-status-success opacity-100'
                  : 'scale-95 text-white/25 opacity-70 hover:opacity-90',
              )}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us about your experience…"
          rows={3}
          disabled={busy || done}
          className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[14px] text-white outline-none placeholder:text-white/35"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={busy || done}
              onClick={() => toggleTag(tag)}
              className={cn(
                'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
                selectedTags.includes(tag)
                  ? 'bg-status-success/15 text-status-success'
                  : 'bg-white/5 text-white/55 hover:bg-white/10',
              )}
            >
              {tag}
            </button>
          ))}
        </div>

        {error ? <p className="mt-3 text-[12px] text-status-danger">{error}</p> : null}

        <div className="mt-4 flex gap-2">
          <PrimaryButton
            type="button"
            fullWidth
            disabled={busy || done}
            onClick={() => void submit()}
          >
            {busy ? 'Submitting…' : 'Submit feedback'}
          </PrimaryButton>
          <SecondaryButton type="button" disabled={busy} onClick={() => setDismissed(true)}>
            Skip
          </SecondaryButton>
        </div>
      </div>
    </StatusTransition>
  )
}
