import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateConfig } from '../../api/client'

interface Props {
  initialStandard: string
  initialDepth: string
  showMessage: (msg: string) => void
}

export default function StandardsTab({ initialStandard, initialDepth, showMessage }: Props) {
  const { t } = useTranslation()
  const [codeStandard, setCodeStandard] = useState(initialStandard)
  const [scanDepth, setScanDepth] = useState(initialDepth)
  const [saving, setSaving] = useState(false)

  const handleSaveConfig = async () => {
    const num = parseInt(codeStandard, 10)
    if (isNaN(num) || num < 100 || num > 10000) {
      showMessage(t('settings.goalInvalid', { defaultValue: '每日目标行数应在 100-10000 之间' }))
      return
    }
    const depth = parseInt(scanDepth, 10)
    if (isNaN(depth) || depth < 1 || depth > 2) {
      showMessage(t('settings.depthInvalid', { defaultValue: '扫描深度应在 1-2 之间' }))
      return
    }
    setSaving(true)
    try {
      await updateConfig('daily_code_standard', String(num))
      await updateConfig('scan_depth', String(depth))
      showMessage(t('settings.configSaved'))
    } catch (e: unknown) {
      showMessage(t('settings.saveFailedMsg', { msg: e instanceof Error ? e.message : t('common.unknownError') }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-section">
      <h2>{t('settings.codeStandard')}</h2>
      <div className="form-group">
        <label htmlFor="settings-code-standard">{t('settings.dailyGoalLabel')}</label>
        <input
          id="settings-code-standard"
          type="number"
          value={codeStandard}
          onChange={(e) => setCodeStandard(e.target.value)}
          className="form-input"
          min={100}
          max={10000}
        />
        <span className="form-hint">{t('settings.goalRange', { defaultValue: '范围: 100-10000' })}</span>
      </div>
      <div className="form-group">
        <label htmlFor="settings-scan-depth">{t('settings.scanDepthLabel')}</label>
        <input
          id="settings-scan-depth"
          type="number"
          value={scanDepth}
          onChange={(e) => setScanDepth(e.target.value)}
          className="form-input"
          min={1}
          max={2}
        />
        <span className="form-hint">{t('settings.depthRange', { defaultValue: '范围: 1-2' })}</span>
      </div>
      <button className="btn btn-primary" onClick={handleSaveConfig} disabled={saving}>
        {t('settings.saveConfig')}
      </button>
    </div>
  )
}
