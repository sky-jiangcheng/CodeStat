import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getProjectDetail, getProjectOverview, updateProjectLevel, type ProjectDetail, type ProjectOverview } from '../api/client'
import { useTranslation } from 'react-i18next'
import TrendChart, { type TrendDataset } from '../components/TrendChart'
import Heatmap from '../components/Heatmap'
import StatusBar from '../components/StatusBar'
import ProjectPanel from '../components/ProjectPanel'
import ProjectOverviewSection from './project/ProjectOverviewSection'
import ErrorBanner from '../components/ErrorBanner'
import { usePageMeta } from '../utils/seo'

function ProjectDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  usePageMeta({ title: `${t('project.title')} - GitBuddy`, description: 'GitBuddy 项目详情：提交趋势、热力图、仓库知识挖掘、待办与笔记。', path: `/project/${id ?? ''}` })
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || ''

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [overview, setOverview] = useState<ProjectOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<'week' | 'month' | 'all'>('week')
  const [copied, setCopied] = useState(false)

  const handleCopyContext = async () => {
    if (!project) return
    const lines: string[] = [
      `# ${project.name}`,
      `path: ${project.root_path}`,
      `grouping: ${project.is_auto_grouped ? t('project.autoGroup') : t('project.manualGroup')}`,
    ]
    if (overview?.readme_excerpt) lines.push('', `## README\n${overview.readme_excerpt}`)
    if (overview?.tech_stack.length) lines.push('', `## ${t('project.techStack')}\n${overview.tech_stack.map(x => x.name).join(', ')}`)
    if (overview?.recent_commits.length) lines.push('', `## ${t('project.recentCommits')}\n${overview.recent_commits.slice(0, 5).map(c => `- ${c.time} ${c.message}`).join('\n')}`)
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('common.failed'))
    }
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    setError('')
    getProjectDetail(Number(id))
      .then(p => {
        if (cancelled) return
        setProject(p)
        getProjectOverview(Number(id)).then(o => { if (!cancelled) setOverview(o) }).catch(() => {})
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : t('common.failed')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, t])

  // Retry reuses the same load path as the effect so error state, loading flag
  // and overview are all reset consistently (the inline retry previously only
  // set the project and silently swallowed follow-up errors).
  const retry = () => {
    if (!id) return
    setLoading(true)
    setError('')
    getProjectDetail(Number(id))
      .then(p => {
        setProject(p)
        getProjectOverview(Number(id)).then(setOverview).catch(() => {})
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('common.failed')))
      .finally(() => setLoading(false))
  }

  const handleLevelChange = async (direction: 'up' | 'down') => {
    if (!id) return
    try {
      await updateProjectLevel(Number(id), direction)
      const updated = await getProjectDetail(Number(id))
      setProject(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.failed'))
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
      const weekDates = new Set(getLastDays(7))
      dates = dates.filter((d) => weekDates.has(d))
    } else if (range === 'month') {
      const monthDates = new Set(getLastDays(30))
      dates = dates.filter((d) => monthDates.has(d))
    }

    return {
      labels: dates,
      datasets: [
        { label: t('dashboard.sortMyAdded', { defaultValue: 'Lines Added' }), data: dates.map((d) => stats.get(d)!.added), color: '#4a7d4a' },
        { label: t('project.deletedLines'), data: dates.map((d) => stats.get(d)!.deleted), color: '#c95757' },
        { label: t('dashboard.sortMyFiles', { defaultValue: 'Files Changed' }), data: dates.map((d) => stats.get(d)!.files), color: '#5a7fa0' },
      ] as TrendDataset[],
    }
  }, [stats, range, t])

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
        <button className="btn btn-secondary back-btn" onClick={() => navigate('/dashboard')}>&larr; {t('project.backToDashboard')}</button>
        <ErrorBanner message={error || t('project.noRepos')} onRetry={retry} />
        <StatusBar />
      </div>
    )
  }

  return (
    <div className="project-detail">
      <div className="project-fixed">
        <button className="btn btn-secondary back-btn" onClick={() => navigate('/dashboard')}>
          &larr; {t('project.backToDashboard')}
        </button>

        <div className="detail-header-card">
          <div className="detail-title-row">
            <div>
              <h1>{project.name}</h1>
              <p className="detail-path">{project.root_path}</p>
            </div>
            <div className="detail-actions">
              <button className="btn btn-sm" onClick={() => navigate(`/project/${id}?newNote=1`)}>
                {t('project.quickNote')}
              </button>
              <button className="btn btn-sm" onClick={handleCopyContext}>
                {copied ? t('project.copied') : t('project.copyContext')}
              </button>
              <button className="btn btn-sm" onClick={() => handleLevelChange('down')}>
                {t('project.levelDown')}
              </button>
              <button className="btn btn-sm" onClick={() => handleLevelChange('up')}>
                {t('project.levelUp')}
              </button>
            </div>
          </div>

          <div className="detail-stats-grid">
            <div className="detail-stat">
              <span className="stat-label">{t('project.subRepos')}</span>
              <span className="stat-value">{totals.repos}</span>
            </div>
            <div className="detail-stat">
              <span className="stat-label">{t('project.activeDays')}</span>
              <span className="stat-value">{totals.active}</span>
            </div>
            <div className="detail-stat">
              <span className="stat-label">{t('project.fileChanges')}</span>
              <span className="stat-value">{totals.files}</span>
            </div>
            <div className="detail-stat">
              <span className="stat-label">{t('project.added')}</span>
              <span className="stat-value green">+{totals.added}</span>
            </div>
            <div className="detail-stat">
              <span className="stat-label">{t('project.deleted')}</span>
              <span className="stat-value red">-{totals.deleted}</span>
            </div>
          </div>

          <div className="detail-meta-row">
            <span className="meta-pill">{project.is_auto_grouped ? t('project.autoGroup') : t('project.manualGroup')}</span>
            {dateParam && <span className="meta-pill">{t('project.datePill')}: {dateParam}</span>}
          </div>
        </div>
      </div>

      <div className="project-scroll">
        {overview && <ProjectOverviewSection overview={overview} />}

        <div className="detail-section">
          <div className="section-header">
            <h2>{t('heatmap.title')}</h2>
          </div>
          <Heatmap projectId={Number(id)} />
        </div>

        <div className="detail-section">
          <div className="section-header">
            <h2>{t('project.trendTitle')}</h2>
            <div className="range-toggle">
              <button className={`btn btn-sm ${range === 'week' ? 'btn-active' : ''}`} onClick={() => setRange('week')}>
                {t('project.rangeWeek')}
              </button>
              <button className={`btn btn-sm ${range === 'month' ? 'btn-active' : ''}`} onClick={() => setRange('month')}>
                {t('project.rangeMonth')}
              </button>
              <button className={`btn btn-sm ${range === 'all' ? 'btn-active' : ''}`} onClick={() => setRange('all')}>
                {t('project.rangeAll')}
              </button>
            </div>
          </div>
          {trendData.labels.length > 0 ? (
            <TrendChart labels={trendData.labels} datasets={trendData.datasets} />
          ) : (
            <div className="empty-section">{t('project.noDataInRange')}</div>
          )}
        </div>

        <div className="project-layout">
          <div className="project-main">
            <div className="detail-section">
              <h2>{t('project.subRepos')} ({project.repos?.length || 0})</h2>
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
                            <span className="stat-tag more">{t('project.moreCount', { count: repo.stats.length - 5 })}</span>
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

function getLastDays(n: number): string[] {
  const result: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return result
}

export default ProjectDetailPage
