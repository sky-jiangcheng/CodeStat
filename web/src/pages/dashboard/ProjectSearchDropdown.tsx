import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { searchAll, searchProjects, type Project, type SearchHit } from '../../api/client'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'

interface Props {
  /** Toggles the star server-side and resolves to the new starred state. */
  onToggleStar: (projectId: number) => Promise<boolean>
}

/**
 * The dashboard omnibox: debounced federated search across repositories and
 * notes/todos with a click-outside dropdown.
 */
export default function ProjectSearchDropdown({ onToggleStar }: Props) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [noteHits, setNoteHits] = useState<SearchHit[] | null>(null)
  const [projectHits, setProjectHits] = useState<Project[] | null>(null)
  const [searching, setSearching] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const runSearch = useDebouncedCallback((q: string) => {
    if (!q.trim()) {
      setNoteHits(null)
      setProjectHits(null)
      setSearching(false)
      return
    }
    Promise.all([
      searchAll(q).catch(() => [] as SearchHit[]),
      searchProjects(q).catch(() => [] as Project[]),
    ]).then(([hits, projects]) => {
      setNoteHits(hits)
      setProjectHits(projects)
      setSearching(false)
    })
  }, 300)

  const onChange = useCallback((q: string) => {
    setQuery(q)
    if (q.trim()) setSearching(true)
    runSearch(q)
  }, [runSearch])

  const reset = useCallback(() => {
    setQuery('')
    setNoteHits(null)
    setProjectHits(null)
    setSearching(false)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) reset()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [reset])

  const handleToggleStar = async (projectId: number) => {
    try {
      const starred = await onToggleStar(projectId)
      setProjectHits(prev => prev?.map(p => p.id === projectId ? { ...p, is_starred: starred } : p) ?? null)
    } catch { /* parent surfaces errors */ }
  }

  return (
    <div className="search-box" ref={boxRef} role="search" aria-label={t('dashboard.searchAria')}>
      <input
        type="text"
        value={query}
        onChange={e => onChange(e.target.value)}
        placeholder={t('dashboard.searchPlaceholder')}
        aria-label={t('dashboard.searchAria')}
        className="form-input search-input"
      />
      {noteHits !== null && (
        <div className="search-dropdown">
          {searching ? (
            <div className="search-loading">{t('dashboard.searching')}</div>
          ) : noteHits.length === 0 && (!projectHits || projectHits.length === 0) ? (
            <div className="search-empty">{t('dashboard.noMatches')}</div>
          ) : (
            <>
              {projectHits && projectHits.length > 0 && (
                <div className="search-group">
                  <div className="search-group-header">{t('dashboard.groupRepos')}</div>
                  {projectHits.map(p => (
                    <div key={`project-${p.id}`} className="search-result-item search-result-project-item">
                      <button
                        className={`card-star ${p.is_starred ? 'starred' : ''}`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleToggleStar(p.id) }}
                        title={p.is_starred ? t('project.unstar') : t('project.star')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={p.is_starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                      <Link to={`/project/${p.id}`} className="search-project-name">
                        {p.name}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
              {noteHits.length > 0 && (
                <div className="search-group">
                  <div className="search-group-header">{t('dashboard.groupNotesTodos')}</div>
                  {noteHits.map(h => (
                    <Link key={`${h.type}-${h.id}`} to={`/project/${h.project_id}`} className="search-result-item">
                      <div className="search-result-header">
                        <span className={`hit-type-mini hit-type-${h.type}`}>{h.type === 'note' ? t('dashboard.noteType') : t('summaryBar.todos')}</span>
                        <span className="search-result-project">{h.project_name}</span>
                      </div>
                      <div className="search-result-title">{h.title}</div>
                      <div className="search-result-preview">{h.snippet}</div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
