import { cn } from '@/lib/format'
import { Phone } from 'lucide-react'
import { useState } from 'react'

interface Props {
  phone: string | null | undefined
  label?: string
  className?: string
  compact?: boolean
}

export function CallButton({
  phone,
  label = 'Call',
  className,
  compact,
}: Props) {
  const [revealed, setRevealed] = useState(false)
  if (!phone) return null

  const href = `tel:${phone.replace(/\s/g, '')}`
  const isTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)

  const base =
    'inline-flex items-center gap-1.5 rounded-[8px] border border-white/15 bg-white/[0.04] text-[13px] font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.08]'

  if (!isTouch && revealed) {
    return (
      <a href={href} className={cn(base, 'px-3 py-2', className)}>
        <Phone className="h-3.5 w-3.5" />
        {phone}
      </a>
    )
  }

  if (!isTouch) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className={cn(
          base,
          compact ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2',
          className,
        )}
      >
        <Phone className="h-3.5 w-3.5" />
        {label}
      </button>
    )
  }

  return (
    <a
      href={href}
      className={cn(
        base,
        compact ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2',
        className,
      )}
    >
      <Phone className="h-3.5 w-3.5" />
      {label}
    </a>
  )
}
