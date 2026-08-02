import { Component, ReactNode, useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import Settings from './pages/Settings'
import Knowledge from './pages/Knowledge'
import CommandPalette from './components/CommandPalette'
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
    window.location.hash = '#/'
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
    <nav className="navbar">
      <div className="nav-left">
        <Link to="/" className="nav-brand">
          <span className="nav-brand-mark">▦</span>
          GitBoard
        </Link>
        <div className="nav-links">
          <Link to="/" className={navClass(pathname === '/' || pathname.startsWith('/project'))}>
            仪表盘
          </Link>
          <Link to="/knowledge" className={navClass(pathname === '/knowledge')}>
            知识库
          </Link>
          <Link to="/settings" className={navClass(pathname === '/settings')}>
            设置
          </Link>
        </div>
      </div>
      <button className="nav-palette-btn" onClick={onOpenPalette} title="搜索 (⌘K)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span>搜索</span>
        <kbd className="nav-kbd">⌘K</kbd>
      </button>
    </nav>
  )
}

function App() {
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const mode = getStoredTheme()
    applyTheme(mode)
    return listenSystemTheme(() => {
      if (getStoredTheme() === 'system') applyTheme('system')
    })
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

  return (
    <HashRouter>
      <div className="app">
        <NavBar onOpenPalette={() => setPaletteOpen(true)} />
        <main className="main-content">
          <RoutedApp />
        </main>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>
    </HashRouter>
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
        <Route path="/" element={<Dashboard />} />
        <Route path="/project/:id" element={<ProjectDetail />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
