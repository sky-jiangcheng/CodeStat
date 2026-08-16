import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Project } from '../api/client'

interface Props {
  project: Project
  date?: string
  todoCount?: number
  noteCount?: number
  dailyGoal?: number
  isWorkday?: boolean
  onToggleStar?: (id: number) => void
  onRefreshHistory?: (id: number) => Promise<void>
}

function ProjectCard({ project, date, todoCount, noteCount, dailyGoal = 0, isWorkday = true, onToggleStar, onRefreshHistory }: Props) {
  const { t } = useTranslation()
  const [refreshing, setRefreshing] = useState(false)
  const myAdded = project.my_added || 0
  const myDeleted = project.my_deleted || 0
  const netAdded = myAdded - myDeleted
  const to = date ? `/project/${project.id}?date=${date}` : `/project/${project.id}`

  const contributionRatio = (myAdded + myDeleted) > 0
    ? Math.round((myAdded / (myAdded + myDeleted)) * 100)
    : 50

  const goalPct = dailyGoal > 0 ? Math.min(Math.round((myAdded / dailyGoal) * 100), 100) : 0
  const reachedGoal = isWorkday && myAdded > 0 && myAdded >= dailyGoal

  const handleStarClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleStar?.(project.id)
  }

  const handleRefreshClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (refreshing || !onRefreshHistory) return
    setRefreshing(true)
    try {
      await onRefreshHistory(project.id)
    } finally {
      setRefreshing(false)
    }
  }

  if (!project.is_starred) {
    return (
      <div className="project-card project-card-minimal">
        <button
          className="card-star"
          onClick={handleStarClick}
          title={t('project.star')}
          aria-label={t('project.star')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
        {/* Unstarred repos only show name + star button (no detail page) — clicking
            would lead to an empty detail page with no stats, so it is non-interactive. */}
        <span className="card-name">{project.name}</span>
      </div>
    )
  }

  // The star and refresh buttons are siblings of the card Link (never nested
  // inside the anchor) so the markup stays valid and keyboard-friendly.
  return (
    <div className="project-card-shell">
      <button
        className="card-star starred"
        onClick={handleStarClick}
        title={t('project.unstar')}
        aria-label={t('project.unstar')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>
      <button
        className="card-refresh-btn"
        onClick={handleRefreshClick}
        disabled={refreshing}
        title={refreshing ? t('project.refreshingHistory', { defaultValue: 'Refreshing…' }) : t('project.refreshHistory', { defaultValue: 'Refresh history' })}
        aria-label={refreshing ? t('project.refreshingHistory', { defaultValue: 'Refreshing…' }) : t('project.refreshHistory', { defaultValue: 'Refresh history' })}
      >
        {refreshing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        )}
      </button>
      <Link to={to} className={`project-card ${reachedGoal ? 'card-goal-reached' : ''}`}>
        <div className="card-header">
          <h3>{project.name}</h3>
          <div className="card-badges">
            {reachedGoal && <span className="badge badge-goal" title={t('project.goalReached', { defaultValue: '已达成今日目标' })}>{t('project.goalBadge')}</span>}
            {noteCount !== undefined && noteCount > 0 && (
              <span className="badge badge-note" title={t('project.noteBadgeTitle')}>{noteCount}</span>
            )}
            {todoCount !== undefined && todoCount > 0 && (
              <span className="badge badge-todo">{todoCount}</span>
            )}
            {project.below_standard && <span className="badge badge-warning">{t('project.belowBadge')}</span>}
            {!project.is_workday && <span className="badge badge-info">{t('project.nonWorkdayBadge')}</span>}
          </div>
        </div>

        <div className="card-hero-num">
          <span className="card-hero-label">{t('project.todayAdded')}</span>
          <span className={`card-hero-value ${myAdded > 0 ? 'green' : ''}`}>+{myAdded}</span>
        </div>

        {isWorkday && dailyGoal > 0 && myAdded > 0 && (
          <div className="card-goal-bar">
            <div className="card-goal-track">
              <div className="card-goal-fill" style={{ width: `${goalPct}%` }} />
            </div>
            <span className="card-goal-pct">{t('project.goalPct', { pct: goalPct })}</span>
          </div>
        )}

        <div className="card-grid">
          <div className="card-stat">
            <span className="stat-label">{t('project.repo')}</span>
            <span className="stat-value">{project.repo_count || 0}</span>
          </div>
          <div className="card-stat">
            <span className="stat-label">{t('dashboard.filesShort')}</span>
            <span className="stat-value">{project.my_files || 0}</span>
          </div>
          <div className="card-stat">
            <span className="stat-label">{t('project.added')}</span>
            <span className="stat-value green">+{myAdded}</span>
          </div>
          <div className="card-stat">
            <span className="stat-label">{t('project.deleted')}</span>
            <span className="stat-value red">-{myDeleted}</span>
          </div>
        </div>

        <div className="card-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${contributionRatio}%` }} />
            <div className="progress-fill deleted" style={{ width: `${100 - contributionRatio}%` }} />
          </div>
          <div className="progress-info">
            <span className="progress-label">{t('project.netAdded')}</span>
            <span className={`progress-value ${netAdded >= 0 ? 'green' : 'red'}`}>
              {netAdded >= 0 ? '+' : ''}{netAdded}
            </span>
          </div>
        </div>

        <div className="card-footer">
          {(project.total_added || 0) > 0 && (
            <span className="stat-tag team">{t('project.teamTotal')} +{project.total_added}</span>
          )}
        </div>
      </Link>
    </div>
  )
}

export default ProjectCard
