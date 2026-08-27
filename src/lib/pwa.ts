const DISMISS_KEY = 'playr-pwa-prompt-dismissed'
const INSTALLED_KEY = 'playr-pwa-installed'
const PROMPT_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function canShowIosInstallHint(): boolean {
  return isIosDevice() && !isStandaloneDisplay()
}

export function markPwaInstalled(): void {
  try {
    localStorage.setItem(INSTALLED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function markPwaPromptDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

export function shouldShowPwaPrompt(): boolean {
  if (typeof window === 'undefined') return false
  if (isStandaloneDisplay()) return false

  try {
    if (localStorage.getItem(INSTALLED_KEY) === '1') return false
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (!dismissedAt) return true
    const elapsed = Date.now() - Number(dismissedAt)
    return !Number.isFinite(elapsed) || elapsed >= PROMPT_INTERVAL_MS
  } catch {
    return true
  }
}

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function isBeforeInstallPromptEvent(
  event: Event,
): event is BeforeInstallPromptEvent {
  return 'prompt' in event && typeof (event as BeforeInstallPromptEvent).prompt === 'function'
}
