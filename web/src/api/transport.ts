// api/transport.ts — Dual-mode transport:
//   - Inside the Wails webview, invokes Go methods via window.go.main.App
//   - Standalone (npm run dev in a plain browser), falls back to HTTP fetch

import type { ImportCompletedEvent } from './types'

interface WailsApp {
  [method: string]: (...args: unknown[]) => Promise<unknown>
}

interface WailsGlobal {
  go?: {
    main?: {
      App?: WailsApp
    }
  }
}

const isWails = (): boolean => {
  if (typeof window === 'undefined') return false
  const w = window as unknown as WailsGlobal
  return !!w.go?.main?.App
}

function wail<T>(method: string, ...args: unknown[]): Promise<T> {
  const w = window as unknown as WailsGlobal
  const app = w.go!.main!.App!
  return app[method](...args) as Promise<T>
}

const BASE = '/api'

async function http<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

/** A single call routed through whichever transport is active. */
export function call<T>(opts: {
  /** Wails binding method name. */
  method: string
  /** Arguments for the Wails binding call. */
  args?: unknown[]
  /** HTTP path (relative to /api) for standalone mode. */
  path: string
  /** HTTP request options for standalone mode. */
  init?: RequestInit
}): Promise<T> {
  if (isWails()) return wail<T>(opts.method, ...(opts.args ?? []))
  return http<T>(opts.path, opts.init)
}

// --- Wails runtime events -----------------------------------------------------

interface RuntimeGlobal {
  runtime?: {
    EventsOn?: (name: string, cb: (data: unknown) => void) => () => void
  }
}

/**
 * Subscribe to the import.completed Wails event. Returns an unsubscribe
 * function when the runtime provides one (Wails v2.5+); callers must invoke
 * it on cleanup to avoid stacking duplicate listeners.
 */
export function listenImportCompleted(cb: (data: ImportCompletedEvent) => void): () => void {
  const w = window as unknown as RuntimeGlobal
  if (w.runtime?.EventsOn) {
    const off = w.runtime.EventsOn('import.completed', (data) => {
      const d = (data ?? {}) as Partial<ImportCompletedEvent>
      cb({
        source: d.source ?? 'unknown',
        created: d.created ?? 0,
        updated: d.updated ?? 0,
        skipped: d.skipped ?? 0,
        error: d.error,
      })
    })
    return () => off?.()
  }
  return () => {}
}
