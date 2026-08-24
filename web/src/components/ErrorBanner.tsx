import { useTranslation } from 'react-i18next'

// ErrorBanner is the single rendering path for recoverable page-level errors.
// Every page that catches a failed fetch shows the same banner (message + an
// optional retry button), so users see one consistent recovery affordance
// instead of N slightly different inline banners. Rendering is pure: callers
// own the error state and the retry handler; this component just renders.
function ErrorBanner({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>{t('common.retry')}</button>
      )}
    </div>
  )
}

export default ErrorBanner
