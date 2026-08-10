import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getProjectDetail, getProjectOverview, updateProjectLevel, ProjectDetail, ProjectOverview } from '../api/client'
import { renderMarkdown } from '../utils/markdown'
import { usePageMeta } from '../utils/seo'
import { useTranslation } from 'react-i18next'
import TrendChart, { TrendDataset } from '../components/TrendChart'
import Heatmap from '../components/Heatmap'
import StatusBar from '../components/StatusBar'
import ProjectPanel from '../components/ProjectPanel'

function getLastDays(n: number): string[] {
  const result: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    result.push(d.toISOString().split('T')[0])
  }
  return result
}

function ProjectDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  usePageMeta({ title: '项目详情 - GitBuddy', description: 'GitBuddy 项目详情：提交趋势、热力图、仓库知识挖掘、待办与笔记。', path: `/project/${id ?? ''}` })
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || ''

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [overview, setOverview] = useState<ProjectOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<'week' | 'month' | 'all'>('week')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError('')
    getProjectDetail(Number(id))
      .then(p => {
        setProject(p)
        getProjectOverview(Number(id)).then(setOverview).catch(() => {})
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('common.failed', { defaultValue: 'Failed' })))
      .finally(() => setLoading(false))
  }, [id])

  const handleLevelChange = async (direction: 'up' | 'down') => {
    if (!id) return
    try {
      await updateProjectLevel(Number(id), direction)
      const updated = await getProjectDetail(Number(id))
      setProject(updated)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('common.failed', { defaultValue: 'Operation failed' })
      setError(msg)
    }
  }

  const stats = useMemo(() => {
    const map = new Map<string, { added: number; deleted: number; files: number; commits: number }>()
    if (project?.repos) {
      project.repos.forEach((repo) => {
        repo.stats?.forEach((stat) => {
          const cur = map.get(stat.stat_date) || { added: 0, deleted: 0, files: 0, commits: 0 }
          cur.added += stat.lines_added
          cur.deleted += stat.lines_deleted
          cur.files += stat.files_changed
          cur.commits++
          map.set(stat.stat_date, cur)
        })
      })
    }
    return map
  }, [project])

  const trendData = useMemo(() => {
    let dates = Array.from(stats.keys()).sort()
    if (range === 'week') {
      const weekDates = getLastDays(7)
      dates = dates.filter((d) => weekDates.includes(d))
    } else if (range === 'month') {
      const monthDates = getLastDays(30)
      dates = dates.filter((d) => monthDates.includes(d))
    }

    return {
      labels: dates,
      datasets: [
        { label: t('dashboard.sortMyAdded', { defaultValue: 'Lines Added' }), data: dates.map((d) => stats.get(d)!.added), color: '#4a7d4a' },
        { label: '删除行数', data: dates.map((d) => stats.get(d)!.deleted), color: '#c95757' },
        { label: t('dashboard.sortMyFiles', { defaultValue: 'Files Changed' }), data: dates.map((d) => stats.get(d)!.files), color: '#5a7fa0' },
      ] as TrendDataset[],
    }
  }, [stats, range])

  const totals = useMemo(() => {
    let added = 0, deleted = 0, files = 0, active = 0
    stats.forEach((v) => {
      added += v.added
      deleted += v.deleted
      files += v.files
      if (v.added + v.deleted > 0) active++
    })
    return { added, deleted, files, active, repos: project?.repos?.length || 0 }
  }, [stats, project])

  if (loading) {
    return (
      <div className="project-detail">
        <div className="project-fixed">
          <div className="skeleton skeleton-text" style={{width: 200, height: 28, marginBottom: 8}} />
          <div className="skeleton skeleton-text" style={{width: '50%', height: 14, marginBottom: 20}} />
          <div className="skeleton skeleton-text" style={{width: '100%', height: 80, marginBottom: 16}} />
        </div>
        <div className="project-scroll">
          <div className="skeleton skeleton-text" style={{width: '100%', height: 280, marginBottom: 16}} />
        </div>
        <StatusBar />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="project-detail">
        <button className="btn btn-secondary back-btn" onClick={() => navigate('/dashboard')}>&larr; 返回仪表盘</button>
        <div className="error-banner">
          <span>{error || t('project.noRepos', { defaultValue: 'Project not found' })}</span>
          <button className="btn btn-sm" onClick={() => id && getProjectDetail(Number(id)).then(setProject).catch(() => {})}>重试</button>
        </div>
        <StatusBar />
      </div>
    )
  }

  return (
    <div className="project-detail">
      <div className="project-fixed">
        <button className="btn btn-secondary back-btn" onClick={() => navigate('/dashboard')}>
          &larr; 返回仪表盘
        </button>

        <div className="detail-header-card">
          <div className="detail-title-row">
            <div>
              <h1>{project.name}</h1>
              <p className="detail-path">{project.root_path}</p>
            </div>
            <div className="detail-actions">
              <button className="btn btn-sm" onClick={() => handleLevelChange('down')}>
                向下拆分
              </button>
              <button className="btn btn-sm" onClick={() => handleLevelChange('up')}>
                向上合并
              </button>
            </div>
          </div>

          <div className="detail-stats-grid">
            <div className="detail-stat">
              <span className="stat-label">子仓库</span>
              <span className="stat-value">{totals.repos}</span>
            </div>
            <div className="detail-stat">
              <span className="stat-label">活跃天数</span>
              <span className="stat-value">{totals.active}</span>
            </div>
            <div className="detail-stat">
              <span className="stat-label">文件变更</span>
              <span className="stat-value">{totals.files}</span>
            </div>
            <div className="detail-stat">
              <span className="stat-label">新增</span>
              <span className="stat-value green">+{totals.added}</span>
            </div>
            <div className="detail-stat">
              <span className="stat-label">删除</span>
              <span className="stat-value red">-{totals.deleted}</span>
            </div>
          </div>

          <div className="detail-meta-row">
            <span className="meta-pill">{project.is_auto_grouped ? '自动分组' : '手动分组'}</span>
            {dateParam && <span className="meta-pill">日期: {dateParam}</span>}
          </div>
        </div>
      </div>

      <div className="project-scroll">
        {overview && (overview.readme_excerpt || overview.tech_stack.length > 0 || overview.recent_commits.length > 0 || overview.dependencies.length > 0 || overview.top_contributors.length > 0) && (
          <div className="detail-section overview-section">
            <div className="section-header">
              <h2>项目概览</h2>
              <span className="overview-cache-hint">{overview.cached ? '来自缓存' : '实时挖掘'}</span>
            </div>

            {overview.tech_stack.length > 0 && (
              <div className="overview-tech">
                {overview.tech_stack.map(t => (
                  <span key={t.name} className={`tech-chip tech-${t.category}`}>{t.name}</span>
                ))}
              </div>
            )}

            {overview.languages.length > 0 && (
              <div className="overview-langs">
                {overview.languages.map(l => {
                  const max = overview.languages[0]?.count || 1
                  return (
                    <div key={l.language} className="lang-row">
                      <span className="lang-name">{l.language}</span>
                      <div className="lang-bar"><div className="lang-fill" style={{ width: `${(l.count / max) * 100}%` }} /></div>
                      <span className="lang-count">{l.count}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {overview.readme_excerpt && (
              <div className="overview-readme markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(overview.readme_excerpt) }} />
            )}

            {overview.dependencies.length > 0 && (
              <div className="overview-deps">
                <h4 className="overview-sub-title">依赖</h4>
                <div className="deps-list">
                  {overview.dependencies.slice(0, 20).map(d => (
                    <span key={d.name} className="dep-chip">
                      <span className="dep-name">{d.name}</span>
                      <span className="dep-version">{d.version}</span>
                      <span className="dep-source">{d.source}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {overview.top_contributors.length > 0 && (
              <div className="overview-contribs">
                <h4 className="overview-sub-title">Top 贡献者</h4>
                <div className="contrib-list">
                  {overview.top_contributors.map((c, i) => (
                    <div key={i} className="contrib-item">
                      <span className="contrib-rank">#{i + 1}</span>
                      <span className="contrib-name">{c.author}</span>
                      <span className="contrib-count">{c.count} commits</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {overview.activity && (overview.activity.total_commits > 0 || overview.activity.commit_rate_30d > 0) && (
              <div className="overview-activity">
                <h4 className="overview-sub-title">活跃度</h4>
                <div className="activity-stats">
                  <div className="activity-stat">
                    <span className="activity-value">{overview.activity.total_commits}</span>
                    <span className="activity-label">总提交</span>
                  </div>
                  <div className="activity-stat">
                    <span className="activity-value">{overview.activity.commit_rate_30d}</span>
                    <span className="activity-label">近30天</span>
                  </div>
                  <div className="activity-stat">
                    <span className="activity-value">{overview.activity.active_days}</span>
                    <span className="activity-label">活跃天数(90d)</span>
                  </div>
                  <div className="activity-stat">
                    <span className="activity-value">{overview.activity.active_months}</span>
                    <span className="activity-label">活跃月</span>
                  </div>
                  {overview.activity.last_commit_date && (
                    <div className="activity-stat">
                      <span className="activity-value-sm">{overview.activity.last_commit_date}</span>
                      <span className="activity-label">最近提交</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {overview.recent_commits.length > 0 && (
              <div className="overview-commits">
                <h4 className="overview-sub-title">最近提交</h4>
                <ul className="commit-feed">
                  {overview.recent_commits.map((c, i) => (
                    <li key={i} className="commit-feed-item">
                      <span className="commit-dot" />
                      <div className="commit-feed-body">
                        <div className="commit-feed-msg">{c.message}</div>
                        <div className="commit-feed-meta">
                          <span>{c.time}</span>
                          {c.branch && <span className="commit-branch">{c.branch}</span>}
                          <span className="commit-author">{c.author}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="detail-section">
          <div className="section-header">
            <h2>提交热力图</h2>
          </div>
          <Heatmap />
        </div>

        <div className="detail-section">
          <div className="section-header">
            <h2>趋势图</h2>
            <div className="range-toggle">
              <button
                className={`btn btn-sm ${range === 'week' ? 'btn-active' : ''}`}
                onClick={() => setRange('week')}
              >
                近7天
              </button>
              <button
                className={`btn btn-sm ${range === 'month' ? 'btn-active' : ''}`}
                onClick={() => setRange('month')}
              >
                近30天
              </button>
              <button
                className={`btn btn-sm ${range === 'all' ? 'btn-active' : ''}`}
                onClick={() => setRange('all')}
              >
                全部
              </button>
            </div>
          </div>
          {trendData.labels.length > 0 ? (
            <TrendChart labels={trendData.labels} datasets={trendData.datasets} />
          ) : (
            <div className="empty-section">该时间范围内暂无数据</div>
          )}
        </div>

        <div className="project-layout">
          <div className="project-main">
            <div className="detail-section">
              <h2>子仓库 ({project.repos?.length || 0})</h2>
              <div className="repo-list">
                {(project.repos || []).map((repo) => {
                  const repoTotals = (repo.stats || []).reduce(
                    (acc, s) => ({
                      added: acc.added + s.lines_added,
                      deleted: acc.deleted + s.lines_deleted,
                      files: acc.files + s.files_changed,
                    }),
                    { added: 0, deleted: 0, files: 0 }
                  )
                  return (
                    <div key={repo.id} className="repo-item">
                      <div className="repo-header">
                        <div className="repo-path">{repo.path.split('/').slice(-2).join('/')}</div>
                        <div className="repo-totals">
                          <span className="green">+{repoTotals.added}</span>
                          <span className="red">-{repoTotals.deleted}</span>
                        </div>
                      </div>
                      {repo.stats && repo.stats.length > 0 && (
                        <div className="repo-stats">
                          {repo.stats.slice(0, 5).map((stat) => (
                            <span key={stat.id} className="stat-tag">
                              {stat.stat_date}: <span className="green">+{stat.lines_added}</span>{' '}
                              <span className="red">-{stat.lines_deleted}</span>
                            </span>
                          ))}
                          {repo.stats.length > 5 && (
                            <span className="stat-tag more">+{repo.stats.length - 5} 更多</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <ProjectPanel projectId={Number(id)} autoNewNote={dateParam === 'newNote' || searchParams.get('newNote') === '1'} />
        </div>
      </div>

      <StatusBar />
    </div>
  )
}

export default ProjectDetailPage
