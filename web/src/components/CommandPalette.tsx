import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProjects, searchAll, Project, SearchHit } from '../api/client'
import { useTranslation } from 'react-i18next'

interface Props {
  open: boolean
  onClose: () => void
}

// CommandPalette is a Cmd/Ctrl+K quick-switcher: search notes & todos across all
// projects and jump straight to a project. It surfaces the knowledge-search
// capability as a first-class keyboard action.
//
// Accessibility: implemented as a combobox-in-dialog (ARIA APG). The dialog traps
// focus, restores it to the trigger on close, and the input drives selection via
// aria-activedescendant over a role="listbox" of role="option" items.
export default function CommandPalette({ open, onClose }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      // Record the element that had focus (the trigger button) so we can restore it.
      previouslyFocused.current = document.activeElement as HTMLElement
      setQuery('')
      setHits([])
      setActiveIndex(0)
      getProjects('', false).then(setProjects).catch(() => setProjects([]))
      setTimeout(() => inputRef.current?.focus(), 30)
    } else {
      // Restore focus to the triggering element when the palette closes.
      const el = previouslyFocused.current
      if (el && typeof el.focus === 'function') {
        el.focus()
        previouslyFocused.current = null
      }
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
  const activeId = totalItems > 0 ? `cmdk-opt-${activeIndex}` : undefined

  // Keep the active option in view as the user navigates with the arrow keys,
  // so the visible highlight and aria-activedescendant stay in sync.
  useEffect(() => {
    if (!open || !activeId) return
    document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId, open])

  const goto = (index: number) => {
    if (index < hits.length) {
      const h = hits[index]
      if (h) { navigate(`/project/${h.project_id}`); onClose() }
    } else {
      const p = filteredProjects[index - hits.length]
      if (p) { navigate(`/project/${p.id}`); onClose() }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, totalItems - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); goto(activeIndex) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'Tab') {
      // Focus trap: the input is the only tabbable element inside the dialog,
      // so Tab / Shift+Tab cycles back to it instead of escaping to the page.
      e.preventDefault()
      inputRef.current?.focus()
    }
  }

  if (!open) return null

  return (
    <div className="cmdk-overlay" onClick={onClose} tabIndex={-1}>
      <div
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="全局搜索"
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="搜索"
          aria-expanded={totalItems > 0}
          aria-controls="cmdk-results"
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索笔记 / 待办 / 跳转项目…"
          className="cmdk-input"
        />
        <div className="cmdk-results" id="cmdk-results" role="listbox" aria-label="搜索结果">
          {hits.length === 0 && filteredProjects.length === 0 && (
            <div className="cmdk-empty">{query.trim() ? t('commandPalette.noResults', { defaultValue: 'No results' }) : t('commandPalette.startSearch', { defaultValue: 'Start searching' })}</div>
          )}
          {hits.length > 0 && <div className="cmdk-group">笔记与待办</div>}
          {hits.map((h, i) => (
            <a
              key={`${h.type}-${h.id}`}
              id={`cmdk-opt-${i}`}
              href={`/project/${h.project_id}`}
              className={`cmdk-item ${activeIndex === i ? 'cmdk-item-active' : ''}`}
              role="option"
              aria-selected={activeIndex === i}
              tabIndex={-1}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={onClose}
            >
              <span className={`cmdk-type cmdk-type-${h.type}`}>{h.type === 'note' ? '笔' : '办'}</span>
              <div className="cmdk-item-body">
                <div className="cmdk-item-title">{h.title}</div>
                <div className="cmdk-item-sub">{h.project_name} · {h.snippet.slice(0, 60)}</div>
              </div>
            </a>
          ))}
          {filteredProjects.length > 0 && <div className="cmdk-group">项目</div>}
          {filteredProjects.map((p, i) => {
            const idx = hits.length + i
            return (
              <a
                key={p.id}
                id={`cmdk-opt-${idx}`}
                href={`/project/${p.id}`}
                className={`cmdk-item ${activeIndex === idx ? 'cmdk-item-active' : ''}`}
                role="option"
                aria-selected={activeIndex === idx}
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={onClose}
              >
                <span className="cmdk-type cmdk-type-project">项</span>
                <div className="cmdk-item-body">
                  <div className="cmdk-item-title">{p.name}</div>
                  <div className="cmdk-item-sub">{p.repo_count} 个仓库</div>
                </div>
              </a>
            )
          })}
        </div>
        <div className="cmdk-foot">
          <span>↑↓ 选择</span><span>↵ 打开</span><span>esc 关闭</span>
        </div>
        <div className="visually-hidden" role="status" aria-live="polite">
          {totalItems > 0 ? `${totalItems} 个结果` : (query.trim() ? t('commandPalette.noResults', { defaultValue: 'No results' }) : '')}
        </div>
      </div>
    </div>
  )
}
