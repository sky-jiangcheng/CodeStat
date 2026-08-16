import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

// --- Shared module-level install-prompt capture -----------------------------
//
// beforeinstallprompt fires once per page load, so the event must be captured
// in exactly one place. Both the App-level toast and the Settings page hook
// consume this shared state.

let sharedPrompt: BeforeInstallPromptEvent | null = null
let sharedInstalled = window.matchMedia?.('(display-mode: standalone)').matches ?? false
const promptListeners = new Set<(e: BeforeInstallPromptEvent | null) => void>()
const installedListeners = new Set<(installed: boolean) => void>()

function notifyPrompt() { promptListeners.forEach(l => l(sharedPrompt)) }
function notifyInstalled() { installedListeners.forEach(l => l(sharedInstalled)) }

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    sharedPrompt = e as BeforeInstallPromptEvent
    notifyPrompt()
  })
  window.addEventListener('appinstalled', () => {
    sharedInstalled = true
    sharedPrompt = null
    notifyPrompt()
    notifyInstalled()
  })
}

/**
 * Subscribes to the shared install-prompt state. Returns an unsubscribe
 * function. Used by the App-level install toast.
 */
export function onInstallPrompt(cb: (e: BeforeInstallPromptEvent | null) => void): () => void {
  promptListeners.add(cb)
  cb(sharedPrompt)
  return () => promptListeners.delete(cb)
}

/** Consumes the shared deferred prompt (shows the browser install dialog). */
export async function consumeInstallPrompt(): Promise<void> {
  if (!sharedPrompt) return
  await sharedPrompt.prompt()
  try { await sharedPrompt.userChoice } catch { /* ignore */ }
  sharedPrompt = null
  notifyPrompt()
}

// --- React hook (Settings page) -----------------------------------------------

/**
 * Tracks the browser install prompt so the UI can offer a custom
 * "install to desktop" button instead of relying on the browser's default
 * affordance (issue #14).
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(sharedPrompt)
  const [installed, setInstalled] = useState(sharedInstalled)

  useEffect(() => {
    const offPrompt = onInstallPrompt(setDeferredPrompt)
    const onInstalledChange = (v: boolean) => setInstalled(v)
    installedListeners.add(onInstalledChange)
    return () => { offPrompt(); installedListeners.delete(onInstalledChange) }
  }, [])

  const promptInstall = useCallback(async () => {
    await consumeInstallPrompt()
  }, [])

  return { canInstall: deferredPrompt !== null, installed, promptInstall }
}
