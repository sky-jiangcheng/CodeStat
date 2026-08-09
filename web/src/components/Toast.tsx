// ToastHost renders transient toast notifications (e.g. knowledge import
// results pushed from the Go runtime via Wails events). Positioned top-right
// so it does not obstruct the navbar or main content.
import { useEffect } from 'react'

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
  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map(t =>
      setTimeout(() => onDismiss(t.id), t.duration ?? 5000)
    )
    return () => timers.forEach(clearTimeout)
  }, [toasts, onDismiss])

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <div className="toast-body">
            <div className="toast-title">{t.title}</div>
            {t.message && <div className="toast-message">{t.message}</div>}
            {t.actionLabel && (
              <button
                type="button"
                className="toast-action"
                onClick={async () => {
                  try { await t.onAction?.() } finally { onDismiss(t.id) }
                }}
              >
                {t.actionLabel}
              </button>
            )}
          </div>
          <button className="toast-close" onClick={() => onDismiss(t.id)} aria-label="关闭">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export default ToastHost
