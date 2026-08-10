// ToastHost renders transient toast notifications (e.g. knowledge import
// results pushed from the Go runtime via Wails events). Positioned top-right
// so it does not obstruct the navbar or main content.
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export interface ToastItem {
  id: string
  kind: 'success' | 'error' | 'info'
  title: string
  message?: string
  duration?: number
  actionLabel?: string
  onAction?: () => void | Promise<void>
}

function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}) {
  const { t } = useTranslation()

  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map(item =>
      setTimeout(() => onDismiss(item.id), item.duration ?? 5000)
    )
    return () => timers.forEach(clearTimeout)
  }, [toasts, onDismiss])

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`}>
          <div className="toast-body">
            <div className="toast-title">{toast.title}</div>
            {toast.message && <div className="toast-message">{toast.message}</div>}
            {toast.actionLabel && (
              <button
                type="button"
                className="toast-action"
                onClick={async () => {
                  try { await toast.onAction?.() } finally { onDismiss(toast.id) }
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
          <button className="toast-close" onClick={() => onDismiss(toast.id)} aria-label={t('common.close', { defaultValue: 'Close' })}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export default ToastHost
