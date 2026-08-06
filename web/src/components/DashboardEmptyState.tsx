interface Props {
  showStarredOnly: boolean
  onViewAll: () => void
  onScan: () => void
}

// DashboardEmptyState renders when no projects match the current filter.
export default function DashboardEmptyState({ showStarredOnly, onViewAll, onScan }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{showStarredOnly ? '⭐' : '🔍'}</div>
      <h3>{showStarredOnly ? '暂无关注项目' : '暂无项目数据'}</h3>
      <p>
        {showStarredOnly
          ? '你还没有关注任何项目。点击项目卡片右上角的星标即可关注，或切换到「全部」查看所有项目。'
          : 'GitBuddy 尚未扫描到任何 Git 仓库。请先配置扫描目录。'}
      </p>
      <div className="empty-actions">
        {showStarredOnly ? (
          <button className="btn btn-primary" onClick={onViewAll}>查看全部项目</button>
        ) : (
          <>
            <button className="btn btn-primary" onClick={onScan}>开始扫描</button>
            <a href="/settings" className="btn btn-secondary">配置目录</a>
          </>
        )}
      </div>
    </div>
  )
}
