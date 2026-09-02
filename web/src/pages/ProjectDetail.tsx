import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TrendChart from '../components/TrendChart'
import Heatmap from '../components/Heatmap'
import StatusBar from '../components/StatusBar'
import ProjectPanel from '../components/ProjectPanel'
import ScopeToggle from '../components/ScopeToggle'
import ProjectOverviewSection from './project/ProjectOverviewSection'
import ErrorBanner from '../components/ErrorBanner'
import { useProjectDetail } from '../hooks/useProjectDetail'
import { copyText } from '../utils/clipboard'

function ProjectDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || ''

  const {
    project, overview, loading, error, setError,
    scope, setScope, trendData, totals, retry, handleLevelChange,
  } = useProjectDetail(id)

  const [copied, setCopied] = useState(false)

  const handleCopyContext = async () => {
    if (!project) return
    const lines: string[] = [
      `# ${project.name}`,
      `path: ${project.root_path}`,
      `grouping: ${project.is_auto_grouped ? t('project.autoGroup') : t('project.manualGroup')}`,
    ]
    if (overview?.readme_excerpt) lines.push('', `## README\n${overview.readme_excerpt}`)
    if (overview?.tech_stack?.length) lines.push('', `## ${t('project.techStack')}\n${overview.tech_stack?.map(x => x.name).join(', ')}`)
    if (overview?.recent_commits?.length) lines.push('', `## ${t('project.recentCommits')}\n${overview.recent_commits?.slice(0, 5).map(c => `- ${c.time} ${c.message}`).join('\n')}`)
    try {
      await copyText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('common.failed'))
    }
  }

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
              <button className="btn btn-primary btn-sm" onClick={handleCopyContext}>
                {copied ? t('project.copied') : t('project.copyContext')}
              </button>
            </div>
          </div>

          {overview && (
            <div className="detail-summary-row">
              {overview.languages?.[0] && (
                <span className="summary-chip">
                  <span className="summary-label">{t('project.mainLanguage')}</span>
                  {overview.languages[0].language}
                </span>
              )}
              {overview.tech_stack?.length ? (
                <span className="summary-chip">
                  <span className="summary-label">{t('project.techStack')}</span>
                  {overview.tech_stack.slice(0, 3).map((tech) => tech.name).join('·')}
                </span>
              ) : null}
              {overview.activity?.last_commit_date && (
                <span className="summary-chip">
                  <span className="summary-label">{t('project.lastCommit')}</span>
                  {overview.activity.last_commit_date}
                </span>
              )}
              <span className="summary-chip">
                <span className="summary-label">{t('project.subRepos')}</span>
                {project.repos?.length || 0}
              </span>
            </div>
          )}

          <div className="detail-stats-grid">
            <div className="detail-stat">
              <span className="stat-label">{t('project.activeDays')}</span>
              <span className="stat-value minor">{totals.active}</span>
            </div>
            <div className="detail-stat">
              <span className="stat-label">{t('project.fileChanges')}</span>
              <span className="stat-value minor">{totals.files}</span>
            </div>
            <div className="detail-stat">
              <span className="stat-label">{t('project.added')}</span>
              <span className="stat-value green">{totals.added}</span>
            </div>
            <div className="detail-stat">
              <span className="stat-label">{t('project.deleted')}</span>
              <span className="stat-value red">{totals.deleted}</span>
            </div>
          </div>

          <div className="detail-meta-row">
            <span className="meta-pill">{project.is_auto_grouped ? t('project.autoGroup') : t('project.manualGroup')}</span>
            {dateParam && <span className="meta-pill">{t('project.datePill')}: {dateParam}</span>}
            <span className="level-control" title={t('project.groupLevelHint')}>
              <button className="btn btn-sm btn-icon" onClick={() => handleLevelChange('down')} aria-label={t('project.levelDown')}>−</button>
              <span className="level-value">{t('project.groupLevel', { n: project.level_override || 0 })}</span>
              <button className="btn btn-sm btn-icon" onClick={() => handleLevelChange('up')} aria-label={t('project.levelUp')}>＋</button>
            </span>
          </div>
        </div>
      </div>

      <div className="project-scroll">
        {overview && <ProjectOverviewSection overview={overview} />}

        <div className="detail-section">
          <div className="section-header">
            <h2>{t('heatmap.title')}</h2>
            <ScopeToggle scope={scope} onChange={setScope} />
          </div>
          <Heatmap projectId={Number(id)} scope={scope} />
        </div>

        <div className="detail-section">
          <div className="section-header">
            <h2>{t('project.trendTitle')}</h2>
            <ScopeToggle scope={scope} onChange={setScope} />
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
                            <span key={stat.id} className="stat-tag" title={`${stat.stat_date} · ${stat.author}`}>
                              {stat.author}: <span className="green">+{stat.lines_added}</span>{' '}
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

          <ProjectPanel projectId={Number(id)} autoNewNote={searchParams.get('newNote') === '1'} />
        </div>
      </div>

      <StatusBar />
    </div>
  )
}

export default ProjectDetailPage
