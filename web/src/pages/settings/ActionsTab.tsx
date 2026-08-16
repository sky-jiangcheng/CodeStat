import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { triggerScan, importClaudeMemory } from '../../api/client'
import { useInstallPrompt } from '../../utils/install'

interface Props {
  showMessage: (msg: string) => void
}

export default function ActionsTab({ showMessage }: Props) {
  const { t } = useTranslation()
  const { canInstall, installed, promptInstall } = useInstallPrompt()
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  const handleRescan = async () => {
    setSaving(true)
    try {
      await triggerScan()
      showMessage(t('settings.rescanDone'))
    } catch (e: unknown) {
      showMessage(t('settings.rescanFailedMsg', { msg: e instanceof Error ? e.message : t('common.unknownError') }))
    } finally {
      setSaving(false)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const r = await importClaudeMemory()
      showMessage(t('settings.importDone', { created: r.synced, updated: r.updated, skipped: r.skipped }))
    } catch (e: unknown) {
      showMessage(t('settings.importFailed', { msg: e instanceof Error ? e.message : t('common.unknownError') }))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="settings-section">
      <h2>{t('settings.tabs.actions')}</h2>
      <p className="section-desc">{t('settings.actionsDesc')}</p>
      <div className="action-row">
        <button className="btn btn-primary" onClick={handleRescan} disabled={saving}>
          {t('settings.rescanAll')}
        </button>
      </div>

      <h2 style={{ marginTop: 24 }}>{t('settings.importClaudeTitle')}</h2>
      <p className="section-desc" dangerouslySetInnerHTML={{ __html: t('settings.importClaudeDesc') }} />
      <div className="action-row">
        <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
          {importing ? t('settings.importing') : t('settings.importClaudeTitle')}
        </button>
        <Link to="/knowledge" className="btn btn-secondary">{t('settings.gotoKnowledge')}</Link>
      </div>

      <h2 style={{ marginTop: 24 }}>{t('settings.installTitle')}</h2>
      <p className="section-desc">
        {t('settings.installDesc')}{' '}
        {installed ? t('settings.installedMode') : canInstall ? t('settings.supportsInstall') : t('settings.browserSupport')}
      </p>
      {canInstall && (
        <div className="action-row">
          <button className="btn btn-primary" onClick={() => void promptInstall()}>
            {t('settings.installApp')}
          </button>
        </div>
      )}
    </div>
  )
}
