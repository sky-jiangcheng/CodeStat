// App.smoke.test.tsx — Desktop-shell regression test.
//
// Guards the two production-only failures that the browser dev server hides:
//   1. i18n keys rendered raw (namespace mismatch / async resource loading)
//   2. backend calls falling through to HTTP fetch because the Wails binding
//      namespace is wrong, which makes every page fail and renders the error
//      banner with "The string did not match the expected pattern".
//
// The test mounts the real <App /> with window.go.app.App mocked, then asserts
// the shell renders translated text and no error surfaces.

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, cleanup, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'

/** Record of every Wails binding method invoked during a test. */
const wailsCalls: string[] = []

function installWailsBindings() {
  // Only the methods the shell touches on first paint. Anything unmocked
  // rejects, which would surface as an error banner — exactly what we assert
  // against.
  const bindings: Record<string, (...args: unknown[]) => Promise<unknown>> = {
    Health: () => Promise.resolve({ status: 'ok' }),
    ListAllNotes: () => Promise.resolve([]),
    ListAllTags: () => Promise.resolve([]),
    ListProjects: () => Promise.resolve([]),
    GetConfig: () => Promise.resolve({}),
  }
  const app = new Proxy(bindings, {
    get(target, prop: string) {
      if (prop in target) {
        return (...args: unknown[]) => {
          wailsCalls.push(prop)
          return target[prop](...args)
        }
      }
      return undefined
    },
  })
  ;(window as unknown as { go: unknown }).go = { app: { App: app } }
}

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
  installWailsBindings()
})

afterEach(() => {
  cleanup()
  wailsCalls.length = 0
})

async function mountApp() {
  // Imported lazily so beforeAll can install the Wails globals first.
  const { default: App } = await import('./App')
  return render(<App /> as ReactElement)
}

describe('App desktop shell', () => {
  it('renders translated nav labels instead of raw i18n keys', async () => {
    await mountApp()
    // Nav renders synchronously — it must never show "nav.knowledge".
    expect(await screen.findByText(/^(Knowledge|知识库)$/, {}, { timeout: 5000 })).toBeTruthy()
    // The lazy Knowledge page resolves next; its h1 comes from knowledge.title.
    await waitFor(
      () => expect(screen.getAllByText(/Knowledge Base|知识库/).length).toBeGreaterThan(0),
      { timeout: 5000 },
    )
    const body = document.body.textContent ?? ''
    // A leaked key looks like "nav.knowledge" / "knowledge.title".
    expect(body).not.toMatch(/\b(nav|knowledge|status)\.[a-zA-Z]+/)
  })

  it('routes backend calls through the Wails binding, not HTTP fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await mountApp()
    await waitFor(() => expect(wailsCalls).toContain('ListAllNotes'), { timeout: 5000 })
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('shows no error banner', async () => {
    await mountApp()
    await waitFor(() => expect(wailsCalls).toContain('ListAllNotes'), { timeout: 5000 })
    const body = document.body.textContent ?? ''
    expect(body).not.toMatch(/did not match the expected pattern/)
    expect(document.querySelector('.conn-banner')).toBeNull()
  })
})
