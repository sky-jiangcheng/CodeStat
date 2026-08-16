import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getScanStatus } from '../api/client'

interface ScanPollingState {
  scanning: boolean
  message: string
  doneMessage: string
}

/**
 * Polls the backend scan status while a scan runs and invokes `onFinish`
 * once it completes. Replaces the duplicated polling intervals in the
 * Dashboard (initial status check and post-trigger polling).
 */
export function useScanPolling(onFinish: () => void): ScanPollingState & { start: (msg: string) => void } {
  const { t } = useTranslation()
  const [scanning, setScanning] = useState(false)
  const [message, setMessage] = useState('')
  const [doneMessage, setDoneMessage] = useState('')
  const timer = useRef<number | null>(null)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const stop = useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null }
  }, [])

  useEffect(() => stop, [stop])

  const poll = useCallback(() => {
    if (timer.current) return
    timer.current = window.setInterval(async () => {
      try {
        const s = await getScanStatus()
        if (!s.running && !s.backfilling) {
          stop()
          setScanning(false)
          setMessage('')
          setDoneMessage(t('common.scanDone', { defaultValue: 'Scan complete' }))
          onFinishRef.current()
        } else {
          setMessage(s.message)
        }
      } catch { /* keep polling */ }
    }, 2000)
  }, [stop, t])

  // Check whether a scan is already running when the consumer mounts.
  useEffect(() => {
    let cancelled = false
    getScanStatus()
      .then(status => {
        if (cancelled) return
        if (status.running || status.backfilling) {
          setScanning(true)
          setMessage(status.message)
          poll()
        }
      })
      .catch(() => { /* backend not ready */ })
    return () => { cancelled = true }
  }, [poll])

  const start = useCallback((msg: string) => {
    setScanning(true)
    setMessage(msg)
    setDoneMessage('')
    poll()
  }, [poll])

  return { scanning, message, doneMessage, start }
}
