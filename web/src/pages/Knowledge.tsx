import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  listAllNotes, listAllTags, searchAll, pinNote, importClaudeMemory, exportNoteAsMarkdown,
  type NoteWithProject, type SearchHit,
} from '../api/client'
import { stripMarkdown, parseTags } from '../utils/markdown'
import DOMPurify from 'dompurify'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback'
import KnowledgeCard from './knowledge/KnowledgeCard'
import { usePageMeta } from '../utils/seo'

type KindFilter = 'all' | 'knowledge' | 'other'

function KnowledgePage() {
  const { t } = useTranslation()
  usePageMeta({ title: `${t('knowledge.title')} - GitBuddy`, description: 'GitBuddy 跨项目知识库：Markdown 笔记、标签、置顶与全文搜索。', path: '/knowledge' })
  const navigate = useNavigate()
  const [notes, setNotes] = useState<NoteWithProject[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [pinnedOnly, setPinnedOnly] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [newNotePicker, setNewNotePicker] = useState(false)
  const [askMode, setAskMode] = useState(false)
  const [exportingId, setExportingId] = useState<number | null>(null)

  const flashMessage = useCallback((msg: string, ms = 3000) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), ms)
  }, [])

  const handleQuickCreate = () => {
    if (projectNames.length === 0) {
      flashMessage(t('knowledge.noProjectsMsg'), 4000)
      return
    }
    if (projectNames.length === 1) {
      navigate(`/project/${projectNames[0][1]}?newNote=1`)
      return
    }
    setNewNotePicker(v => !v)
  }

  const pickProject = (id: number) => {
    setNewNotePicker(false)
    navigate(`/project/${id}?newNote=1`)
  }

  const fetchAll = useCallback(() => {
    setError('')
    Promise.all([listAllNotes(), listAllTags()])
      .then(([n, tg]) => { setNotes(n); setTags(tg) })
      .catch((e: unknown) => { setError(e instanceof Error ? e.message : t('common.failed')) })
      .finally(() => setLoading(false))
  }, [t])

  useEffect(() => { fetchAll() }, [fetchAll])

  // One debounced runner serves both list search and ask mode.
  const runSearch = useDebouncedCallback((q: string, ask: boolean) => {
    if (!q.trim()) { setHits(null); return }
    searchAll(q.trim())
      .then(h => { setHits(h); if (ask) setAskMode(true) })
      .catch(() => { setHits([]); if (ask) setAskMode(true) })
  }, 300)

  const handleSearchInput = (q: string) => {
    setQuery(q)
    runSearch(q, askMode)
  }

  const handlePin = async (id: number, pinned: boolean) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !pinned } : n))
    try { await pinNote(id, !pinned) } catch { setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned } : n)) }
  }

  const handleExport = async (id: number) => {
    setExportingId(id)
    try {
      const md = await exportNoteAsMarkdown(id)
      if (!md) return
      await navigator.clipboard.writeText(md)
      flashMessage(t('knowledge.copiedMd'))
    } catch (e) {
      flashMessage(t('knowledge.exportFailed') + (e instanceof Error ? e.message : t('common.unknownError')))
    } finally {
      setExportingId(null)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const r = await importClaudeMemory()
      setMessage(t('knowledge.importDone', { created: r.synced, updated: r.updated, skipped: r.skipped }))
      fetchAll()
    } catch (e) {
      setMessage(t('knowledge.importFailed') + (e instanceof Error ? e.message : t('common.unknownError')))
    } finally {
      setImporting(false)
      setTimeout(() => setMessage(''), 4000)
    }
  }

  const filtered = useMemo(() => {
    let list = notes
    if (kindFilter === 'knowledge') list = list.filter(n => n.kind === 'knowledge')
    else if (kindFilter === 'other') list = list.filter(n => n.kind !== 'knowledge')
    if (activeTag) list = list.filter(n => parseTags(n.tags).includes(activeTag))
    if (pinnedOnly) list = list.filter(n => n.pinned)
    return list
  }, [notes, kindFilter, activeTag, pinnedOnly])

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const projectNames = useMemo(() => {
    const set = new Map<string, number>()
    notes.forEach(n => set.set(n.project_name, n.project_id))
    return Array.from(set.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [notes])

  const pinnedCount = useMemo(() => notes.filter(n => n.pinned).length, [notes])

  const recentNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 5)
  }, [notes])

  if (loading) {
    return (
      <div className="knowledge">
        <h1>{t('knowledge.title')}</h1>
        <div className="skeleton skeleton-text" style={{ width: '100%', height: 48, marginBottom: 12 }} />
        <div className="skeleton skeleton-text" style={{ width: '100%', height: 80 }} />
        <div className="skeleton skeleton-text" style={{ width: '100%', height: 80, marginTop: 12 }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="knowledge">
        <h1>{t('knowledge.title')}</h1>
        <div className="error-banner">
          <span>{error}</span>
          <button className="btn btn-sm" onClick={() => void fetchAll()}>{t('common.retry')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="knowledge">
      <div className="page-head">
        <div>
          <h1>{t('knowledge.title')}</h1>
          <p className="page-sub">{t('knowledge.desc', { count: notes.length })}</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-primary btn-sm" onClick={handleQuickCreate}>
            {t('knowledge.quickCreate')}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleImport} disabled={importing}>
            {importing ? t('knowledge.importing') : t('knowledge.importClaude')}
          </button>
        </div>
      </div>

      {newNotePicker && (
        <div className="new-note-picker">
          <div className="new-note-picker-title">{t('knowledge.selectProject')}</div>
          <div className="new-note-picker-list">
            {projectNames.map(([name, id]) => (
              <button key={id} className="new-note-picker-item" onClick={() => pickProject(id)}>
                <span className="hit-project">{name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {message && <div className="message-banner">{message}</div>}

      <div className="knowledge-search" role="search" aria-label={t('knowledge.searchAria')}>
        <input
          type="text"
          value={query}
          onChange={e => handleSearchInput(e.target.value)}
          placeholder={askMode ? t('knowledge.searchAskPlaceholder') : t('knowledge.searchPlaceholder')}
          aria-label={t('knowledge.searchAria')}
          className="form-input knowledge-search-input"
          autoFocus
        />
        {query && <span className="search-hint">{t('knowledge.searchHint')}</span>}
      </div>

      {hits !== null ? (
        <div className="knowledge-section">
          <div className="section-header">
            <h2>{t('knowledge.searchResults')} ({hits.length}) {askMode && <span className="hit-project">（{t('knowledge.localSearch')}）</span>}</h2>
          </div>
          {hits.length === 0 ? (
            <p className="empty-hint">{t('knowledge.noResults')}</p>
          ) : (
            <div className="hit-list">
              {hits.map(h => (
                <Link
                  key={`${h.type}-${h.id}`}
                  to={`/project/${h.project_id}`}
                  className="hit-item"
                >
                  <div className="hit-head">
                    <span className={`hit-type hit-type-${h.type}`}>{h.type === 'note' ? t('dashboard.noteType') : t('summaryBar.todos')}</span>
                    <span className="hit-project">{h.project_name}</span>
                  </div>
                  <div className="hit-title">{h.title}</div>
                  <div className="hit-snippet" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(h.snippet) }} />
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {recentNotes.length > 0 && (
            <div className="knowledge-section recent-section">
              <div className="section-header">
                <h2>{t('knowledge.recent')}</h2>
              </div>
              <div className="recent-list">
                {recentNotes.map(n => (
                  <Link key={n.id} to={`/project/${n.project_id}`} className="recent-item">
                    <span className="recent-title">{n.title || stripMarkdown(n.content, 40)}</span>
                    <span className="recent-project">{n.project_name}</span>
                    <span className="recent-time">{n.updated_at.slice(0, 10)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="knowledge-filters">
            <div className="filter-toggle">
              <button className={`filter-btn ${kindFilter === 'all' ? 'active' : ''}`} onClick={() => setKindFilter('all')}>{t('knowledge.all')}</button>
              <button className={`filter-btn ${kindFilter === 'knowledge' ? 'active' : ''}`} onClick={() => setKindFilter('knowledge')}>{t('knowledge.knowledge')}</button>
              <button className={`filter-btn ${kindFilter === 'other' ? 'active' : ''}`} onClick={() => setKindFilter('other')}>{t('knowledge.other')}</button>
            </div>
            <button
              className={`filter-btn ${pinnedOnly ? 'active pinned-active' : ''}`}
              onClick={() => setPinnedOnly(v => !v)}
              title={t('knowledge.pinnedOnly')}
            >
              ★ {t('knowledge.pinnedOnly')} {pinnedCount}
            </button>
          </div>

          {tags.length > 0 && (
            <div className="tag-chips">
              <button
                className={`tag-chip ${activeTag === null ? 'tag-chip-active' : ''}`}
                onClick={() => setActiveTag(null)}
              >
                {t('knowledge.allTags')}
              </button>
              {tags.map(tg => (
                <button
                  key={tg}
                  className={`tag-chip ${activeTag === tg ? 'tag-chip-active' : ''}`}
                  onClick={() => setActiveTag(activeTag === tg ? null : tg)}
                >
                  #{tg}
                </button>
              ))}
            </div>
          )}

          <div className="knowledge-section">
            <div className="section-header">
              <h2>{t('knowledge.notes')} ({filtered.length})</h2>
            </div>

            {projectNames.length > 0 && (
              <div className="project-jump">
                <span className="project-jump-label">{t('knowledge.jumpProject')}</span>
                {projectNames.slice(0, 8).map(([name, id]) => (
                  <Link key={id} to={`/project/${id}`} className="project-jump-item" title={name}>{name}</Link>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              notes.length === 0 ? (
                <div className="empty-state large">
                  <div className="empty-icon">📝</div>
                  <h3>{t('knowledge.startBrain')}</h3>
                  <p>{t('knowledge.startBrainMsg')}</p>
                  <div className="empty-actions">
                    <button className="btn btn-primary" onClick={handleQuickCreate}>
                      {t('knowledge.createNote')}
                    </button>
                    <button className="btn btn-secondary" onClick={handleImport} disabled={importing}>
                      {importing ? t('knowledge.importing') : t('knowledge.importClaude')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-state small">
                  <div className="empty-icon">🔍</div>
                  <h3>{t('knowledge.noMatch')}</h3>
                  <p>{t('knowledge.adjustMsg')}</p>
                </div>
              )
            ) : (
              <div className="note-grid">
                {filtered.map(n => (
                  <KnowledgeCard
                    key={n.id}
                    note={n}
                    exporting={exportingId === n.id}
                    onPin={handlePin}
                    onExport={handleExport}
                    onSelectTag={setActiveTag}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default KnowledgePage
