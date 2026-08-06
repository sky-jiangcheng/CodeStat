import { type RefObject } from 'react'

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement>
  value: string
  onChange: (value: string) => void
}

interface Tool {
  label: string
  title: string
  // wrap: inserts before/after the current selection
  wrap?: [string, string]
  // prefix: inserts at the start of each selected line (or current line)
  prefix?: string
  // template: replaces selection with a template (cursor placeholder)
  template?: string
}

const TOOLS: Tool[] = [
  { label: 'H1', title: '一级标题', prefix: '# ' },
  { label: 'H2', title: '二级标题', prefix: '## ' },
  { label: 'H3', title: '三级标题', prefix: '### ' },
  { label: 'B', title: '加粗', wrap: ['**', '**'] },
  { label: 'I', title: '斜体', wrap: ['*', '*'] },
  { label: 'S', title: '删除线', wrap: ['~~', '~~'] },
  { label: '</>', title: '行内代码', wrap: ['`', '`'] },
  { label: '• 列表', title: '无序列表', prefix: '- ' },
  { label: '1. 列表', title: '有序列表', prefix: '1. ' },
  { label: '☐ 任务', title: '任务列表', prefix: '- [ ] ' },
  { label: '> 引用', title: '引用', prefix: '> ' },
  { label: '链接', title: '插入链接', wrap: ['[', '](url)'] },
  { label: '代码块', title: '代码块', wrap: ['```ts\n', '\n```'] },
]

// MarkdownToolbar renders a lightweight formatting toolbar above a textarea.
// It manipulates the textarea selection directly (no editor framework needed):
// wrap-style tools wrap the selection, prefix-style tools prepend to each
// selected line. The textarea ref lets us restore focus and selection after
// applying the change.
export default function MarkdownToolbar({ textareaRef, value, onChange }: Props) {
  const apply = (tool: Tool) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.slice(start, end)

    let newValue: string
    let cursorPos: number

    if (tool.wrap) {
      const [before, after] = tool.wrap
      const insertText = before + (selected || '文本') + after
      newValue = value.slice(0, start) + insertText + value.slice(end)
      // Place cursor after the inserted block, selecting the placeholder if any.
      cursorPos = start + before.length + (selected || '文本').length
    } else if (tool.prefix) {
      // Apply prefix to each line in the selection (or the current line if none).
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const selectedLines = value.slice(lineStart, end) || '列表项'
      const prefixed = selectedLines.split('\n').map((line, i) => {
        // For ordered lists, increment the number on each line.
        if (tool.prefix === '1. ' && i > 0) {
          return `${i + 1}. ${line}`
        }
        return tool.prefix + line
      }).join('\n')
      newValue = value.slice(0, lineStart) + prefixed + value.slice(end)
      cursorPos = lineStart + prefixed.length
    } else if (tool.template) {
      newValue = value.slice(0, start) + tool.template + value.slice(end)
      cursorPos = start + tool.template.length
    } else {
      return
    }

    onChange(newValue)
    // Restore focus and cursor position after React re-renders.
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(cursorPos, cursorPos)
    })
  }

  return (
    <div className="md-toolbar" role="toolbar" aria-label="格式化工具栏">
      {TOOLS.map((tool) => (
        <button
          key={tool.label}
          type="button"
          className="md-tool-btn"
          title={tool.title}
          aria-label={tool.title}
          onMouseDown={(e) => { e.preventDefault(); apply(tool) }}
        >
          {tool.label}
        </button>
      ))}
    </div>
  )
}
