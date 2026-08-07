import TodoSection from './TodoSection'
import NoteSection from './NoteSection'

interface Props {
  projectId: number
  autoNewNote?: boolean
}

function ProjectPanel({ projectId, autoNewNote = false }: Props) {
  return (
    <div className="side-panel">
      <TodoSection projectId={projectId} />
      <NoteSection projectId={projectId} autoNew={autoNewNote} />
    </div>
  )
}

export default ProjectPanel
