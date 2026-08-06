import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProjects, searchAll, Project, SearchHit } from '../api/client'
import { renderSnippet } from '../utils/markdown'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface Props {
  open: boolean
  onClose: () => void
}

// CommandPalette is a Cmd/Ctrl+K quick-switcher: search notes & todos across all
// projects and jump straight to a project. It surfaces the knowledge-search
// capability as a first-class keyboard action.
//
// Accessibility: the overlay is a focus-trapped modal dialog (role="dialog",
// aria-modal) so screen readers announce it correctly and keyboard focus
// cannot escape to the background page. Focus returns to the trigger button
// when the palette closes (WCAG 2.1 SC 2.4.3).
export default function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Trap focus inside the dialog while open, restoring focus on close.
  useFocusTrap(dialogRef, open)

  useEffect(() => {
    if (open) {
      setQuery('')
      setHits([])
      setActiveIndex(0)
      getProjects('', false).then(setProjects).catch(() => setProjects([]))
    }
  }, [open])

  // Focus the input after the dialog renders. useFocusTrap focuses the first
  // focusable element, but we ensure the input is it via tabindex.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (!trimmed) { setHits([]); setActiveIndex(0); return }
    let cancelled = false
    const t = setTimeout(() => {
      searchAll(trimmed).then(r => {
        if (!cancelled) { setHits(r ?? []); setActiveIndex(0) }
      }).catch(() => { if (!cancelled) setHits([]) })
    }, 150)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, open])

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects.slice(0, 5)
    return projects.filter(p => p.name.toLowerCase().includes(q)).slice(0, 5)
  }, [projects, query])

  const totalItems = hits.length + filteredProjects.length

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, totalItems - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex < hits.length) {
        const h = hits[activeIndex]
        if (h) { navigate(`/project/${h.project_id}`); onClose() }
      } else {
        const p = filteredProjects[activeIndex - hits.length]
        if (p) { navigate(`/project/${p.id}`); onClose() }
      }
    } else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  if (!open) return null

  return (
    <div
      className="cmdk-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="搜索面板"
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索笔记 / 待办 / 跳转项目…"
          className="cmdk-input"
          aria-label="搜索关键词"
          aria-autocomplete="list"
          aria-controls="cmdk-results"
          aria-activedescendant={totalItems > 0 ? `cmdk-item-${activeIndex}` : undefined}
        />
        <div className="cmdk-results" id="cmdk-results" role="listbox" aria-label="搜索结果">
          {hits.length === 0 && filteredProjects.length === 0 && (
            <div className="cmdk-empty" role="status">{query.trim() ? '未找到结果' : '输入关键词开始搜索'}</div>
          )}
          {hits.length > 0 && <div className="cmdk-group" role="presentation">笔记与待办</div>}
          {hits.map((h, i) => (
            <a
              key={`${h.type}-${h.id}`}
              id={`cmdk-item-${i}`}
              href={`/project/${h.project_id}`}
              className={`cmdk-item ${activeIndex === i ? 'cmdk-item-active' : ''}`}
              role="option"
              aria-selected={activeIndex === i}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={onClose}
            >
              <span className={`cmdk-type cmdk-type-${h.type}`}>{h.type === 'note' ? '笔' : '办'}</span>
              <div className="cmdk-item-body">
                <div className="cmdk-item-title">{h.title}</div>
                <div className="cmdk-item-sub">{h.project_name} · <span dangerouslySetInnerHTML={{ __html: renderSnippet(h.snippet.slice(0, 80)) }} /></div>
              </div>
            </a>
          ))}
          {filteredProjects.length > 0 && <div className="cmdk-group" role="presentation">项目</div>}
          {filteredProjects.map((p, i) => (
            <a
              key={p.id}
              id={`cmdk-item-${hits.length + i}`}
              href={`/project/${p.id}`}
              className={`cmdk-item ${activeIndex === hits.length + i ? 'cmdk-item-active' : ''}`}
              role="option"
              aria-selected={activeIndex === hits.length + i}
              onMouseEnter={() => setActiveIndex(hits.length + i)}
              onClick={onClose}
            >
              <span className="cmdk-type cmdk-type-project">项</span>
              <div className="cmdk-item-body">
                <div className="cmdk-item-title">{p.name}</div>
                <div className="cmdk-item-sub">{p.repo_count} 个仓库</div>
              </div>
            </a>
          ))}
        </div>
        <div className="cmdk-foot" role="presentation">
          <span>↑↓ 选择</span><span>↵ 打开</span><span>esc 关闭</span>
        </div>
      </div>
    </div>
  )
}
