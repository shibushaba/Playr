import { GlassPanel } from '@/components/ui/GlassPanel'
import { GlassScrim } from '@/components/ui/GlassScrim'
import { cn } from '@/lib/format'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  onClose: () => void
  closeLabel?: string
  children: ReactNode
  panelClassName?: string
  scrimClassName?: string
  lockScroll?: boolean
}

export function OverlaySheet({
  onClose,
  closeLabel = 'Close',
  children,
  panelClassName,
  scrimClassName,
  lockScroll = false,
}: Props) {
  useEffect(() => {
    if (!lockScroll) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [lockScroll])

  const content = (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <GlassScrim
        aria-label={closeLabel}
        className={cn('animate-fade-in', scrimClassName)}
        onClick={onClose}
      />
      <GlassPanel
        className={cn(
          'z-10 w-full max-w-lg animate-fade-up sm:rounded-[12px]',
          panelClassName,
        )}
      >
        {children}
      </GlassPanel>
    </div>
  )

  return typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : content
}
