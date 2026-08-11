import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getProjects, getSummary, triggerScan, getTodoCounts, getNoteCounts, searchAll, searchProjects,
  getScanStatus, toggleStar, refreshProjectHistory, getConfig, Project, Summary, TodoCount, NoteCount, SearchHit,
} from '../api/client'
import SummaryBar from '../components/SummaryBar'
import GoalRing from '../components/GoalRing'
import Heatmap from '../components/Heatmap'
import StatusBar from '../components/StatusBar'
import DatePicker from '../components/DatePicker'
import ProjectCard from '../components/ProjectCard'
import { usePageMeta } from '../utils/seo'

function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

type SortKey = 'name' | 'my_added' | 'my_files' | 'repo_count'

const getSortOptions = () => {
  const { t } = useTranslation()
  return [
    { key: 'name', label: t('dashboard.sortName', { defaultValue: 'Name' }) },
    { key: 'my_added', label: t('dashboard.sortMyAdded', { defaultValue: 'Lines Added' }) },
    { key: 'my_files', label: t('dashboard.sortMyFiles', { defaultValue: 'Files Changed' }) },
    { key: 'repo_count', label: t('dashboard.sortRepos', { defaultValue: 'Repo Count' }) },
  ]
}

function Dashboard() {
  const { t } = useTranslation()
  usePageMeta({ title: t('dashboard.title') + ' - GitBuddy', description: 'GitBuddy Dashboard: daily commit stats, goal progress, heatmap and project trends.', path: '/dashboard' })
  const [projects, setProjects] = useState<Project[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [dailyGoal, setDailyGoal] = useState(500)
  const [date, setDate] = useState(getYesterday())
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [scanDoneMsg, setScanDoneMsg] = useState('')
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('my_added')
  const [confirmScan, setConfirmScan] = useState(false)
  const [todoCounts, setTodoCounts] = useState<TodoCount[]>([])
  const [noteCounts, setNoteCounts] = useState<NoteCount[]>([])
  const [showStarredOnly, setShowStarredOnly] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchHit[] | null>(null)
  const [searchProjectsResults, setSearchProjectsResults] = useState<Project[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchingProjects, setSearchingProjects] = useState(false)
  const pollTimer = useRef<number | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const fetchData = async (selectedDate: string, starredOnly = showStarredOnly) => {
    setLoading(true)
    setError('')
    try {
      const [projData, sumData, counts, noteCountsData] = await Promise.all([
        getProjects(selectedDate, starredOnly),
        getSummary(selectedDate),
        getTodoCounts(),
        getNoteCounts(),
      ])
      setProjects(projData)
      setSummary(sumData)
      setTodoCounts(counts)
      setNoteCounts(noteCountsData)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.failed', { defaultValue: 'Failed' }))
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkScanStatus = useCallback(async () => {
    try {
      const status = await getScanStatus()
      if (status.running || status.backfilling) {
        setScanning(true)
        setScanMsg(status.message)
        if (!pollTimer.current) {
          pollTimer.current = window.setInterval(async () => {
            const s = await getScanStatus()
            if (!s.running && !s.backfilling) {
              if (pollTimer.current) clearInterval(pollTimer.current)
              pollTimer.current = null
              setScanning(false)
              setScanMsg('')
              setScanDoneMsg(t('dashboard.scanDone', { defaultValue: 'Scan complete' }))
              fetchData(date, showStarredOnly)
            } else {
              setScanMsg(s.message)
            }
          }, 2000)
        }
      }
    } catch { /* ignore */ }
  }, [date, showStarredOnly])

  useEffect(() => {
    getConfig()
      .then(c => {
        const v = parseInt(c.config.daily_code_standard || '500', 10)
        if (!isNaN(v) && v > 0) setDailyGoal(v)
      })
      .catch(() => {})
    fetchData(date, showStarredOnly)
    checkScanStatus()
    return () => { if (pollTimer.current) clearInterval(pollTimer.current) }
  }, [date, showStarredOnly, checkScanStatus])

  const handleScan = async () => {
    setConfirmScan(false)
    setError('')
    try {
      await triggerScan()
      setScanning(true)
      setScanMsg(t('dashboard.scanning', { defaultValue: 'Scanning repos…' }))
      setScanDoneMsg('')
      if (pollTimer.current) clearInterval(pollTimer.current)
      pollTimer.current = window.setInterval(async () => {
        const s = await getScanStatus()
        if (!s.running && !s.backfilling) {
          if (pollTimer.current) clearInterval(pollTimer.current)
          pollTimer.current = null
          setScanning(false)
          setScanMsg('')
          setScanDoneMsg(t('dashboard.scanDone', { defaultValue: 'Scan complete' }))
          fetchData(date, showStarredOnly)
        } else {
          setScanMsg(s.message)
        }
      }, 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('settings.rescanFailed', { defaultValue: 'Scan failed' }))
    }
  }

  const handleToggleStar = async (projectId: number) => {
    try {
      const newStarred = await toggleStar(projectId)
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, is_starred: newStarred } : p))
      if (searchProjectsResults) {
        setSearchProjectsResults(prev => prev?.map(p => p.id === projectId ? { ...p, is_starred: newStarred } : p) ?? null)
      }
      if (showStarredOnly && !newStarred) {
        setProjects(prev => prev.filter(p => p.id !== projectId))
      }
      if (newStarred) {
        setProjects(prev => {
          if (prev.some(p => p.id === projectId)) return prev
          const found = searchProjectsResults?.find(p => p.id === projectId)
          if (!found) return prev
          return [...prev, found as Project]
        })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.failed', { defaultValue: 'Operation failed' }))
    }
  }

  const handleRefreshHistory = useCallback(async (projectId: number) => {
    try {
      await refreshProjectHistory(projectId)
      await fetchData(date, showStarredOnly)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.failed', { defaultValue: 'Refresh failed' }))
    }
  }, [date, showStarredOnly])

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults(null); setSearching(false); return }
    setSearching(true)
    try {
      const results = await searchAll(query)
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSearchProjects = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchProjectsResults(null); setSearchingProjects(false); return }
    setSearchingProjects(true)
    try {
      const results = await searchProjects(query)
      setSearchProjectsResults(results)
    } catch {
      setSearchProjectsResults([])
    } finally {
      setSearchingProjects(false)
    }
  }, [])

  // Debounced search wrapper with proper cleanup
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const handleSearchDebounced = useCallback((query: string) => {
    setSearchQuery(query)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { 
      setSearchResults(null)
      setSearchProjectsResults(null)
      setSearching(false)
      setSearchingProjects(false)
      return 
    }
    setSearching(true)
    setSearchingProjects(true)
    debounceRef.current = setTimeout(() => {
      handleSearch(query)
      handleSearchProjects(query)
    }, 300)
  }, [handleSearch, handleSearchProjects])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        setSearchResults(null)
        setSearchProjectsResults(null)
        setSearchQuery('')
        setSearching(false)
        setSearchingProjects(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const sorted = useMemo(() => {
    const list = projects
      .filter(p => {
        if (showStarredOnly) return !!p.is_starred
        // Numeric fields: || 0 guards so undefined/'' never become NaN in > comparisons.
        const myAdded = p.my_added || 0
        const myDeleted = p.my_deleted || 0
        const myFiles = p.my_files || 0
        const totalAdded = p.total_added || 0
        const totalDeleted = p.total_deleted || 0
        const hasActivity = myAdded > 0 || myDeleted > 0 || myFiles > 0
        const hasTeamActivity = totalAdded > 0 || totalDeleted > 0
        const hasRepos = (p.repo_count || 0) > 0
        return hasActivity || hasTeamActivity || hasRepos || !!p.is_starred
      })
      .sort((a, b) => {
        switch (sortKey) {
          case 'name': return a.name.localeCompare(b.name)
          case 'my_added': return (b.my_added || 0) - (a.my_added || 0)
          case 'my_files': return (b.my_files || 0) - (a.my_files || 0)
          case 'repo_count': return (b.repo_count || 0) - (a.repo_count || 0)
          default: return 0
        }
      })
    return list
  }, [projects, sortKey, showStarredOnly])

  const starredProjects = useMemo(() => sorted.filter(p => p.is_starred), [sorted])
  const unstarredProjects = useMemo(() => sorted.filter(p => !p.is_starred), [sorted])

  const todoMap = useMemo(() => {
    const map = new Map<number, number>()
    todoCounts.forEach(c => map.set(c.project_id, c.count))
    return map
  }, [todoCounts])

  const noteMap = useMemo(() => {
    const map = new Map<number, number>()
    noteCounts.forEach(c => map.set(c.project_id, c.count))
    return map
  }, [noteCounts])

  const globalTodoCount = useMemo(() => todoCounts.reduce((sum, c) => sum + c.count, 0), [todoCounts])

  const myAdded = summary?.my_added || 0
  const isWorkday = summary?.is_workday ?? false

  return (
    <div className="dashboard">
      <h1 className="visually-hidden">{t('dashboard.title')}</h1>
      <div className="visually-hidden" role="status" aria-live="polite">
              {scanning ? (scanMsg || t('dashboard.scanning')) : scanDoneMsg}
      </div>
      <div className="dashboard-fixed">
        <div className="hero-row">
          <div className="hero-card">
            <GoalRing
              value={myAdded}
              goal={isWorkday ? dailyGoal : 0}
              label={isWorkday ? t('dashboard.todayGoal') : t('dashboard.notWorkday')}
              sublabel={isWorkday ? `${myAdded} / ${dailyGoal} ${t('dashboard.lines', { defaultValue: 'lines' })}` : `${myAdded} ${t('dashboard.lines', { defaultValue: 'lines' })}`}
            />
            <div className="hero-text">
              <div className="hero-eyebrow">{date} · {isWorkday ? t('dashboard.workday') : t('dashboard.weekend')}</div>
              <div className="hero-title">
                {isWorkday
                  ? (myAdded >= dailyGoal ? t('dashboard.goalReached') : t('dashboard.goalMissing', { needed: Math.max(dailyGoal - myAdded, 0) }))
                  : t('dashboard.weekend')}
              </div>
              <div className="hero-sub">
                {t('dashboard.personalAdded')} <strong className="green">+{myAdded}</strong> ·
                {t('dashboard.files')} <strong>{summary?.my_files || 0}</strong> ·
                {t('dashboard.repos')} <strong>{summary?.repo_count || 0}</strong>
              </div>
            </div>
          </div>

          <SummaryBar summary={summary} globalTodoCount={globalTodoCount} />
        </div>

        <Heatmap onDayClick={setDate} />

        <div className="dashboard-controls">
          <DatePicker value={date} onChange={setDate} />
          <div className="dashboard-actions">
              <div className="search-box" ref={searchRef} role="search" aria-label={t('dashboard.searchAria')}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchDebounced(e.target.value)}
placeholder={t('dashboard.searchPlaceholder')}
aria-label={t('dashboard.searchAria')}
                className="form-input search-input"
              />
              {searchResults !== null && (
                <div className="search-dropdown">
                  {searching || searchingProjects ? (
                    <div className="search-loading">{t('dashboard.searching')}</div>
                  ) : searchResults.length === 0 && (!searchProjectsResults || searchProjectsResults.length === 0) ? (
                    <div className="search-empty">{t('dashboard.noResults')}</div>
                  ) : (
                    <>
                      {searchProjectsResults && searchProjectsResults.length > 0 && (
                        <div className="search-group">
                          <div className="search-group-header">{t('dashboard.projectsLabel')}</div>
                          {searchProjectsResults.map(p => (
                            <div key={`project-${p.id}`} className="search-result-item search-result-project-item">
                              <button
                                className={`card-star ${p.is_starred ? 'starred' : ''}`}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleStar(p.id) }}
                                title={p.is_starred ? t('project.unstar', { defaultValue: 'Unstar project' }) : t('project.star', { defaultValue: 'Star project' })}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill={p.is_starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              </button>
                              <a href={`/project/${p.id}`} className="search-project-name">
                                {p.name}
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchResults.length > 0 && (
                        <div className="search-group">
                          <div className="search-group-header">{t('dashboard.notesTodosLabel')}</div>
                          {searchResults.map(h => (
                            <a key={`${h.type}-${h.id}`} href={`/project/${h.project_id}`} className="search-result-item">
                              <div className="search-result-header">
                                <span className={`hit-type-mini hit-type-${h.type}`}>{h.type === 'note' ? t('dashboard.note') : t('dashboard.todo')}</span>
                                <span className="search-result-project">{h.project_name}</span>
                              </div>
                              <div className="search-result-title">{h.title}</div>
                              <div className="search-result-preview">{h.snippet}</div>
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="filter-toggle">
              <button className={`filter-btn ${!showStarredOnly ? 'active' : ''}`} onClick={() => setShowStarredOnly(false)}>{t('dashboard.all')}</button>
              <button className={`filter-btn ${showStarredOnly ? 'active' : ''}`} onClick={() => setShowStarredOnly(true)}>{t('dashboard.starred')}</button>
            </div>
            <div className="sort-control">
              <label htmlFor="dashboard-sort">{t('dashboard.sort')}</label>
              <select id="dashboard-sort" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="form-input sort-select">
                {getSortOptions().map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
              </select>
            </div>
            {confirmScan ? (
              <div className="confirm-group">
                <span className="confirm-text">{t('dashboard.confirmRescan')}</span>
                <button className="btn btn-primary btn-sm" onClick={handleScan} disabled={scanning}>{t('confirm', { defaultValue: 'Confirm' })}</button>
                <button className="btn btn-sm" onClick={() => setConfirmScan(false)}>{t('cancel', { defaultValue: 'Cancel' })}</button>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={() => setConfirmScan(true)} disabled={scanning}>
                {scanning ? (scanMsg || t('dashboard.scanning')) : t('dashboard.rescan')}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button className="btn btn-sm" onClick={() => fetchData(date)}>{t('dashboard.retry')}</button>
          </div>
        )}
      </div>

      <div className="dashboard-scroll">
        {loading ? (
          <div className="project-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="project-card skeleton-card">
                <div className="card-header">
                  <div className="skeleton skeleton-text" style={{ width: '60%', height: 20 }} />
                </div>
                <div className="card-grid">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="card-stat">
                      <div className="skeleton skeleton-text" style={{ width: 32, height: 10 }} />
                      <div className="skeleton skeleton-text" style={{ width: 40, height: 16 }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{showStarredOnly ? '⭐' : '🔍'}</div>
            <h3>{showStarredOnly ? t('dashboard.starredOnly') : t('dashboard.noProjects')}</h3>
            <p>
              {showStarredOnly
                ? t('dashboard.starMsg')
                : t('dashboard.scanMsg')}
            </p>
            <div className="empty-actions">
              {showStarredOnly ? (
                <button className="btn btn-primary" onClick={() => setShowStarredOnly(false)}>{t('dashboard.viewAll')}</button>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={() => setConfirmScan(true)}>{t('dashboard.startScan')}</button>
                  <a href="/settings" className="btn btn-secondary">{t('dashboard.configDir')}</a>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {starredProjects.length > 0 && (
              <div className="project-section">
                <div className="project-section-header">
                  <h2 className="project-section-title">{t('dashboard.starredRepos')}</h2>
                  <span className="project-section-count">{starredProjects.length}</span>
                </div>
                <div className="project-grid">
                  {starredProjects.map(p => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      date={date}
                      todoCount={todoMap.get(p.id)}
                      noteCount={noteMap.get(p.id)}
                      dailyGoal={isWorkday ? dailyGoal : 0}
                      isWorkday={isWorkday}
                      onToggleStar={handleToggleStar}
                      onRefreshHistory={handleRefreshHistory}
                    />
                  ))}
                </div>
              </div>
            )}

            {unstarredProjects.length > 0 && (
              <div className="project-section">
                <div className="project-section-header">
                  <h2 className="project-section-title">{t('dashboard.otherRepos')}</h2>
                  <span className="project-section-count">{unstarredProjects.length}</span>
                </div>
                <div className="project-grid project-grid-minimal">
                  {unstarredProjects.map(p => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      date={date}
                      onToggleStar={handleToggleStar}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <StatusBar />
    </div>
  )
}

export default Dashboard
