import { usePwaInstall } from '@/contexts/PwaInstallContext'
import { cn } from '@/lib/format'
import { Download } from 'lucide-react'

export function FloatingInstallButton() {
  const { canInstall, isStandalone, openPrompt } = usePwaInstall()

  if (isStandalone || !canInstall) return null

  return (
    <button
      type="button"
      className={cn(
        'motion-btn fixed z-[90] flex items-center gap-2 rounded-full border border-white/15',
        'bg-bg-3/95 px-3.5 py-2.5 text-[12px] font-semibold text-white shadow-lift backdrop-blur-md',
        'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-3 lg:bottom-6 lg:right-6',
        'hover:bg-bg-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/35',
      )}
      onClick={openPrompt}
      aria-label="Download PLAYR app"
    >
      <Download className="h-4 w-4 shrink-0" aria-hidden />
      <span>Download app</span>
    </button>
  )
}
