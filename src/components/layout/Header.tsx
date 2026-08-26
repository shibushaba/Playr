import { GlassChromeBar } from '@/components/ui/GlassChromeBar'
import { cn } from '@/lib/format'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  title?: string
  subtitle?: string
  backTo?: string
  onBack?: () => void
  right?: ReactNode
  className?: string
  transparent?: boolean
}

export function Header({
  title,
  subtitle,
  backTo,
  onBack,
  right,
  className,
  transparent,
}: Props) {
  const barClassName = 'relative px-3 py-2.5 sm:px-4 sm:py-3'

  const content = (
    <div className="flex items-center gap-3">
      {backTo || onBack ? (
        backTo ? (
          <Link
            to={backTo}
            className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.04] backdrop-blur-glass text-white transition hover:border-white/25 hover:bg-white/[0.08]"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.04] backdrop-blur-glass text-white transition hover:border-white/25 hover:bg-white/[0.08]"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )
      ) : null}

      <div className="min-w-0 flex-1">
        {title ? (
          <h1 className="truncate font-[family-name:var(--font-display)] text-[14px] font-semibold uppercase tracking-[0.12em] text-white">
            {title}
          </h1>
        ) : null}
        {subtitle ? (
          <p className="truncate text-[12px] text-white/45">{subtitle}</p>
        ) : null}
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  )

  return (
    <header
      className={cn(
        'sticky top-0 z-50 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]',
        className,
      )}
    >
      {transparent ? (
        <div className={barClassName}>{content}</div>
      ) : (
        <GlassChromeBar className={barClassName}>{content}</GlassChromeBar>
      )}
    </header>
  )
}
