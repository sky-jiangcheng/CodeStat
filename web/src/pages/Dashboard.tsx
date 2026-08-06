import { useState, useMemo } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useRepoSearch } from '../hooks/useRepoSearch'
import SummaryBar from '../components/SummaryBar'
import GoalRing from '../components/GoalRing'
import Heatmap from '../components/Heatmap'
import StatusBar from '../components/StatusBar'
import ProjectCard from '../components/ProjectCard'
import DashboardControls from '../components/DashboardControls'
import ProjectGridSkeleton from '../components/ProjectGridSkeleton'
import DashboardEmptyState from '../components/DashboardEmptyState'

function Dashboard() {
  const {
    projects, summary, todoCounts, noteCounts, dailyGoal,
    loading, scanning, scanMsg, error,
    date, showStarredOnly, sortKey,
    setDate, setShowStarredOnly, setSortKey,
    handleScan, handleToggleStar, handleRefreshHistory, retry,
  } = useDashboardData()

  const [confirmScan, setConfirmScan] = useState(false)
  const search = useRepoSearch()

  const sorted = useMemo(() => {
    return projects
      .filter(p => {
        if (showStarredOnly) return p.is_starred
        const hasActivity = p.my_added > 0 || p.my_deleted > 0 || p.my_files > 0
        const hasTeamActivity = p.total_added > 0 || p.total_deleted > 0
        return hasActivity || hasTeamActivity || p.is_starred
      })
      .sort((a, b) => {
        switch (sortKey) {
          case 'name': return a.name.localeCompare(b.name)
          case 'my_added': return b.my_added - a.my_added
          case 'my_files': return b.my_files - a.my_files
          case 'repo_count': return b.repo_count - a.repo_count
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

  const onScan = () => {
    setConfirmScan(false)
    handleScan()
  }

  return (
    <div className="dashboard">
      <div className="dashboard-fixed">
        <div className="hero-row">
          <div className="hero-card">
            <GoalRing
              value={myAdded}
              goal={isWorkday ? dailyGoal : 0}
              label={isWorkday ? '今日目标' : '非工作日'}
              sublabel={isWorkday ? `${myAdded} / ${dailyGoal} 行` : `${myAdded} 行`}
            />
            <div className="hero-text">
              <div className="hero-eyebrow">{date} · {isWorkday ? '工作日' : '周末'}</div>
              <div className="hero-title">
                {isWorkday
                  ? (myAdded >= dailyGoal ? '今日目标已达成 🎉' : `还差 ${Math.max(dailyGoal - myAdded, 0)} 行达标`)
                  : '周末愉快，无达标要求'}
              </div>
              <div className="hero-sub">
                个人新增 <strong className="green">+{myAdded}</strong> ·
                文件 <strong>{summary?.my_files || 0}</strong> ·
                涉及 <strong>{summary?.repo_count || 0}</strong> 个仓库
              </div>
            </div>
          </div>

          <SummaryBar summary={summary} globalTodoCount={globalTodoCount} />
        </div>

        <Heatmap onDayClick={setDate} />

        <DashboardControls
          date={date}
          onDateChange={setDate}
          showStarredOnly={showStarredOnly}
          onShowStarredOnlyChange={setShowStarredOnly}
          sortKey={sortKey}
          onSortKeyChange={setSortKey}
          scanning={scanning}
          scanMsg={scanMsg}
          onScan={onScan}
          confirmScan={confirmScan}
          onConfirmScanChange={setConfirmScan}
          searchQuery={search.query}
          onSearchChange={search.setQuery}
          searchResults={search.results}
          searching={search.searching}
          searchContainerRef={search.containerRef}
          onToggleStar={handleToggleStar}
        />

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button className="btn btn-sm" onClick={retry}>重试</button>
          </div>
        )}
      </div>

      <div className="dashboard-scroll">
        {loading ? (
          <ProjectGridSkeleton />
        ) : sorted.length === 0 ? (
          <DashboardEmptyState
            showStarredOnly={showStarredOnly}
            onViewAll={() => setShowStarredOnly(false)}
            onScan={() => setConfirmScan(true)}
          />
        ) : (
          <>
            {starredProjects.length > 0 && (
              <div className="project-section">
                <div className="project-section-header">
                  <h2 className="project-section-title">已收藏仓库</h2>
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
                  <h2 className="project-section-title">其他仓库</h2>
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
