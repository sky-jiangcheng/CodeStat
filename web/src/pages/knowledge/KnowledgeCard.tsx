import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { NoteWithProject } from '../../api/client'
import { renderMarkdown, stripMarkdown, parseTags } from '../../utils/markdown'

interface Props {
  note: NoteWithProject
  exporting: boolean
  onPin: (id: number, pinned: boolean) => void
  onExport: (id: number) => void
  onSelectTag: (tag: string) => void
}

/** One card in the knowledge-hub note grid. */
export default function KnowledgeCard({ note, exporting, onPin, onExport, onSelectTag }: Props) {
  const { t } = useTranslation()
  const tags = parseTags(note.tags)
  const kindLabel = note.kind === 'knowledge'
    ? t('project.kinds.knowledge')
    : note.kind === 'idea'
      ? t('project.kinds.idea')
      : note.kind === 'log'
        ? t('project.kinds.log')
        : t('project.noteWord')

  return (
    <div className={`knowledge-card ${note.pinned ? 'pinned' : ''}`}>
      <div className="knowledge-card-head">
        <span className={`kind-badge kind-${note.kind}`}>{kindLabel}</span>
        <button
          className={`pin-btn ${note.pinned ? 'pinned' : ''}`}
          onClick={() => onPin(note.id, note.pinned)}
          title={note.pinned ? t('project.unpinned') : t('project.pinned')}
        >
          ★
        </button>
      </div>
      <Link to={`/project/${note.project_id}`} className="knowledge-card-body">
        <div className="knowledge-card-title">{note.title || stripMarkdown(note.content, 40)}</div>
        <div className="knowledge-card-snippet markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(stripMarkdown(note.content, 120)) }} />
        <div className="knowledge-card-foot">
          <span className="knowledge-project-name">{note.project_name}</span>
          <span className="knowledge-time">{note.updated_at.slice(0, 10)}</span>
        </div>
      </Link>
      {tags.length > 0 && (
        <div className="knowledge-card-tags">
          {tags.map(t => <span key={t} className="knowledge-tag" onClick={() => onSelectTag(t)}>#{t}</span>)}
        </div>
      )}
      <button
        className="btn btn-secondary btn-sm"
        style={{ marginTop: 8, alignSelf: 'flex-start' }}
        onClick={() => onExport(note.id)}
        disabled={exporting}
        title={t('knowledge.exportMd')}
      >
        {exporting ? t('knowledge.copying') : t('knowledge.exportMd')}
      </button>
    </div>
  )
}
