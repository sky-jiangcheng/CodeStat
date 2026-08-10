import { Component, ReactNode, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import Settings from './pages/Settings'
import Knowledge from './pages/Knowledge'
import CommandPalette from './components/CommandPalette'
import ToastHost, { type ToastItem } from './components/Toast'
import { listenImportCompleted } from './api/client'
import { applyTheme, getStoredTheme, listenSystemTheme } from './utils/theme'

// ErrorBoundary prevents a render crash in any routed page from black-screening
// the whole app with no way back. It shows a recoverable error and a button that
// clears the error and returns to the dashboard. It also auto-resets when the
// route changes, so navigating away from a broken page recovers automatically.
class ErrorBoundary extends Component<
  { resetKey: string; children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state: { hasError: boolean; error: Error | null } = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <div className="error-banner">
            <span>页面加载出错：{this.state.error?.message || '未知错误'}</span>
          </div>
          <button className="btn btn-primary" onClick={this.handleReset}>返回仪表盘</button>
        </div>
      )
    }
    return this.props.children
  }
}

function NavBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { pathname } = useLocation()

  const navClass = (active: boolean) => active ? 'active' : ''

  return (
    <header>
      <nav className="navbar" aria-label="主导航">
        <div className="nav-left">
          <Link to="/" className="nav-brand">
            <span className="nav-brand-mark">▦</span>
            GitBuddy
          </Link>
          <div className="nav-links">
            <Link to="/" className={navClass(pathname === '/' || pathname === '/knowledge')}>
              知识库
            </Link>
            <Link to="/dashboard" className={navClass(pathname === '/dashboard' || pathname.startsWith('/project'))}>
              仪表盘
            </Link>
            <Link to="/settings" className={navClass(pathname === '/settings')}>
              设置
            </Link>
          </div>
        </div>
        <div role="search">
          <button className="nav-palette-btn" onClick={onOpenPalette} aria-label="打开搜索 (⌘K)" title="搜索 (⌘K)" aria-haspopup="dialog">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span>搜索</span>
            <kbd className="nav-kbd">⌘K</kbd>
          </button>
        </div>
      </nav>
    </header>
  )
}

function App() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Focus main without touching location (BrowserRouter owns the history).
  const skipToContent = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const main = document.getElementById('main-content')
    main?.focus()
    main?.scrollIntoView({ block: 'start' })
  }

  const pushToast = (t: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts(prev => [...prev, { ...t, id }])
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), t.duration ?? 5000)
  }

  useEffect(() => {
    const mode = getStoredTheme()
    applyTheme(mode)
    return listenSystemTheme(() => {
      if (getStoredTheme() === 'system') applyTheme('system')
    })
  }, [])

  useEffect(() => {
    // Surface knowledge import results as toasts (issue #36).
    const unsubscribe = listenImportCompleted((data) => {
      if (data.error) {
        pushToast({ kind: 'error', title: `导入 ${data.source} 失败`, message: data.error })
        return
      }
      if (data.created === 0 && data.updated === 0 && data.skipped === 0) {
        return
      }
      pushToast({
        kind: 'success',
        title: `知识源 ${data.source} 已导入`,
        message: `新增 ${data.created} · 更新 ${data.updated} · 跳过 ${data.skipped}`,
      })
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Intercept beforeinstallprompt so we can surface an install action to the
  // user as a toast. Once the user dismisses the browser prompt (accept or
  // cancel) the deferred prompt is consumed.
  useEffect(() => {
    let deferredPrompt: any = null
    const onPrompt = (e: Event) => {
      e.preventDefault()
      deferredPrompt = e
      pushToast({
        kind: 'info',
        title: '将 GitBuddy 安装到桌面',
        message: '点击安装后可像本地应用一样打开，并支持离线使用。',
        actionLabel: '安装',
        onAction: async () => {
          if (!deferredPrompt) return
          deferredPrompt.prompt?.()
          try {
            await deferredPrompt.userChoice
          } catch { /* ignore */ }
          deferredPrompt = null
        },
        duration: 60_000,
      })
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  return (
    <BrowserRouter>
      <div className="app">
        <a className="skip-link" href="#main-content" onClick={skipToContent}>跳到主内容</a>
        <NavBar onOpenPalette={() => setPaletteOpen(true)} />
        <main id="main-content" className="main-content" tabIndex={-1}>
          <RoutedApp />
        </main>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <ToastHost toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(x => x.id !== id))} />
      </div>
    </BrowserRouter>
  )
}

// RoutedApp wraps the routes in an ErrorBoundary keyed to the current path, so a
// crash in a destination page (e.g. clicking a scan result) shows a recoverable
// error instead of a black screen, and recovers when the route changes.
function RoutedApp() {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary resetKey={pathname}>
      <Routes>
        <Route path="/" element={<Knowledge />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/project/:id" element={<ProjectDetail />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
