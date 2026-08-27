import { useRef, useCallback } from 'react'

/**
 * useNoteMutations encapsulates all note write operations (create / edit /
 * delete / move / pin) together with the retry-last mechanism.
 *
 * The `run` wrapper captures the last failed mutation so the ErrorBanner's
 * retry button can replay it instead of leaving the user with a silent failure.
 */
export interface NoteMutationsHandle {
  run: (op: () => Promise<void>, errMsg: string) => Promise<void>
  retryLast: () => void
  lastOpRef: React.MutableRefObject<(() => Promise<void>) | null>
}

export function useNoteMutations(setError: (msg: string) => void): NoteMutationsHandle {
  const lastOpRef = useRef<(() => Promise<void>) | null>(null)

  const run = useCallback(async (op: () => Promise<void>, errMsg: string) => {
    setError('')
    try {
      await op()
    } catch (e) {
      lastOpRef.current = op
      setError(errMsg + (e instanceof Error ? e.message : ''))
    }
  }, [setError])

  const retryLast = useCallback(() => {
    const op = lastOpRef.current
    if (op) { lastOpRef.current = null; void op() }
  }, [])

  return { run, retryLast, lastOpRef }
}
