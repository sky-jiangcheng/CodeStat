import { useCallback, useEffect, useRef, useState } from 'react'

// BlockEditor is a lightweight block-based Markdown editor (gitbook-gap #19).
//
// - Content is split into blocks (paragraph/heading/code/callout/list/table/math…)
// - Each block is edited inline; blocks reorder via drag or arrows
// - Typing "/" opens a block palette to insert structured blocks
// - The stored format stays plain Markdown: joinBlocks() reassembles the text

type BlockType =
  | 'paragraph'
  | 'heading'
  | 'code'
  | 'blockquote'
  | 'callout'
  | 'list'
  | 'table'
  | 'math'
  | 'hr'
  | 'other'

interface Block {
  id: string
  type: BlockType
  text: string
}

interface BlockEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

interface PaletteItem {
  label: string
  desc: string
  type: BlockType
  insert: () => string
}

const PALETTE_ITEMS: PaletteItem[] = [
  { label: '段落', desc: '普通文本', type: 'paragraph', insert: () => '新段落' },
  { label: '标题', desc: '# 一级标题', type: 'heading', insert: () => '## 标题' },
  { label: 'Callout 提示', desc: '> [!TIP]', type: 'callout', insert: () => '> [!TIP]\n> 提示内容' },
  { label: 'Callout 警告', desc: '> [!WARNING]', type: 'callout', insert: () => '> [!WARNING]\n> 警告内容' },
  { label: 'Callout 说明', desc: '> [!NOTE]', type: 'callout', insert: () => '> [!NOTE]\n> 说明内容' },
  { label: '代码块', desc: '```js 代码', type: 'code', insert: () => '```js\n// 代码\n```' },
  { label: 'Mermaid 图', desc: '```mermaid 流程图', type: 'code', insert: () => '```mermaid\nflowchart LR\n  A --> B\n```' },
  { label: '数学公式', desc: '$$ E=mc^2 $$', type: 'math', insert: () => '$$\nE=mc^2\n$$' },
  { label: '待办列表', desc: '- [ ] 待办事项', type: 'list', insert: () => '- [ ] 待办事项' },
  { label: '表格', desc: '| 列 1 | 列 2 |', type: 'table', insert: () => '| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |' },
  { label: '折叠块', desc: '<details> 可折叠', type: 'other', insert: () => '<details>\n<summary>点击展开</summary>\n\n折叠内容\n\n</details>' },
  { label: 'Tabs 标签页', desc: '{% tabs %} 多标签', type: 'other', insert: () => '{% tabs %}\n{% tab title="标签 1" %}\n内容\n{% endtab %}\n{% tab title="标签 2" %}\n内容\n{% endtab %}\n{% endtabs %}' },
  { label: '分隔线', desc: '--- 水平分割', type: 'hr', insert: () => '---' },
]

let blockSeq = 0
function newId(): string {
  blockSeq += 1
  return `blk-${Date.now().toString(36)}-${blockSeq}`
}

function detectType(text: string): BlockType {
  const firstLine = text.split('\n')[0].trim()
  if (/^> \[!\w+\]/.test(firstLine)) return 'callout'
  if (/^#{1,6}\s+/.test(firstLine)) return 'heading'
  if (/^```|^~~~/.test(firstLine)) return 'code'
  if (/^>\s?/.test(firstLine)) return 'blockquote'
  if (/^(\s*[-*+] |\s*\d+\. )/.test(firstLine)) return 'list'
  if (/^(\*\*\*|---|___)$/.test(firstLine)) return 'hr'
  if (/^\$\$/.test(firstLine)) return 'math'
  if (/^\|.*\|/.test(firstLine) || text.includes('\n---\n')) return 'table'
  return 'paragraph'
}

function splitBlocks(src: string): Block[] {
  const lines = src.split('\n')
  const blocks: Block[] = []
  let cur: string[] = []
  let i = 0

  const flush = () => {
    const text = cur.join('\n').trim()
    if (text) blocks.push({ id: newId(), type: detectType(text), text })
    cur = []
  }

  while (i < lines.length) {
    const line = lines[i]
    if (/^ {0,3}(```+|~~~+)/.test(line) && cur.length === 0) {
      const buf = [line]
      i += 1
      while (i < lines.length && !/^ {0,3}(```+|~~~+)\s*$/.test(lines[i])) {
        buf.push(lines[i])
        i += 1
      }
      if (i < lines.length) { buf.push(lines[i]); i += 1 }
      blocks.push({ id: newId(), type: 'code', text: buf.join('\n') })
      continue
    }
    if (line.trim() === '') {
      flush()
    } else {
      cur.push(line)
    }
    i += 1
  }
  flush()
  return blocks
}

function joinBlocks(blocks: Block[]): string {
  return blocks.map(b => b.text.trim()).filter(Boolean).join('\n\n')
}

const TYPE_LABELS: Record<BlockType, string> = {
  paragraph: '段落',
  heading: '标题',
  code: '代码',
  blockquote: '引用',
  callout: 'Callout',
  list: '列表',
  table: '表格',
  math: '公式',
  hr: '分隔线',
  other: '块',
}

interface PaletteState {
  blockId: string
  slashIndex: number
  active: number
}

export default function BlockEditor({ value, onChange, placeholder }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => splitBlocks(value))
  const [palette, setPalette] = useState<PaletteState | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const lastEmitted = useRef(value)
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
  const paletteItems = PALETTE_ITEMS

  // Re-split when the external value changes (e.g. draft reset / note switch),
  // but never echo back our own emissions.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      setBlocks(splitBlocks(value))
    }
  }, [value])

  const emit = useCallback((next: Block[]) => {
    lastEmitted.current = joinBlocks(next)
    onChange(lastEmitted.current)
  }, [onChange])

  const updateBlock = (id: string, text: string) => {
    setBlocks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, text, type: detectType(text) } : b)
      emit(next)
      return next
    })
  }

  const insertTemplate = (item: PaletteItem) => {
    if (!palette) return
    const template = item.insert()
    setBlocks(prev => {
      const next = prev.map(b => {
        if (b.id !== palette.blockId) return b
        const caret = textareaRefs.current.get(b.id)?.selectionStart ?? palette.slashIndex + 1
        const before = b.text.slice(0, palette.slashIndex)
        const after = b.text.slice(caret)
        const text = (before + template + after).trim()
        return { ...b, text, type: detectType(text) }
      })
      emit(next)
      return next
    })
    const currentId = palette.blockId
    setPalette(null)
    // Place the caret at the end of the inserted template.
    requestAnimationFrame(() => {
      const el = textareaRefs.current.get(currentId)
      if (el) {
        el.focus()
        const pos = el.value.length
        el.setSelectionRange(pos, pos)
      }
    })
  }

  const moveBlock = (index: number, dir: -1 | 1) => {
    setBlocks(prev => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      emit(next)
      return next
    })
  }

  const deleteBlock = (index: number) => {
    setBlocks(prev => {
      if (prev.length <= 1) return prev
      const next = prev.filter((_, idx) => idx !== index)
      emit(next)
      return next
    })
  }

  const addBlockAfter = (index: number) => {
    setBlocks(prev => {
      const next = [...prev]
      next.splice(index + 1, 0, { id: newId(), type: 'paragraph', text: '' })
      emit(next)
      return next
    })
  }

  const handleDragStart = (index: number) => setDraggingIndex(index)
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = (index: number) => {
    if (draggingIndex === null || draggingIndex === index) return
    setBlocks(prev => {
      const next = [...prev]
      const [moved] = next.splice(draggingIndex, 1)
      next.splice(index, 0, moved)
      emit(next)
      return next
    })
    setDraggingIndex(null)
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string) => {
    if (palette && palette.blockId === id) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setPalette(p => p ? { ...p, active: (p.active + 1) % paletteItems.length } : p) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setPalette(p => p ? { ...p, active: (p.active - 1 + paletteItems.length) % paletteItems.length } : p) }
      else if (e.key === 'Enter') { e.preventDefault(); insertTemplate(paletteItems[palette.active]) }
      else if (e.key === 'Escape') { e.preventDefault(); setPalette(null) }
      else { setPalette(null) }
      return
    }
    if (e.key === 'Escape') { setPalette(null); return }
    if (e.key === 'Tab' && e.target instanceof HTMLTextAreaElement) {
      e.preventDefault()
      const el = e.target
      const start = el.selectionStart
      const end = el.selectionEnd
      const newText = el.value.slice(0, start) + '  ' + el.value.slice(end)
      updateBlock(id, newText)
      requestAnimationFrame(() => { el.setSelectionRange(start + 2, start + 2) })
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>, id: string) => {
    const el = e.target
    const next = el.value
    const caret = el.selectionStart
    // Opening "/" triggers the block palette (a lone slash at line start or after a space).
    const charBefore = caret > 1 ? next[caret - 2] : ''
    if (caret > 0 && next[caret - 1] === '/' && (caret === 1 || charBefore === ' ' || charBefore === '\n')) {
      setPalette({ blockId: id, slashIndex: caret - 1, active: 0 })
    } else if (palette && palette.blockId === id) {
      setPalette(null)
    }
    updateBlock(id, next)
  }

  if (blocks.length === 0) {
    return (
      <div className="block-editor block-editor-empty">
        <textarea
          value=""
          onChange={(e) => {
            if (e.target.value) {
              const b: Block = { id: newId(), type: 'paragraph', text: e.target.value }
              const next = [b]
              lastEmitted.current = e.target.value
              onChange(e.target.value)
              setBlocks(next)
              requestAnimationFrame(() => {
                textareaRefs.current.get(b.id)?.focus()
              })
            }
          }}
          placeholder={placeholder ?? '输入 Markdown，或输入 / 插入块…'}
          className="form-input block-input"
          rows={3}
        />
      </div>
    )
  }

  return (
    <div className="block-editor">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className={`block-item ${draggingIndex === index ? 'block-item-dragging' : ''}`}
          draggable={false}
        >
          <div className="block-gutter">
            <span
              className="block-drag-handle"
              draggable
              title="拖拽排序"
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => setDraggingIndex(null)}
            >
              ⠿
            </span>
            <span className="block-type">{TYPE_LABELS[block.type]}</span>
            <div className="block-actions">
              <button type="button" className="block-btn" title="上移" onClick={() => moveBlock(index, -1)} disabled={index === 0}>↑</button>
              <button type="button" className="block-btn" title="下移" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1}>↓</button>
              <button type="button" className="block-btn" title="下方插入块" onClick={() => addBlockAfter(index)}>＋</button>
              <button type="button" className="block-btn block-btn-danger" title="删除块" onClick={() => deleteBlock(index)}>×</button>
            </div>
          </div>
          <textarea
            ref={(el) => { if (el) textareaRefs.current.set(block.id, el); else textareaRefs.current.delete(block.id) }}
            value={block.text}
            onChange={(e) => handleTextareaChange(e, block.id)}
            onKeyDown={(e) => handleTextareaKeyDown(e, block.id)}
            rows={Math.max(1, block.text.split('\n').length)}
            className="form-input block-input"
            placeholder={placeholder ?? '输入内容，或输入 / 插入块…'}
          />
          {palette && palette.blockId === block.id && (
            <div className="block-palette" role="listbox" aria-label="插入块">
              <div className="block-palette-head">插入块</div>
              {paletteItems.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  role="option"
                  aria-selected={palette.active === i}
                  className={`block-palette-item ${palette.active === i ? 'active' : ''}`}
                  onMouseEnter={() => setPalette(p => p ? { ...p, active: i } : p)}
                  onClick={() => insertTemplate(item)}
                >
                  <span className="block-palette-label">{item.label}</span>
                  <span className="block-palette-desc">{item.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <button type="button" className="block-add" onClick={() => addBlockAfter(blocks.length - 1)}>＋ 添加块</button>
    </div>
  )
}
