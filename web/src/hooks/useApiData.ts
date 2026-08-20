import { useCallback, useEffect, useRef, useState } from 'react'

interface ApiDataState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

type Fetcher<T> = () => Promise<T>

// Minimal module-level cache shared by every useApiData consumer. Entries are
// keyed by an arbitrary cache key; a TTL avoids stale data across long
// sessions. `invalidate` clears entries so mutations can force a refetch.
const cache = new Map<string, { data: unknown; at: number }>()
const inflight = new Map<string, Promise<unknown>>()

const listeners = new Set<() => void>()
function notify() { listeners.forEach(l => l()) }

/** Drop cached entries. With a prefix, only matching keys are removed. */
export function invalidateCache(prefix?: string) {
  if (!prefix) { cache.clear() } else {
    for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k)
  }
  notify()
}

export interface UseApiDataOptions {
  /** Cache key; when omitted no caching happens. */
  cacheKey?: string
  /** Cache lifetime in ms (default 30s). */
  ttl?: number
}

/**
 * Fetches data from a fetcher with loading/error state and an optional
 * shared cache. `refetch` bypasses the cache. When `cacheKey` is set, two
 * mounted components using the same key share one request and one cache
 * entry (e.g. the projects list used by Dashboard, NoteSection and the
 * command palette).
 */
export function useApiData<T>(
  fetcher: Fetcher<T>,
  deps: unknown[] = [],
  options: UseApiDataOptions = {}
): ApiDataState<T> & { refetch: () => void } {
  const { cacheKey, ttl = 30_000 } = options
  const [state, setState] = useState<ApiDataState<T>>({ data: null, loading: true, error: null })
  const fetcherRef = useRef(fetcher)
  const requestSeq = useRef(0)
  useEffect(() => { fetcherRef.current = fetcher }, [fetcher])
  // Stringify deps for cache-busting comparisons.
  const depsKey = JSON.stringify(deps)
  const fullKey = cacheKey ? `${cacheKey}:${depsKey}` : undefined

  const load = useCallback(async (bypassCache: boolean, token = ++requestSeq.current) => {
    const isCurrent = () => token === requestSeq.current
    if (fullKey && !bypassCache) {
      const hit = cache.get(fullKey)
      if (hit && Date.now() - hit.at < ttl) {
        if (isCurrent()) setState({ data: hit.data as T, loading: false, error: null })
        return
      }
      const pending = inflight.get(fullKey)
      if (pending) {
        try {
          const data = (await pending) as T
          if (isCurrent()) setState({ data, loading: false, error: null })
        } catch {
          /* the original requester reports the error */
        }
        return
      }
    }
    if (isCurrent()) setState(s => ({ ...s, loading: true, error: null }))
    const p = Promise.resolve().then(() => fetcherRef.current())
    if (fullKey) inflight.set(fullKey, p as Promise<unknown>)
    try {
      const data = await p
      if (fullKey) {
        cache.set(fullKey, { data, at: Date.now() })
        inflight.delete(fullKey)
      }
      if (isCurrent()) setState({ data, loading: false, error: null })
    } catch (e) {
      if (fullKey) inflight.delete(fullKey)
      if (isCurrent()) setState({ data: null, loading: false, error: e instanceof Error ? e.message : 'request failed' })
    }
  }, [fullKey, ttl])

  useEffect(() => {
    const token = ++requestSeq.current
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(false, token)
    // Invalidate this effect's request when dependencies change or the
    // component unmounts; late results are ignored by the sequence guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { requestSeq.current++ }
  }, [fullKey, depsKey, load])

  // React to external invalidations while mounted.
  useEffect(() => {
    const onChange = () => { if (fullKey) load(true) }
    listeners.add(onChange)
    return () => { listeners.delete(onChange) }
  }, [fullKey, load])

  const refetch = useCallback(() => load(true), [load])
  return { ...state, refetch }
}
