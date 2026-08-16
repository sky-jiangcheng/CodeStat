import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { getHeatmapData, type HeatmapDay } from '../api/client'

const WEEKS = 52
const DAYS_PER_WEEK = 7

interface Props {
  onDayClick?: (date: string) => void
  /** Restrict the heatmap to one project's repositories (0 = global). */
  projectId?: number
}

function getLevel(day: HeatmapDay | null): number {
  if (!day) return 0
  const total = (day.lines_added || 0) + (day.lines_deleted || 0)
  if (total === 0) return 0
  if (total < 100) return 1
  if (total < 300) return 2
  if (total < 600) return 3
  return 4
}

function generateGrid(days: HeatmapDay[]): (HeatmapDay | null)[][] {
  const dayMap = new Map<string, HeatmapDay>()
  for (const d of days) {
    dayMap.set(d.date, d)
  }

  const grid: (HeatmapDay | null)[][] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - (WEEKS * 7 - 1))

  const startDay = startDate.getDay()
  startDate.setDate(startDate.getDate() - startDay)

  for (let w = 0; w < WEEKS; w++) {
    const week: (HeatmapDay | null)[] = []
    for (let d = 0; d < DAYS_PER_WEEK; d++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + w * 7 + d)
      const dateStr = date.toISOString().split('T')[0]
      week.push(dayMap.get(dateStr) || null)
    }
    grid.push(week)
  }

  return grid
}

export default function Heatmap({ onDayClick, projectId = 0 }: Props) {
  const { t } = useTranslation()
  const [days, setDays] = useState<HeatmapDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getHeatmapData(projectId)
      .then(res => { if (!cancelled) setDays(res.days) })
      .catch(() => { if (!cancelled) setDays([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId])

  const grid = generateGrid(days)
  const stats = {
    active: days.filter(d => (d.lines_added || 0) + (d.lines_deleted || 0) > 0).length,
    commits: days.reduce((sum, d) => sum + (d.commits || 0), 0),
    added: days.reduce((sum, d) => sum + (d.lines_added || 0), 0),
    deleted: days.reduce((sum, d) => sum + (d.lines_deleted || 0), 0),
  }

  if (loading) {
    return (
      <div className="heatmap-simple">
        <div className="heatmap-loading">{t('common.loading', { defaultValue: '加载中…' })}</div>
      </div>
    )
  }

  return (
    <div className="heatmap-simple">
      <div className="heatmap-header">
        <h3 className="heatmap-title">{t('heatmap.title')}</h3>
        <div className="heatmap-stats">
          <div className="heatmap-stat">
            <span className="heatmap-stat-label">{t('heatmap.active')}</span>
            <span className="heatmap-stat-value">{stats.active}</span>
          </div>
          <div className="heatmap-stat">
            <span className="heatmap-stat-label">{t('heatmap.commits')}</span>
            <span className="heatmap-stat-value">{stats.commits}</span>
          </div>
          <div className="heatmap-stat">
            <span className="heatmap-stat-label">{t('heatmap.added')}</span>
            <span className="heatmap-stat-value">{stats.added}</span>
          </div>
          <div className="heatmap-stat">
            <span className="heatmap-stat-label">{t('heatmap.deleted')}</span>
            <span className="heatmap-stat-value">-{stats.deleted}</span>
          </div>
        </div>
      </div>

      <div className="heatmap-grid-simple" role="grid" aria-label={t('heatmap.title')}>
        {grid.map((week, wi) => (
          <div key={wi} className="heatmap-week-simple" role="gridcolumn">
            {week.map((day, di) => {
              const clickable = day && onDayClick
              return (
                <div
                  key={di}
                  className={`heatmap-cell-simple level-${getLevel(day)}`}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  aria-label={day ? `${day.date}: +${day.lines_added} -${day.lines_deleted}` : t('heatmap.noData')}
                  title={day ? `${day.date}: +${day.lines_added} -${day.lines_deleted}` : ''}
                  onClick={clickable ? () => onDayClick!(day!.date) : undefined}
                  onKeyDown={clickable ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onDayClick!(day!.date)
                    }
                  } : undefined}
                />
              )
            })}
          </div>
        ))}
      </div>

      <div className="heatmap-legend-simple">
        <span>{t('heatmap.less')}</span>
        <div className="heatmap-cell-simple level-0" />
        <div className="heatmap-cell-simple level-1" />
        <div className="heatmap-cell-simple level-2" />
        <div className="heatmap-cell-simple level-3" />
        <div className="heatmap-cell-simple level-4" />
        <span>{t('heatmap.more')}</span>
      </div>
    </div>
  )
}
