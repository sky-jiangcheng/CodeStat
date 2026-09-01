import { useTranslation } from 'react-i18next'
import type { ProjectOverview } from '../../api/client'
import { renderMarkdown } from '../../utils/markdown'

interface Props {
  overview: ProjectOverview
}

/**
 * The mined-knowledge panel of the project detail page: tech stack, language
 * breakdown, README excerpt, dependencies, contributors, activity and the
 * recent commit feed. Hidden entirely when nothing was mined yet.
 */
export default function ProjectOverviewSection({ overview }: Props) {
  const { t } = useTranslation()

  const hasContent =
    overview.readme_excerpt ||
    (overview.tech_stack?.length ?? 0) > 0 ||
    (overview.recent_commits?.length ?? 0) > 0 ||
    (overview.dependencies?.length ?? 0) > 0 ||
    (overview.top_contributors?.length ?? 0) > 0
  if (!hasContent) {
    return (
      <div className="detail-section overview-section overview-empty">
        <div className="section-header">
          <h2>{t('project.overview')}</h2>
          <span className="overview-cache-hint">{overview.cached ? t('project.fromCache') : t('project.realtimeMining')}</span>
        </div>
        <p className="empty-hint">{t('project.overviewEmpty')}：{t('project.overviewEmptyHint')}</p>
      </div>
    )
  }

  return (
    <div className="detail-section overview-section">
      <div className="section-header">
        <h2>{t('project.overview')}</h2>
        <span className="overview-cache-hint">{overview.cached ? t('project.fromCache') : t('project.realtimeMining')}</span>
      </div>

      {(overview.tech_stack?.length ?? 0) > 0 && (
        <div className="overview-tech">
          {overview.tech_stack!.map(tech => (
            <span key={tech.name} className={`tech-chip tech-${tech.category}`}>{tech.name}</span>
          ))}
        </div>
      )}

      {(overview.languages?.length ?? 0) > 0 && (
        <div className="overview-langs">
          {overview.languages!.map(l => {
            const max = overview.languages![0]?.count || 1
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

      {(overview.dependencies?.length ?? 0) > 0 && (
        <div className="overview-deps">
          <h4 className="overview-sub-title">{t('project.dependencies')}</h4>
          <div className="deps-list">
            {overview.dependencies!.slice(0, 20).map(d => (
              <span key={d.name} className="dep-chip">
                <span className="dep-name">{d.name}</span>
                <span className="dep-version">{d.version}</span>
                <span className="dep-source">{d.source}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {(overview.top_contributors?.length ?? 0) > 0 && (
        <div className="overview-contribs">
          <h4 className="overview-sub-title">{t('project.topContributors')}</h4>
          <div className="contrib-list">
            {overview.top_contributors!.map((c, i) => (
              <div key={i} className="contrib-item">
                <span className="contrib-rank">#{i + 1}</span>
                <span className="contrib-name">{c.author}</span>
                <span className="contrib-count">{c.count} {t('project.commitsUnit')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {overview.activity && (overview.activity.total_commits > 0 || overview.activity.commit_rate_30d > 0) && (
        <div className="overview-activity">
          <h4 className="overview-sub-title">{t('project.activity')}</h4>
          <div className="activity-stats">
            <div className="activity-stat">
              <span className="activity-value">{overview.activity.total_commits}</span>
              <span className="activity-label">{t('project.totalCommits')}</span>
            </div>
            <div className="activity-stat">
              <span className="activity-value">{overview.activity.commit_rate_30d}</span>
              <span className="activity-label">{t('project.last30d')}</span>
            </div>
            <div className="activity-stat">
              <span className="activity-value">{overview.activity.active_days}</span>
              <span className="activity-label">{t('project.activeDays90')}</span>
            </div>
            <div className="activity-stat">
              <span className="activity-value">{overview.activity.active_months}</span>
              <span className="activity-label">{t('project.activeMonths')}</span>
            </div>
            {overview.activity.last_commit_date && (
              <div className="activity-stat">
                <span className="activity-value-sm">{overview.activity.last_commit_date}</span>
                <span className="activity-label">{t('project.lastCommit')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {(overview.recent_commits?.length ?? 0) > 0 && (
        <div className="overview-commits">
          <h4 className="overview-sub-title">{t('project.recentCommits')}</h4>
          <ul className="commit-feed">
            {overview.recent_commits!.map((c, i) => (
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
  )
}
