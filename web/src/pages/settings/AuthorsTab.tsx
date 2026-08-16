import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateConfig } from '../../api/client'

interface Props {
  initialAuthor: string
  showMessage: (msg: string) => void
}

export default function AuthorsTab({ initialAuthor, showMessage }: Props) {
  const { t } = useTranslation()
  const [authorName, setAuthorName] = useState(initialAuthor)
  const [saving, setSaving] = useState(false)

  const handleSaveAuthor = async () => {
    const trimmed = authorName.trim()
    if (!trimmed) {
      showMessage(t('settings.enterAuthor'))
      return
    }
    setSaving(true)
    try {
      await updateConfig('git_author', trimmed)
      showMessage(t('settings.authorSaved'))
    } catch (e: unknown) {
      showMessage(t('settings.saveFailedMsg', { msg: e instanceof Error ? e.message : t('common.unknownError') }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-section">
      <h2>{t('settings.authorConfig')}</h2>
      <p className="section-desc">{t('settings.authorDesc')}</p>
      <div className="form-group">
        <label htmlFor="settings-author">{t('settings.authorName')}</label>
        <input
          id="settings-author"
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="John Doe"
          className="form-input"
        />
        <span className="form-hint">{t('settings.authorHint')}</span>
      </div>
      <button className="btn btn-primary" onClick={handleSaveAuthor} disabled={saving}>
        {t('settings.saveAuthor')}
      </button>
    </div>
  )
}
