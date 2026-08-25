import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getKnowledgeSources, triggerKnowledgeImport,
  updateConfig, type SourceStatus,
} from '../../api/client'

interface Props {
  initialAutoImport: boolean
  showMessage: (msg: string) => void
}

export default function PluginsTab({ initialAutoImport, showMessage }: Props) {
  const { t } = useTranslation()
  const [sources, setSources] = useState<SourceStatus[]>([])
  const [importingSource, setImportingSource] = useState('')
  const [autoImport, setAutoImport] = useState(initialAutoImport)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getKnowledgeSources().then(setSources).catch(() => {})
  }, [])

  const handleImportSource = async (name: string) => {
    setImportingSource(name)
    try {
      const r = await triggerKnowledgeImport(name)
      showMessage(t('settings.importDone', { created: r.created, updated: r.updated, skipped: r.skipped }))
    } catch (e: unknown) {
      showMessage(t('settings.importFailed', { msg: e instanceof Error ? e.message : t('common.unknownError') }))
    } finally {
      setImportingSource('')
    }
  }

  const handleAutoImportToggle = async (on: boolean) => {
    setSaving(true)
    try {
      await updateConfig('auto_import', on ? '1' : '0')
      setAutoImport(on)
      showMessage(on ? t('settings.autoImportOn') : t('settings.autoImportOff'))
    } catch (e: unknown) {
      showMessage(t('settings.saveFailedMsg', { msg: e instanceof Error ? e.message : t('common.unknownError') }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-section">
      <p className="section-desc" dangerouslySetInnerHTML={{ __html: t('settings.pluginDesc') }} />

      <div className="form-group">
        <label id="settings-auto-import-label">{t('settings.autoImportLabel')}</label>
        <div className="toggle-row">
          <button
            className={`toggle ${autoImport ? 'toggle-on' : ''}`}
            onClick={() => handleAutoImportToggle(!autoImport)}
            disabled={saving}
            aria-pressed={autoImport}
            aria-labelledby="settings-auto-import-label"
          >
            <span className="toggle-knob" />
          </button>
          <span className="form-hint" style={{ marginTop: 0 }}>
            {autoImport ? t('settings.autoImportOnHint') : t('settings.autoImportOffHint')}
          </span>
        </div>
      </div>

      <h2 style={{ marginTop: 24 }}>{t('settings.tabs.plugins')}</h2>
      {sources.length === 0 ? (
        <div className="empty-hint">{t('settings.noSources')}</div>
      ) : (
        <ul className="plugin-list">
          {sources.map((s) => (
            <li key={s.name} className="plugin-item plugin-ok">
              <div className="plugin-info">
                <span className="plugin-name">{s.name}</span>
                <span className="plugin-path">{t('settings.fromPlugin', { name: s.plugin || 'builtin' })}</span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleImportSource(s.name)}
                disabled={importingSource !== '' || !s.enabled}
              >
                {importingSource === s.name ? t('settings.importing') : t('settings.importNow')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
