import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  getProjects, getSummary, triggerScan, getTodoCounts, getNoteCounts, toggleStar,
  refreshProjectHistory, getConfig, type Summary, type TodoCount, type NoteCount,
} from '../api/client'
import SummaryBar from '../components/SummaryBar'
import GoalRing from '../components/GoalRing'
import Heatmap from '../components/Heatmap'
import StatusBar from '../components/StatusBar'
import DatePicker from '../components/DatePicker'
import ProjectCard from '../components/ProjectCard'
import ProjectSearchDropdown from './dashboard/ProjectSearchDropdown'
import ErrorBanner from '../components/ErrorBanner'
import { useScanPolling } from '../hooks/useScanPolling'
import { useApiData, invalidateCache } from '../hooks/useApiData'
import { getYesterday } from '../utils/dates'
import { usePageMeta } from '../utils/seo'

type SortKey = 'name' | 'my_added' | 'my_files' | 'repo_count'

function Dashboard() {
  const { t } = useTranslation()
  usePageMeta({ title: `${t('dashboard.title')} - GitBuddy`, description: 'GitBuddy Dashboard: daily commit stats, goal progress, heatmap and project trends.', path: '/dashboard' })
  const [summary, setSummary] = useState<Summary | null>(null)
  const [dailyGoal, setDailyGoal] = useState(500)
  const [date, setDate] = useState(getYesterday())
  const [sortKey, setSortKey] = useState<SortKey>('my_added')
  const [confirmScan, setConfirmScan] = useState(false)
  const [todoCounts, setTodoCounts] = useState<TodoCount[]>([])
  const [noteCounts, setNoteCounts] = useState<NoteCount[]>([])
  const [showStarredOnly, setShowStarredOnly] = useState(true)
  const [error, setError] = useState('') // scan / star failures
  const [summaryError, setSummaryError] = useState('')
  const fetchSeq = useRef(0)

  // Projects are date-scoped (per-day stats drive the cards), so they use a
  // dedicated cache key — distinct from the shared `projects:all` list used by
  // NoteSection/CommandPalette. A star toggle invalidates `projects:all` so the
  // move-to-project dropdown and command palette never show a stale state.
  const { data: projectsData, loading: projectsLoading, error: projectsError, refetch: refetchProjects } =
    useApiData(() => getProjects(date, showStarredOnly), [date, showStarredOnly], { cacheKey: 'dashProjects' })

  // Optimistic star overlay: flips the UI instantly, reconciled by the cache
  // invalidation below (server is the source of truth).
  const [starOverride, setStarOverride] = useState<Record<number, boolean>>({})
  const projects = useMemo(
    () => (projectsData ?? []).map(p =>
      starOverride[p.id] !== undefined ? { ...p, is_starred: starOverride[p.id] } : p
    ),
    [projectsData, starOverride]
  )

  const [summaryLoading, setSummaryLoading] = useState(true)
  const loading = projectsLoading || summaryLoading
  const displayedError = error || projectsError || summaryError

  // Drop stale star overlays whenever the underlying project query changes.
  useEffect(() => { setStarOverride({}) }, [date, showStarredOnly])

  const fetchSummary = useCallback(async (selectedDate: string, silent = false) => {
    const seq = ++fetchSeq.current
    if (!silent) setSummaryLoading(true)
    setSummaryError('')
    try {
      const [sumData, counts, noteCountsData] = await Promise.all([
        getSummary(selectedDate),
        getTodoCounts(),
        getNoteCounts(),
      ])
      if (seq !== fetchSeq.current) return
      setSummary(sumData)
      setTodoCounts(counts)
      setNoteCounts(noteCountsData)
    } catch (e: unknown) {
      if (seq !== fetchSeq.current) return
      setSummaryError(e instanceof Error ? e.message : t('common.failed'))
    } finally {
      if (seq === fetchSeq.current && !silent) setSummaryLoading(false)
    }
  }, [t])

  const { scanning, message: scanMsg, doneMessage: scanDoneMsg, start: startScanPolling } = useScanPolling(
    () => { void fetchSummary(date); void refetchProjects() }
  )

  useEffect(() => {
    getConfig()
      .then(c => {
        const v = parseInt(c.config.daily_code_standard || '500', 10)
        if (!isNaN(v) && v > 0) setDailyGoal(v)
      })
      .catch(() => {})
    void fetchSummary(date) // eslint-disable-line react-hooks/set-state-in-effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, showStarredOnly])

  const handleScan = async () => {
    setConfirmScan(false)
    setError('')
    try {
      await triggerScan()
      startScanPolling(t('dashboard.scanning', { defaultValue: 'Scanning repos…' }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('settings.rescanFailed', { defaultValue: 'Scan failed' }))
    }
  }

  const handleToggleStar = async (projectId: number): Promise<boolean> => {
    const current = projects.find(p => p.id === projectId)?.is_starred ?? false
    const optimistic = !current
    setStarOverride(prev => ({ ...prev, [projectId]: optimistic }))
    try {
      const newStarred = await toggleStar(projectId)
      setStarOverride(prev => ({ ...prev, [projectId]: newStarred }))
      // Refresh the shared base list so NoteSection/CommandPalette reflect it.
      invalidateCache('projects:all')
      return newStarred
    } catch (e: unknown) {
      setStarOverride(prev => { const n = { ...prev }; delete n[projectId]; return n })
      setError(e instanceof Error ? e.message : t('common.failed'))
      throw e
    }
  }

  const handleRefreshHistory = useCallback(async (projectId: number) => {
    try {
      await refreshProjectHistory(projectId)
      await fetchSummary(date, true)
      await refetchProjects()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.failed'))
    }
  }, [date, showStarredOnly, fetchSummary, t])

  const sortOptions = useMemo(() => [
    { key: 'name' as const, label: t('dashboard.sortName', { defaultValue: 'Name' }) },
    { key: 'my_added' as const, label: t('dashboard.sortMyAdded', { defaultValue: 'Lines Added' }) },
    { key: 'my_files' as const, label: t('dashboard.sortMyFiles', { defaultValue: 'Files Changed' }) },
    { key: 'repo_count' as const, label: t('dashboard.sortRepos', { defaultValue: 'Repo Count' }) },
  ], [t])

  const sorted = useMemo(() => {
    return projects
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
        {scanning ? (scanMsg || t('dashboard.scanning', { defaultValue: 'Scanning…' })) : scanDoneMsg}
      </div>
      <div className="dashboard-fixed">
        <div className="hero-row">
          <div className="hero-card">
            <GoalRing
              value={myAdded}
              goal={isWorkday ? dailyGoal : 0}
              label={isWorkday ? t('dashboard.todayGoal', { defaultValue: "Today's Goal" }) : t('dashboard.notWorkday', { defaultValue: 'Not a workday' })}
              sublabel={isWorkday ? `${myAdded} / ${dailyGoal} ${t('dashboard.linesUnit')}` : `${myAdded} ${t('dashboard.linesUnit')}`}
            />
            <div className="hero-text">
              <div className="hero-eyebrow">{date} · {isWorkday ? t('dashboard.workday', { defaultValue: 'Workday' }) : t('dashboard.weekendShort')}</div>
              <div className="hero-title">
                {isWorkday
                  ? (myAdded >= dailyGoal ? t('dashboard.goalReached', { defaultValue: "Today's goal reached 🎉" }) : t('dashboard.goalRemaining', { count: Math.max(dailyGoal - myAdded, 0) }))
                  : t('dashboard.weekend', { defaultValue: 'Happy weekend' })}
              </div>
              <div className="hero-sub">
                {t('dashboard.personalAdded')} <strong className="green">+{myAdded}</strong> ·
                {t('dashboard.filesShort')} <strong>{summary?.my_files || 0}</strong> ·
                {t('dashboard.reposInvolved', { count: summary?.repo_count || 0 })}
              </div>
            </div>
          </div>

          <SummaryBar summary={summary} globalTodoCount={globalTodoCount} />
        </div>

        <Heatmap onDayClick={setDate} />

        <div className="dashboard-controls">
          <DatePicker value={date} onChange={setDate} />
          <div className="dashboard-actions">
            <ProjectSearchDropdown onToggleStar={handleToggleStar} />
            <div className="filter-toggle">
              <button className={`filter-btn ${!showStarredOnly ? 'active' : ''}`} onClick={() => setShowStarredOnly(false)}>{t('dashboard.all', { defaultValue: 'All' })}</button>
              <button className={`filter-btn ${showStarredOnly ? 'active' : ''}`} onClick={() => setShowStarredOnly(true)}>{t('dashboard.starred', { defaultValue: 'Starred' })}</button>
            </div>
            <div className="sort-control">
              <label htmlFor="dashboard-sort">{t('dashboard.sortBy')}</label>
              <select id="dashboard-sort" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="form-input sort-select">
                {sortOptions.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
              </select>
            </div>
            {confirmScan ? (
              <div className="confirm-group">
                <span className="confirm-text">{t('dashboard.confirmRescan')}</span>
                <button className="btn btn-primary btn-sm" onClick={handleScan} disabled={scanning}>{t('common.confirm')}</button>
                <button className="btn btn-sm" onClick={() => setConfirmScan(false)}>{t('common.cancel')}</button>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={() => setConfirmScan(true)} disabled={scanning}>
                {scanning ? (scanMsg || t('dashboard.scanning', { defaultValue: 'Processing...' })) : t('dashboard.rescan', { defaultValue: 'Rescan' })}
              </button>
            )}
          </div>
        </div>

        {displayedError && (
          <ErrorBanner message={displayedError} onRetry={() => { setError(''); setSummaryError(''); void fetchSummary(date); void refetchProjects() }} />
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
            <h3>{showStarredOnly ? t('dashboard.starredOnly', { defaultValue: 'No starred projects' }) : t('dashboard.noProjects', { defaultValue: 'No project data' })}</h3>
            <p>
              {showStarredOnly
                ? t('dashboard.starMsg', { defaultValue: 'Star a project to follow it.' })
                : t('dashboard.scanMsg', { defaultValue: 'No repos found. Configure scan roots first.' })}
            </p>
            <div className="empty-actions">
              {showStarredOnly ? (
                <button className="btn btn-primary" onClick={() => setShowStarredOnly(false)}>{t('dashboard.viewAllProjects')}</button>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={() => setConfirmScan(true)}>{t('dashboard.startScan')}</button>
                  <Link to="/settings" className="btn btn-secondary">{t('dashboard.configureDirs')}</Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {starredProjects.length > 0 && (
              <div className="project-section">
                <div className="project-section-header">
                  <h2 className="project-section-title">{t('dashboard.starredSection')}</h2>
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
                  <h2 className="project-section-title">{t('dashboard.otherSection')}</h2>
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
