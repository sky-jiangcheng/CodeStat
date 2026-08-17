import { useEffect, useRef, useState } from 'react'

/**
 * Two-click confirmation for destructive actions: the first click arms the
 * confirmation, the second within `resetMs` fires it. Replaces the duplicated
 * confirm-delete patterns in the todo and note lists.
 */
export function useConfirmClick(onConfirm: () => void, resetMs = 2500): { armed: boolean; click: () => void } {
  const [armed, setArmed] = useState(false)
  const confirmRef = useRef(onConfirm)
  useEffect(() => { confirmRef.current = onConfirm }, [onConfirm])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  const click = () => {
    if (armed) {
      setArmed(false)
      if (timer.current) clearTimeout(timer.current)
      confirmRef.current()
      return
    }
    setArmed(true)
    timer.current = setTimeout(() => setArmed(false), resetMs)
  }

  return { armed, click }
}
