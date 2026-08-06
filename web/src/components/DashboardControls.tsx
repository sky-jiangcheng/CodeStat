import { Project } from '../api/client'
import { SortKey, SORT_OPTIONS } from '../hooks/useDashboardData'
import DatePicker from './DatePicker'

interface Props {
  date: string
  onDateChange: (d: string) => void
  showStarredOnly: boolean
  onShowStarredOnlyChange: (v: boolean) => void
  sortKey: SortKey
  onSortKeyChange: (k: SortKey) => void
  scanning: boolean
  scanMsg: string
  onScan: () => void
  confirmScan: boolean
  onConfirmScanChange: (v: boolean) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  searchResults: Project[] | null
  searching: boolean
  searchContainerRef: React.RefObject<HTMLDivElement>
  onToggleStar: (projectId: number) => void
}

// DashboardControls renders the toolbar above the project grid: date picker,
// repo search box, filter toggle, sort dropdown, and scan button.
// Cross-content search (notes/todos) is intentionally NOT here — it lives in
// the Cmd+K command palette to provide a single unified search entry point.
export default function DashboardControls({
  date, onDateChange,
  showStarredOnly, onShowStarredOnlyChange,
  sortKey, onSortKeyChange,
  scanning, scanMsg, onScan,
  confirmScan, onConfirmScanChange,
  searchQuery, onSearchChange,
  searchResults, searching,
  searchContainerRef, onToggleStar,
}: Props) {
  return (
    <div className="dashboard-controls">
      <DatePicker value={date} onChange={onDateChange} />
      <div className="dashboard-actions">
        <div className="search-box" ref={searchContainerRef}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="搜索仓库…（按 ⌘K 搜笔记与待办）"
            className="form-input search-input"
          />
          {searchResults !== null && (
            <div className="search-dropdown">
              {searching ? (
                <div className="search-loading">搜索中...</div>
              ) : searchResults.length === 0 ? (
                <div className="search-empty">未找到匹配的仓库</div>
              ) : (
                <div className="search-group">
                  <div className="search-group-header">仓库</div>
                  {searchResults.map(p => (
                    <div key={`project-${p.id}`} className="search-result-item search-result-project-item">
                      <button
                        className={`card-star ${p.is_starred ? 'starred' : ''}`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleStar(p.id) }}
                        title={p.is_starred ? '取消关注' : '关注项目'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={p.is_starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                      <a href={`/project/${p.id}`} className="search-project-name">
                        {p.name}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="filter-toggle">
          <button className={`filter-btn ${!showStarredOnly ? 'active' : ''}`} onClick={() => onShowStarredOnlyChange(false)}>全部</button>
          <button className={`filter-btn ${showStarredOnly ? 'active' : ''}`} onClick={() => onShowStarredOnlyChange(true)}>关注</button>
        </div>
        <div className="sort-control">
          <label>排序：</label>
          <select value={sortKey} onChange={(e) => onSortKeyChange(e.target.value as SortKey)} className="form-input sort-select">
            {SORT_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
          </select>
        </div>
        {confirmScan ? (
          <div className="confirm-group">
            <span className="confirm-text">确定重新扫描？</span>
            <button className="btn btn-primary btn-sm" onClick={onScan} disabled={scanning}>确认</button>
            <button className="btn btn-sm" onClick={() => onConfirmScanChange(false)}>取消</button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => onConfirmScanChange(true)} disabled={scanning}>
            {scanning ? (scanMsg || '处理中...') : '重新扫描'}
          </button>
        )}
      </div>
    </div>
  )
}
