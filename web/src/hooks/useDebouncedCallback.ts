import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a stable function that invokes `fn` after `delay` ms of silence.
 * The pending timer is cleared on unmount and on each subsequent call.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
): (...args: Args) => void {
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn }, [fn])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  return useCallback((...args: Args) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => fnRef.current(...args), delay)
  }, [delay])
}
