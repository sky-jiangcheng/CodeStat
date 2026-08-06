import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'

// Register highlight.js with marked for syntax-highlighted code blocks.
// marked's `highlight` option receives the raw code and language tag; we let
// hljs auto-detect when no language is specified.
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang && hljs.getLanguage(lang) ? lang : ''
      let highlighted: string
      if (language) {
        highlighted = hljs.highlight(text, { language }).value
      } else {
        highlighted = hljs.highlightAuto(text).value
      }
      const langLabel = language || 'code'
      return `<pre><code class="hljs language-${langLabel}">${highlighted}</code></pre>`
    },
  },
})

// marked.parse is synchronous by default, but its type union includes a Promise
// form. Pin the options so we always get a string, then sanitize for safe HTML.
marked.setOptions({ async: false, gfm: true, breaks: false })

export function renderMarkdown(content: string): string {
  if (!content) return ''
  const raw = marked.parse(content)
  const html = typeof raw === 'string' ? raw : ''
  return DOMPurify.sanitize(html)
}

// renderSnippet sanitizes an FTS5 search snippet for safe HTML rendering.
// FTS5's snippet() function inserts <mark> tags around matched terms and
// escapes all other HTML. We sanitize with a tight allowlist as defense-in-depth.
export function renderSnippet(snippet: string): string {
  if (!snippet) return ''
  return DOMPurify.sanitize(snippet, { ALLOWED_TAGS: ['mark'], ALLOWED_ATTR: [] })
}

// stripMarkdown returns a single-line plain-text excerpt of markdown content.
export function stripMarkdown(content: string, max = 140): string {
  const text = content
    .replace(/^---[\s\S]*?---\n?/, '') // drop frontmatter
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/[#>*_\-[\]()!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max) + '…' : text
}

// tagsFromString / tagsFromString helpers: tags are stored comma-separated.
export function parseTags(tags: string): string[] {
  return tags.split(',').map(t => t.trim()).filter(Boolean)
}

export function joinTags(tags: string[]): string {
  return tags.join(', ')
}
