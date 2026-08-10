import { Component, ReactNode, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import Settings from './pages/Settings'
import Knowledge from './pages/Knowledge'
import CommandPalette from './components/CommandPalette'
import ToastHost, { type ToastItem } from './components/Toast'
import { listenImportCompleted } from './api/client'
import { applyTheme, getStoredTheme, listenSystemTheme } from './utils/theme'
import { setLanguage, getCurrentLanguage } from './i18n'

type LanguageOption = 'zh-CN' | 'en'

const LANG_OPTIONS: { code: LanguageOption; label: string; flag: string }[] = [
  { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
]

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
            <span>页面加载出错：{this.state.error?.message || 'Unknown error'}</span>
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
  const { t } = useTranslation()
  const [langOpen, setLangOpen] = useState(false)
  const currentLang = getCurrentLanguage()

  return (
    <header>
      <nav className="navbar" aria-label={t('nav.search', { defaultValue: 'main navigation' })}>
        <div className="nav-left">
          <Link to="/" className="nav-brand">
            <span className="nav-brand-mark">▦</span>
            GitBuddy
          </Link>
          <div className="nav-links">
            <Link to="/" className={navClass(pathname === '/' || pathname === '/knowledge')}>
              {t('nav.knowledge')}
            </Link>
            <Link to="/dashboard" className={navClass(pathname === '/dashboard' || pathname.startsWith('/project'))}>
              {t('nav.dashboard')}
            </Link>
            <Link to="/settings" className={navClass(pathname === '/settings')}>
              {t('nav.settings')}
            </Link>
          </div>
        </div>
        <div className="nav-right">
          <div className="lang-switcher" ref={(el) => {
            if (!el) return
            const handler = (e: MouseEvent) => {
              if (!el.contains(e.target as Node)) setLangOpen(false)
            }
            if (langOpen) document.addEventListener('mousedown', handler)
            return () => document.removeEventListener('mousedown', handler)
          }}>
            <button
              className="nav-lang-btn"
              onClick={() => setLangOpen(v => !v)}
              aria-label={t('nav.searchLabel', { defaultValue: 'Language switch' })}
              aria-expanded={langOpen}
              title={t('nav.searchLabel', { defaultValue: 'Switch language' })}
            >
              {LANG_OPTIONS.find(o => o.code === currentLang)?.flag ?? '🌐'}
              <span className="lang-label">{currentLang === 'zh-CN' ? '中文' : 'EN'}</span>
            </button>
            {langOpen && (
              <div className="lang-dropdown">
                {LANG_OPTIONS.map(opt => (
                  <button
                    key={opt.code}
                    className={`lang-option ${opt.code === currentLang ? 'active' : ''}`}
                    onClick={() => { setLanguage(opt.code); setLangOpen(false) }}
                  >
                    <span className="lang-flag">{opt.flag}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div role="search">
            <button
              className="nav-palette-btn"
              onClick={onOpenPalette}
              aria-label={t('nav.searchLabel', { defaultValue: 'Open search (⌘K)' })}
              title={t('nav.searchLabel', { defaultValue: 'Open search (⌘K)' })}
              aria-haspopup="dialog"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span>{t('nav.search')}</span>
              <kbd className="nav-kbd">⌘K</kbd>
            </button>
          </div>
        </div>
      </nav>
    </header>
  )
}

function navClass(active: boolean) {
  return active ? 'active' : ''
}

function App() {
  const { t } = useTranslation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Focus main without touching location (BrowserRouter owns the history).
  const skipToContent = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const main = document.getElementById('main-content')
    main?.focus()
    main?.scrollIntoView({ block: 'start' })
  }

  const pushToast = (item: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts(prev => [...prev, { ...item, id }])
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), item.duration ?? 5000)
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
        pushToast({ kind: 'error', title: `${t('common.importFailed', { defaultValue: 'Import failed' })} ${data.source}`, message: data.error })
        return
      }
      if (data.created === 0 && data.updated === 0 && data.skipped === 0) {
        return
      }
      pushToast({
        kind: 'success',
        title: `${t('common.imported', { defaultValue: 'Imported' })} ${data.source}`,
        message: `${t('common.add', { defaultValue: '+' })}${data.created} · ${t('common.edit', { defaultValue: '~' })}${data.updated} · ${t('common.remove', { defaultValue: '-' })}${data.skipped}`,
      })
    })
    return unsubscribe
  }, [t])

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
        title: t('common.installDesktop', { defaultValue: 'Install GitBuddy to Desktop' }),
        message: t('common.installMsg', { defaultValue: 'Install for standalone window and offline use.' }),
        actionLabel: t('common.install', { defaultValue: 'Install' }),
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
  }, [t])

  return (
    <BrowserRouter>
      <div className="app">
        <a className="skip-link" href="#main-content" onClick={skipToContent}>{t('common.show', { defaultValue: 'Skip to main content' })}</a>
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
