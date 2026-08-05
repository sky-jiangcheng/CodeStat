import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Project } from '../api/client'

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
          title="关注项目"
          aria-label="关注项目"
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

  return (
    <Link to={to} className={`project-card ${reachedGoal ? 'card-goal-reached' : ''}`}>
      <div className="card-header">
        <h3>{project.name}</h3>
        <div className="card-header-right">
          <div className="card-badges">
            {reachedGoal && <span className="badge badge-goal" title="已达成今日目标">达标</span>}
            {noteCount !== undefined && noteCount > 0 && (
              <span className="badge badge-note" title="知识笔记">{noteCount}</span>
            )}
            {todoCount !== undefined && todoCount > 0 && (
              <span className="badge badge-todo">{todoCount}</span>
            )}
            {project.below_standard && <span className="badge badge-warning">未达标</span>}
            {!project.is_workday && <span className="badge badge-info">非工作日</span>}
          </div>
          <div className="card-header-actions">
            <button
              className="card-refresh-btn"
              onClick={handleRefreshClick}
              disabled={refreshing}
              title={refreshing ? '正在刷新历史记录…' : '刷新历史记录'}
              aria-label={refreshing ? '正在刷新历史记录…' : '刷新历史记录'}
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
            <button
              className="card-star starred"
              onClick={handleStarClick}
              title="取消关注"
              aria-label="取消关注"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="card-hero-num">
        <span className="card-hero-label">今日新增</span>
        <span className={`card-hero-value ${myAdded > 0 ? 'green' : ''}`}>+{myAdded}</span>
      </div>

      {isWorkday && dailyGoal > 0 && myAdded > 0 && (
        <div className="card-goal-bar">
          <div className="card-goal-track">
            <div className="card-goal-fill" style={{ width: `${goalPct}%` }} />
          </div>
          <span className="card-goal-pct">{goalPct}% 目标</span>
        </div>
      )}

      <div className="card-grid">
        <div className="card-stat">
          <span className="stat-label">仓库</span>
          <span className="stat-value">{project.repo_count || 0}</span>
        </div>
        <div className="card-stat">
          <span className="stat-label">文件</span>
          <span className="stat-value">{project.my_files || 0}</span>
        </div>
        <div className="card-stat">
          <span className="stat-label">新增</span>
          <span className="stat-value green">+{myAdded}</span>
        </div>
        <div className="card-stat">
          <span className="stat-label">删除</span>
          <span className="stat-value red">-{myDeleted}</span>
        </div>
      </div>

      <div className="card-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${contributionRatio}%` }} />
          <div className="progress-fill deleted" style={{ width: `${100 - contributionRatio}%` }} />
        </div>
        <div className="progress-info">
          <span className="progress-label">净增</span>
          <span className={`progress-value ${netAdded >= 0 ? 'green' : 'red'}`}>
            {netAdded >= 0 ? '+' : ''}{netAdded}
          </span>
        </div>
      </div>

      <div className="card-footer">
        {(project.total_added || 0) > 0 && (
          <span className="stat-tag team">团队 +{project.total_added}</span>
        )}
      </div>
    </Link>
  )
}

export default ProjectCard
