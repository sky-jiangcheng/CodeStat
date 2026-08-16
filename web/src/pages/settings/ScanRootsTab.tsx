import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateScanRoots, type AppConfig } from '../../api/client'

interface Props {
  data: AppConfig | null
  onChange: (data: AppConfig) => void
  showMessage: (msg: string) => void
}

export default function ScanRootsTab({ data, onChange, showMessage }: Props) {
  const { t } = useTranslation()
  const [newRoot, setNewRoot] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAddRoot = async () => {
    if (!newRoot.trim() || !data) return
    setSaving(true)
    try {
      const updated = [...data.scan_roots, newRoot.trim()]
      await updateScanRoots(updated)
      onChange({ ...data, scan_roots: updated })
      setNewRoot('')
      showMessage(t('settings.added'))
    } catch (e: unknown) {
      showMessage(t('settings.addFailedMsg', { msg: e instanceof Error ? e.message : t('common.unknownError') }))
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveRoot = async (path: string) => {
    if (!data) return
    setSaving(true)
    try {
      const updated = data.scan_roots.filter((r) => r !== path)
      await updateScanRoots(updated)
      onChange({ ...data, scan_roots: updated })
      showMessage(t('settings.removed'))
    } catch (e: unknown) {
      showMessage(t('settings.removeFailedMsg', { msg: e instanceof Error ? e.message : t('common.unknownError') }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-section">
      <h2>{t('settings.scanRoots')}</h2>
      <div className="form-group">
        <label htmlFor="settings-new-root">{t('settings.addRoot')}</label>
        <div className="input-row">
          <input
            id="settings-new-root"
            type="text"
            value={newRoot}
            onChange={(e) => setNewRoot(e.target.value)}
            placeholder="/Users/you/Projects"
            className="form-input"
          />
          <button className="btn btn-primary" onClick={handleAddRoot} disabled={saving}>
            {t('settings.add')}
          </button>
        </div>
      </div>
      <ul className="root-list">
        {data?.scan_roots.map((root) => (
          <li key={root} className="root-item">
            <span className="root-path">{root}</span>
            <button className="btn btn-danger btn-sm" onClick={() => handleRemoveRoot(root)} disabled={saving}>
              {t('settings.remove')}
            </button>
          </li>
        ))}
        {(!data?.scan_roots || data.scan_roots.length === 0) && (
          <li className="root-item empty">{t('settings.noRoots')}</li>
        )}
      </ul>
    </div>
  )
}
