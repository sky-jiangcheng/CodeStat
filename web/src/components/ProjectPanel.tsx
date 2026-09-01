import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TodoSection from './TodoSection'
import NoteSection from './NoteSection'

interface Props {
  projectId: number
  autoNewNote?: boolean
}

function ProjectPanel({ projectId, autoNewNote = false }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="side-panel">
      <button
        className="btn btn-sm btn-block side-quick-note"
        onClick={() => navigate(`/project/${projectId}?newNote=1`)}
      >
        {t('project.quickNote')}
      </button>
      <TodoSection projectId={projectId} />
      <NoteSection projectId={projectId} autoNew={autoNewNote} />
    </div>
  )
}

export default ProjectPanel
