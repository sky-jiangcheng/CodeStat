import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import mermaid from 'mermaid'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github.css'
import 'highlight.js/styles/github-dark.css'

// Initialize mermaid once at module load.
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
})

// marked.parse is synchronous by default, but its type union includes a Promise
// form. Pin the options so we always get a string, then sanitize for safe HTML.
marked.setOptions({
  async: false,
  gfm: true,
  breaks: false,
})

// Callout mapping: > [!TYPE] message
const CALLOUT_TYPES = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION', 'QUESTION'] as const
type CalloutType = typeof CALLOUT_TYPES[number]

interface CalloutBlock {
  type: CalloutType
  title: string
  content: string
}

function parseCallouts(lines: string[]): CalloutBlock[] {
  const callouts: CalloutBlock[] = []
  let current: CalloutBlock | null = null
  for (const line of lines) {
    const m = line.match(/^>\s*\[!(\w+)\]\s*(.*)$/)
    if (m) {
      if (current) callouts.push(current)
      const type = m[1].toUpperCase() as CalloutType
      if (!CALLOUT_TYPES.includes(type)) {
        current = null
        continue
      }
      current = { type, title: m[2].trim() || type.toLowerCase(), content: '' }
    } else if (current && line.startsWith('>')) {
      current.content += line.slice(1).trimEnd() + '\n'
    } else {
      if (current) callouts.push(current)
      current = null
    }
  }
  if (current) callouts.push(current)
  return callouts
}

function stripCalloutLines(content: string): string {
  const lines = content.split('\n')
  const filtered: string[] = []
  let inCallout = false
  for (const line of lines) {
    if (/^>\s*\[!\w+\]\s*/.test(line)) { inCallout = true; continue }
    if (inCallout && line.startsWith('>')) continue
    if (inCallout && !line.startsWith('>')) inCallout = false
    filtered.push(line)
  }
  return filtered.join('\n')
}

// renderCallout renders a single callout block to sanitized HTML.
function renderCallout(c: CalloutBlock): string {
  const inner = DOMPurify.sanitize(marked.parse(c.content) as string)
  const icon = getCalloutIcon(c.type)
  return `<div class="callout callout-${c.type.toLowerCase()}">
    <div class="callout-header">${icon} <span class="callout-title">${DOMPurify.sanitize(c.title)}</span></div>
    <div class="callout-content markdown-body">${inner}</div>
  </div>`
}

function getCalloutIcon(type: CalloutType): string {
  const icons: Record<CalloutType, string> = {
    NOTE: '💡',
    TIP: '✨',
    IMPORTANT: '⚡',
    WARNING: '⚠️',
    CAUTION: '🚨',
    QUESTION: '❓',
  }
  return icons[type] ?? '•'
}

// highlightCodeBlocks applies hljs to <pre><code> blocks.
function highlightCodeBlocks(html: string): string {
  return html.replace(
    /<pre><code(?:\s+class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_match, lang: string | undefined, code: string) => {
      const decoded = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
      const highlighted = lang
        ? hljs.highlight(decoded, { language: lang }).value
        : hljs.highlightAuto(decoded).value
      return `<pre><code class="hljs${lang ? ` language-${lang}` : ''}">${highlighted}</code></pre>`
    }
  )
}

// renderInlineMath renders $...$ and $$...$$ in HTML text.
function renderInlineMath(html: string): string {
  return html
    .replace(/\$\$([\s\S]+?)\$\$/g, (_match, expr: string) => {
      try {
        return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })
      } catch {
        return `<span class="math-error">\$\$${expr}\$\$</span>`
      }
    })
    .replace(/\$([^$\n]+?)\$/g, (_match, expr: string) => {
      try {
        return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false })
      } catch {
        return `$${expr}$`
      }
    })
}

// renderMarkdown renders markdown to HTML synchronously (no mermaid).
// Suitable for card snippets, note bodies, and any non-preview context where
// mermaid diagrams are not expected.
export function renderMarkdown(content: string): string {
  if (!content) return ''

  // Extract callout blocks
  const callouts = parseCallouts(content.split('\n'))
  let cleaned = content
  for (const c of callouts) {
    const placeholder = `%%CALLOUT_${c.type}_${Math.random().toString(36).slice(2)}%%`
    const re = new RegExp(
      '>\\s*\\[!' + c.type + '\\]\\s*[\\s\\S]*?(?=\\n>|$)',
      'g'
    )
    cleaned = cleaned.replace(re, placeholder)
  }

  // Strip frontmatter, render, sanitize
  cleaned = cleaned.replace(/^---[\s\S]*?---\n?/, '')
  const raw = marked.parse(cleaned)
  let html: string
  if (typeof raw === 'string') {
    html = raw
  } else {
    html = ''
  }
  html = DOMPurify.sanitize(html)

  // Inject callouts
  for (const c of callouts) {
    const calloutHtml = renderCallout(c)
    const placeholderRegex = new RegExp(`%%CALLOUT_${c.type}_\\w+%%`)
    html = html.replace(placeholderRegex, calloutHtml)
  }

  // Syntax highlight code blocks
  html = highlightCodeBlocks(html)

  // Render math
  html = renderInlineMath(html)

  return html
}

// renderMarkdownAsync is the full async renderer: supports mermaid diagrams in
// addition to syntax highlighting, callouts, and math. Use this for large note
// bodies or preview panes where mermaid is expected.
export async function renderMarkdownAsync(content: string): Promise<string> {
  if (!content) return ''

  // Extract callout blocks
  const callouts = parseCallouts(content.split('\n'))
  let cleaned = content
  for (const c of callouts) {
    const placeholder = `%%CALLOUT_${c.type}_${Math.random().toString(36).slice(2)}%%`
    const re = new RegExp(
      '>\\s*\\[!' + c.type + '\\]\\s*[\\s\\S]*?(?=\\n>|$)',
      'g'
    )
    cleaned = cleaned.replace(re, placeholder)
  }

  // Render mermaid blocks first (async)
  cleaned = await renderMermaidBlocks(cleaned)

  // Strip frontmatter, render, sanitize
  cleaned = cleaned.replace(/^---[\s\S]*?---\n?/, '')
  const raw = marked.parse(cleaned)
  let html: string
  if (typeof raw === 'string') {
    html = raw
  } else {
    html = ''
  }
  html = DOMPurify.sanitize(html)

  // Inject callouts
  for (const c of callouts) {
    const calloutHtml = renderCallout(c)
    const placeholderRegex = new RegExp(`%%CALLOUT_${c.type}_\\w+%%`)
    html = html.replace(placeholderRegex, calloutHtml)
  }

  // Syntax highlight code blocks
  html = highlightCodeBlocks(html)

  // Render math
  html = renderInlineMath(html)

  return html
}

async function renderMermaidBlocks(text: string): Promise<string> {
  const mermaidRegex = /```mermaid\s*\n([\s\S]*?)\n```/g
  let result = text
  let match
  const replacements: Array<{ original: string; svg: string }> = []

  while ((match = mermaidRegex.exec(text)) !== null) {
    try {
      const { svg } = await mermaid.render(
        'mermaid-' + Math.random().toString(36).slice(2),
        match[1].trim()
      )
      replacements.push({ original: match[0], svg })
    } catch {
      // Leave original on render failure
    }
  }
  for (const r of replacements) {
    result = result.replace(r.original, r.svg)
  }
  return result
}

// stripMarkdown returns a single-line plain-text excerpt of markdown content.
export function stripMarkdown(content: string, max = 140): string {
  const cleaned = stripCalloutLines(content)
    .replace(/^---[\s\S]*?---\n?/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/[#>*_\-[\]()!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > max ? cleaned.slice(0, max) + '…' : cleaned
}

// tagsFromString / tagsFromString helpers: tags are stored comma-separated.
export function parseTags(tags: string): string[] {
  return tags.split(',').map(t => t.trim()).filter(Boolean)
}

export function joinTags(tags: string[]): string {
  return tags.join(', ')
}
