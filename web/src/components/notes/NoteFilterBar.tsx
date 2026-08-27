import type { KindFilter } from '../../types/kind'

interface NoteFilterBarProps {
  filter: KindFilter
  setFilter: (f: KindFilter) => void
  notesCount: number
  t: (key: string, params?: Record<string, unknown>) => string
}

/** Filter bar with All / Knowledge / Other buttons. Hidden when there are no notes. */
export default function NoteFilterBar({ filter, setFilter, notesCount, t }: NoteFilterBarProps) {
  if (notesCount === 0) return null
  return (
    <div className="note-filters">
      <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>{t('project.filterAll')}</button>
      <button className={`filter-btn ${filter === 'knowledge' ? 'active' : ''}`} onClick={() => setFilter('knowledge')}>{t('project.kinds.knowledge')}</button>
      <button className={`filter-btn ${filter === 'other' ? 'active' : ''}`} onClick={() => setFilter('other')}>{t('project.kinds.other')}</button>
    </div>
  )
}
