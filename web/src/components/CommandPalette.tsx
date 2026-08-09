import { useState, useEffect, useRef, useMemo } from 'react'
import { getProjects, searchAll, Project, SearchHit } from '../api/client'

interface Props {
  open: boolean
  onClose: () => void
}

function itemId(index: number): string {
  return `cmdk-item-${index}`
}

// CommandPalette is a Cmd/Ctrl+K quick-switcher: search notes & todos across all
// projects and jump straight to a project. It surfaces the knowledge-search
<<<<<<< HEAD
// capability as a first-class keyboard action. Fully accessible per the
// combobox dialog pattern (issue #11): focus trap + ARIA listbox/option +
// focus restore on close.
=======
// capability as a first-class keyboard action.
//
// Accessibility: implemented as a combobox-in-dialog (ARIA APG). The dialog traps
// focus, restores it to the trigger on close, and the input drives selection via
// aria-activedescendant over a role="listbox" of role="option" items.
>>>>>>> origin/master
export default function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
<<<<<<< HEAD
  const overlayRef = useRef<HTMLDivElement>(null)
  const lastFocusedRef = useRef<Element | null>(null)

  useEffect(() => {
    if (open) {
      lastFocusedRef.current = document.activeElement
=======
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      // Record the element that had focus (the trigger button) so we can restore it.
      previouslyFocused.current = document.activeElement as HTMLElement
>>>>>>> origin/master
      setQuery('')
      setHits([])
      setActiveIndex(0)
      getProjects('', false).then(setProjects).catch(() => setProjects([]))
      setTimeout(() => inputRef.current?.focus(), 30)
<<<<<<< HEAD
    } else if (lastFocusedRef.current instanceof HTMLElement) {
      // Restore focus to the element that opened the palette.
      lastFocusedRef.current.focus()
      lastFocusedRef.current = null
=======
    } else {
      // Restore focus to the triggering element when the palette closes.
      const el = previouslyFocused.current
      if (el && typeof el.focus === 'function') {
        el.focus()
        previouslyFocused.current = null
      }
>>>>>>> origin/master
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
<<<<<<< HEAD
  const activeId = totalItems > 0 ? itemId(activeIndex) : undefined

  // Trap Tab / Shift+Tab focus within the dialog.
  const trapFocus = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const root = overlayRef.current
    if (!root) return
    const focusables = root.querySelectorAll<HTMLElement>(
      'a[href], button, input, [tabindex]:not([tabindex="-1"])'
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
=======
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
      if (h) { window.location.hash = `#/project/${h.project_id}`; onClose() }
    } else {
      const p = filteredProjects[index - hits.length]
      if (p) { window.location.hash = `#/project/${p.id}`; onClose() }
>>>>>>> origin/master
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
<<<<<<< HEAD
    <div
      ref={overlayRef}
      className="cmdk-overlay"
      onClick={onClose}
      role="presentation"
    >
=======
    <div className="cmdk-overlay" onClick={onClose} tabIndex={-1}>
>>>>>>> origin/master
      <div
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="全局搜索"
        onClick={e => e.stopPropagation()}
<<<<<<< HEAD
        onKeyDown={trapFocus}
=======
>>>>>>> origin/master
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
          role="combobox"
          aria-expanded="true"
          aria-controls="cmdk-results"
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-label="全局搜索"
        />
<<<<<<< HEAD
        <div
          id="cmdk-results"
          className="cmdk-results"
          role="listbox"
          aria-label="搜索结果"
          aria-live="polite"
        >
=======
        <div className="cmdk-results" id="cmdk-results" role="listbox" aria-label="搜索结果">
>>>>>>> origin/master
          {hits.length === 0 && filteredProjects.length === 0 && (
            <div className="cmdk-empty" role="status">{query.trim() ? '未找到结果' : '输入关键词开始搜索'}</div>
          )}
          {hits.length > 0 && <div className="cmdk-group" role="presentation">笔记与待办</div>}
          {hits.map((h, i) => (
            <a
              key={`${h.type}-${h.id}`}
<<<<<<< HEAD
              id={itemId(i)}
=======
              id={`cmdk-opt-${i}`}
>>>>>>> origin/master
              href={`/#/project/${h.project_id}`}
              className={`cmdk-item ${activeIndex === i ? 'cmdk-item-active' : ''}`}
              role="option"
              aria-selected={activeIndex === i}
<<<<<<< HEAD
=======
              tabIndex={-1}
>>>>>>> origin/master
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
<<<<<<< HEAD
          {filteredProjects.length > 0 && <div className="cmdk-group" role="presentation">项目</div>}
=======
          {filteredProjects.length > 0 && <div className="cmdk-group">项目</div>}
>>>>>>> origin/master
          {filteredProjects.map((p, i) => {
            const idx = hits.length + i
            return (
              <a
                key={p.id}
<<<<<<< HEAD
                id={itemId(idx)}
=======
                id={`cmdk-opt-${idx}`}
>>>>>>> origin/master
                href={`/#/project/${p.id}`}
                className={`cmdk-item ${activeIndex === idx ? 'cmdk-item-active' : ''}`}
                role="option"
                aria-selected={activeIndex === idx}
<<<<<<< HEAD
=======
                tabIndex={-1}
>>>>>>> origin/master
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
          {totalItems > 0 ? `${totalItems} 个结果` : (query.trim() ? '未找到结果' : '')}
        </div>
      </div>
    </div>
  )
}
