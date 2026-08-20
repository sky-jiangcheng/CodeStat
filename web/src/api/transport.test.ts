// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { call, checkHealth, getConnectionKind, subscribeConnection } from './transport'

// transport.ts registers online/offline listeners at import time; each test
// runs in a fresh jsdom so the global window is available.

beforeEach(() => {
  delete (window as unknown as { go?: unknown }).go
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('call routing', () => {
  it('routes through the Wails binding when window.go.main.App exists', async () => {
    const appMethod = vi.fn().mockResolvedValue({ ok: true })
    ;(window as unknown as { go: { main: { App: { Health: typeof appMethod } } } }).go = {
      main: { App: { Health: appMethod } },
    }
    const result = await call<{ ok: boolean }>({ method: 'Health', path: '/health' })
    expect(appMethod).toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it('falls back to HTTP fetch against /api when Wails is absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [1] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await call<{ items: number[] }>({ method: 'ListProjects', path: '/projects' })
    expect(fetchMock).toHaveBeenCalledWith('/api/projects', undefined)
    expect(result).toEqual({ items: [1] })
  })

  it('throws the backend error message on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ error: 'boom' }),
    }))
    await expect(call({ method: 'X', path: '/x' })).rejects.toThrow('boom')
  })
})

describe('connection health', () => {
  it('starts as ok', () => {
    expect(getConnectionKind()).toBe('ok')
  })

  it('marks backend-down when the Wails Health call rejects', async () => {
    ;(window as unknown as { go: { main: { App: { Health: () => Promise<never> } } } }).go = {
      main: { App: { Health: () => Promise.reject(new Error('no backend')) } },
    }
    const kinds: string[] = []
    subscribeConnection(k => kinds.push(k))
    const ok = await checkHealth()
    expect(ok).toBe(false)
    expect(kinds).toContain('backend-down')
  })

  it('treats a healthy response as ok', async () => {
    ;(window as unknown as { go: { main: { App: { Health: () => Promise<{ ok: boolean }> } } } }).go = {
      main: { App: { Health: () => Promise.resolve({ ok: true }) } },
    }
    const ok = await checkHealth()
    expect(ok).toBe(true)
    expect(getConnectionKind()).toBe('ok')
  })
})