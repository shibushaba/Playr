import { cn } from '@/lib/format'
import { Icon } from '@/components/ui/Icon'
import { CallIcon } from '@/icons/actions'

interface Props {
  phone: string | null | undefined
  label?: string
  className?: string
  compact?: boolean
  iconOnly?: boolean
}

export function CallButton({
  phone,
  label = 'Call',
  className,
  compact,
  iconOnly,
}: Props) {
  if (!phone) return null

  const href = `tel:${phone.replace(/\s/g, '')}`

  if (iconOnly) {
    return (
      <a
        href={href}
        aria-label={label}
        className={cn(
          'motion-btn inline-flex items-center justify-center rounded-[8px] border border-white/15 bg-white/[0.04] text-white hover:border-white/30 hover:bg-white/[0.08]',
          'h-9 w-9 shrink-0',
          className,
        )}
      >
        <Icon icon={CallIcon} size={16} aria-hidden />
      </a>
    )
  }

  return (
    <a
      href={href}
      className={cn(
        'motion-btn inline-flex items-center gap-1.5 rounded-[8px] border border-white/15 bg-white/[0.04] text-[13px] font-semibold text-white hover:border-white/30 hover:bg-white/[0.08]',
        compact ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2',
        className,
      )}
    >
      <Icon icon={CallIcon} size={14} className="shrink-0" aria-hidden />
      {label}
    </a>
  )
}
