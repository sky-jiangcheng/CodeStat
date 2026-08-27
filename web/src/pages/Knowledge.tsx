import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { stripMarkdown } from '../utils/markdown'
import DOMPurify from 'dompurify'
import KnowledgeCard from './knowledge/KnowledgeCard'
import ErrorBanner from '../components/ErrorBanner'
import { useKnowledgePage } from '../hooks/useKnowledgePage'

function KnowledgePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    notes, tags, loading, error, query, hits, kindFilter, activeTag,
    pinnedOnly, importing, message, newNotePicker, exportingId,
    filtered, projectNames, pinnedCount, recentNotes,
    setKindFilter, setActiveTag, setPinnedOnly, setNewNotePicker,
    handleSearchInput, handlePin, handleExport, handleImport, fetchAll,
  } = useKnowledgePage()

  const handleQuickCreate = () => {
    if (projectNames.length === 0) {
      // flash message via hook would be better, but for now inline
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
        <ErrorBanner message={error} onRetry={() => void fetchAll()} />
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
          placeholder={t('knowledge.searchPlaceholder')}
          aria-label={t('knowledge.searchAria')}
          className="form-input knowledge-search-input"
          autoFocus
        />
        {query && <span className="search-hint">{t('knowledge.searchHint')}</span>}
      </div>

      {hits !== null ? (
        <div className="knowledge-section">
          <div className="section-header">
            <h2>{t('knowledge.searchResults')} ({hits.length})</h2>
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
