import { useTranslation } from 'react-i18next'
import { applyTheme, storeTheme, type ThemeMode } from '../../utils/theme'

interface Props {
  themeMode: ThemeMode
  onThemeChange: (mode: ThemeMode) => void
  showMessage: (msg: string) => void
}

const THEME_OPTIONS: { value: ThemeMode; labelKey: string; descKey: string }[] = [
  { value: 'light', labelKey: 'settings.themes.light', descKey: 'settings.themes.lightDesc' },
  { value: 'dark', labelKey: 'settings.themes.dark', descKey: 'settings.themes.darkDesc' },
  { value: 'system', labelKey: 'settings.themes.system', descKey: 'settings.themes.systemDesc' },
]

export default function AppearanceTab({ themeMode, onThemeChange, showMessage }: Props) {
  const { t } = useTranslation()

  const handleThemeChange = (mode: ThemeMode) => {
    onThemeChange(mode)
    storeTheme(mode)
    applyTheme(mode)
    showMessage(t('settings.themeApplied'))
  }

  return (
    <div className="settings-section">
      <h2>{t('settings.tabs.appearance')}</h2>
      <p className="section-desc">{t('settings.appearanceDesc')}</p>
      <div className="theme-options">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`theme-option ${themeMode === opt.value ? 'theme-option-active' : ''}`}
            onClick={() => handleThemeChange(opt.value)}
          >
            <div className="theme-preview" data-preview={opt.value} />
            <div className="theme-info">
              <span className="theme-label">{t(opt.labelKey)}</span>
              <span className="theme-desc">{t(opt.descKey)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
