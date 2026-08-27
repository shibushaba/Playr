import { usePwaInstall } from '@/contexts/PwaInstallContext'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { OverlaySheet } from '@/components/ui/OverlaySheet'
import { Download } from 'lucide-react'
import { useState } from 'react'

export function InstallPrompt() {
  const { promptOpen, iosHint, skipPrompt, install, closePrompt } = usePwaInstall()
  const [busy, setBusy] = useState(false)

  if (!promptOpen) return null

  async function onDownload() {
    setBusy(true)
    try {
      await install()
    } finally {
      setBusy(false)
    }
  }

  function onSkip() {
    skipPrompt()
  }

  return (
    <OverlaySheet onClose={onSkip} closeLabel="Skip install" lockScroll>
      <div className="space-y-5 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-white">
            <Download className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-white">
              Get PLAYR on your phone
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-white/55">
              Install the app for quicker access — no browser tabs, opens like a
              real app.
            </p>
          </div>
        </div>

        {iosHint ? (
          <div className="glass space-y-2 p-4 text-[13px] leading-relaxed text-white/65">
            <p className="font-medium text-white">On iPhone or iPad:</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Tap the Share button in Safari</li>
              <li>Choose <span className="text-white">Add to Home Screen</span></li>
              <li>Tap Add</li>
            </ol>
          </div>
        ) : null}

        <div className="flex gap-2">
          <SecondaryButton fullWidth onClick={onSkip}>
            Not now
          </SecondaryButton>
          <PrimaryButton fullWidth disabled={busy} onClick={() => void onDownload()}>
            {iosHint ? 'How to install' : busy ? 'Opening…' : 'Download app'}
          </PrimaryButton>
        </div>

        <button
          type="button"
          className="w-full text-center text-[12px] text-white/40 transition hover:text-white/60"
          onClick={() => {
            closePrompt()
            skipPrompt()
          }}
        >
          Continue in browser
        </button>
      </div>
    </OverlaySheet>
  )
}
