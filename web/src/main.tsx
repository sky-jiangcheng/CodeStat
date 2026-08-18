import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import './i18n'

// 全局错误边界 - 捕获所有渲染错误
class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[GlobalErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error ? String(this.state.error) : 'Unknown error'
      return (
        <div style={{ padding: 32, color: 'var(--color-error)', background: 'var(--color-surface)', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h1>应用加载出错</h1>
          <pre style={{ background: 'var(--color-muted)', padding: 16, borderRadius: 8 }}>{errorMsg}</pre>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>,
)

// --- Service Worker registration ---------------------------------------------
//
// The PWA service worker must NOT be registered inside a Wails WebView.
// On Intel Macs the WKWebView's SW implementation is unreliable: the SW
// intercepts navigation via a NavigationRoute and serves a broken/empty
// response, causing a white screen on app launch.
//
// We register the SW only in a real browser. If a previous version of the
// app already registered a SW inside Wails, we actively unregister it to
// recover from the white-screen state.
//
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  // Detect Wails environment: window.go.main.App is injected by Wails.
  const wailsGlobal = (window as unknown as { go?: unknown }).go
  const isWails = !!wailsGlobal

  if (isWails) {
    // Inside Wails: unregister any leftover service worker to prevent it
    // from intercepting navigation and causing a white screen.
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => {
        reg.unregister().then(() => {
          console.info('[PWA] Unregistered stale service worker in Wails context')
        })
      })
    }).catch(() => { /* ignore */ })
    return
  }

  // Inside a real browser: register the service worker for offline support.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => {
      console.warn('[PWA] SW registration failed:', err)
    })
  })
}

registerServiceWorker()
