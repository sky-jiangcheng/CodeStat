import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { NoteVersion } from '../../api/client'

interface Props {
  versions: NoteVersion[]
  restoringId: number | null
  diffText: string | null
  onRestore: (versionId: number) => void
  onShowDiff: (versionId: number) => void
  onClose: () => void
}

/**
 * Parse unified diff text into styled lines: '+' → green, '-' → red,
 * ' ' → context. Falls back to plain text for unparseable content.
 */
function DiffViewer({ text }: { text: string }) {
  const lines = useMemo(() => text.split('\n'), [text])

  return (
    <div className="diff-panel">
      <pre className="diff-pre">
        {lines.map((line, i) => {
          if (line.startsWith('+')) {
            return <code key={i} className="diff-line-add">{line}</code>
          }
          if (line.startsWith('-')) {
            return <code key={i} className="diff-line-del">{line}</code>
          }
          return <code key={i}>{line}</code>
        })}
      </pre>
    </div>
  )
}

/** Version history list for one note, with per-version diff and restore. */
export default function VersionHistoryPanel({ versions, restoringId, diffText, onRestore, onShowDiff, onClose }: Props) {
  const { t } = useTranslation()

  return (
    <div className="version-history-panel">
      <div className="version-history-header">
        <h4>{t('project.versionHistory')}</h4>
        <button className="btn btn-sm" onClick={onClose}>{t('common.close')}</button>
      </div>
      {versions.length === 0 ? (
        <p className="empty-hint">{t('project.noVersions')}</p>
      ) : (
        <div className="version-list">
          {versions.map(v => (
            <div key={v.id} className="version-item">
              <span className="version-time">{v.created_at}</span>
              <span className="version-title">{v.title || t('project.untitled')}</span>
              <div className="version-actions">
                <button className="btn btn-sm" onClick={() => onShowDiff(v.id)} title={t('project.viewDiff')}>
                  {t('project.diff')}
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => onRestore(v.id)}
                  disabled={restoringId === v.id}
                  title={t('project.restoreVersion', { defaultValue: '恢复到此版本' })}
                >
                  {restoringId === v.id ? t('project.restoring') : t('project.restore')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {diffText !== null && <DiffViewer text={diffText} />}
    </div>
  )
}
