import {
  canShowIosInstallHint,
  isBeforeInstallPromptEvent,
  isStandaloneDisplay,
  markPwaInstalled,
  markPwaPromptDismissed,
  shouldShowPwaPrompt,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface PwaInstallContextValue {
  canInstall: boolean
  isStandalone: boolean
  iosHint: boolean
  promptOpen: boolean
  openPrompt: () => void
  closePrompt: () => void
  install: () => Promise<boolean>
  skipPrompt: () => void
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null)

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [iosHint, setIosHint] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)

  useEffect(() => {
    const standalone = isStandaloneDisplay()
    setIsStandalone(standalone)
    setIosHint(canShowIosInstallHint())

    if (standalone) {
      markPwaInstalled()
      return
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      if (isBeforeInstallPromptEvent(event)) {
        setDeferredPrompt(event)
      }
    }

    const onInstalled = () => {
      setDeferredPrompt(null)
      setIsStandalone(true)
      markPwaInstalled()
      setPromptOpen(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    if (isStandalone) return
    const canOffer = Boolean(deferredPrompt) || iosHint
    if (!canOffer) return
    if (!shouldShowPwaPrompt()) return

    const timer = window.setTimeout(() => setPromptOpen(true), 1200)
    return () => window.clearTimeout(timer)
  }, [deferredPrompt, iosHint, isStandalone])

  const install = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        markPwaInstalled()
        setDeferredPrompt(null)
        setPromptOpen(false)
        return true
      }
      return false
    }

    if (iosHint) {
      setPromptOpen(true)
      return false
    }

    return false
  }, [deferredPrompt, iosHint])

  const skipPrompt = useCallback(() => {
    markPwaPromptDismissed()
    setPromptOpen(false)
  }, [])

  const value = useMemo(
    () => ({
      canInstall: Boolean(deferredPrompt) || iosHint,
      isStandalone,
      iosHint,
      promptOpen,
      openPrompt: () => setPromptOpen(true),
      closePrompt: () => setPromptOpen(false),
      install,
      skipPrompt,
    }),
    [deferredPrompt, iosHint, isStandalone, promptOpen, install, skipPrompt],
  )

  return (
    <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>
  )
}

export function usePwaInstall(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext)
  if (!ctx) {
    throw new Error('usePwaInstall must be used within PwaInstallProvider')
  }
  return ctx
}
