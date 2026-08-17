import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getConfig, type AppConfig } from '../api/client'
import { getStoredTheme, type ThemeMode } from '../utils/theme'
import { usePageMeta } from '../utils/seo'
import ScanRootsTab from './settings/ScanRootsTab'
import StandardsTab from './settings/StandardsTab'
import AuthorsTab from './settings/AuthorsTab'
import AppearanceTab from './settings/AppearanceTab'
import PluginsTab from './settings/PluginsTab'
import ActionsTab from './settings/ActionsTab'

type TabKey = 'scan' | 'standards' | 'authors' | 'appearance' | 'plugins' | 'actions'
const TAB_KEYS: TabKey[] = ['scan', 'standards', 'authors', 'appearance', 'plugins', 'actions']

function Settings() {
  const { t } = useTranslation()
  usePageMeta({ title: `${t('settings.title')} - GitBuddy`, description: 'GitBuddy 设置：扫描目录、代码标准、作者配置、外观、插件与操作。', path: '/settings' })
  const [data, setData] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<TabKey>('scan')
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showMessage = (msg: string) => {
    setMessage(msg)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setMessage(''), 3000)
  }

  useEffect(() => {
    setThemeMode(getStoredTheme()) // eslint-disable-line react-hooks/set-state-in-effect
    getConfig()
      .then(setData)
      .finally(() => setLoading(false))
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  if (loading) {
    return (
      <div className="settings">
        <h1>{t('settings.title')}</h1>
        <div className="skeleton skeleton-text" style={{width: '100%', height: 24, marginBottom: 12}} />
        <div className="skeleton skeleton-text" style={{width: '100%', height: 64, marginBottom: 8}} />
        <div className="skeleton skeleton-text" style={{width: '100%', height: 64, marginBottom: 8}} />
      </div>
    )
  }

  return (
    <div className="settings">
      <h1>{t('settings.title')}</h1>

      {message && <div className="message-banner">{message}</div>}

      <div className="settings-tabs">
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            className={`tab-btn ${tab === key ? 'tab-active' : ''}`}
            onClick={() => setTab(key)}
          >
            {t(`settings.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'scan' && (
        <ScanRootsTab data={data} onChange={setData} showMessage={showMessage} />
      )}
      {tab === 'standards' && data && (
        <StandardsTab
          key="standards"
          initialStandard={data.config.daily_code_standard || '500'}
          initialDepth={data.config.scan_depth || '2'}
          showMessage={showMessage}
        />
      )}
      {tab === 'authors' && data && (
        <AuthorsTab
          key="authors"
          initialAuthor={data.config.git_author || ''}
          showMessage={showMessage}
        />
      )}
      {tab === 'appearance' && (
        <AppearanceTab themeMode={themeMode} onThemeChange={setThemeMode} showMessage={showMessage} />
      )}
      {tab === 'plugins' && data && (
        <PluginsTab key="plugins" initialAutoImport={data.config.auto_import !== '0'} showMessage={showMessage} />
      )}
      {tab === 'actions' && <ActionsTab showMessage={showMessage} />}
    </div>
  )
}

export default Settings
