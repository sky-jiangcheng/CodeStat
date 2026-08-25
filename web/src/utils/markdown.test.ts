import { describe, it, expect, vi } from 'vitest'

// Mock mermaid to avoid DOM dependency in unit tests
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg>mock</svg>' }),
  },
}))

// Mock katex to avoid CSS import issues
vi.mock('katex', () => ({
  default: {
    renderToString: vi.fn().mockReturnValue('<span class="katex-mock">math</span>'),
  },
}))

// Mock highlight.js
vi.mock('highlight.js', () => ({
  default: {
    highlight: vi.fn().mockReturnValue({ value: 'highlighted' }),
    highlightAuto: vi.fn().mockReturnValue({ value: 'auto-highlighted' }),
  },
}))

import { renderMarkdown, stripMarkdown, parseTags, joinTags } from './markdown'

describe('renderMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('')
  })

  it('renders basic markdown to HTML', () => {
    const result = renderMarkdown('**bold** and *italic*')
    expect(result).toContain('<strong>bold</strong>')
    expect(result).toContain('<em>italic</em>')
  })

  it('strips YAML frontmatter', () => {
    const result = renderMarkdown('---\ntitle: test\n---\n# Hello')
    expect(result).not.toContain('title: test')
    expect(result).toContain('Hello')
  })

  it('renders GFM callout blocks', () => {
    const result = renderMarkdown('> [!NOTE]\n> This is a note')
    expect(result).toContain('callout')
    expect(result).toContain('callout-note')
    expect(result).toContain('This is a note')
  })

  it('renders code blocks with syntax highlighting', () => {
    const result = renderMarkdown('```js\nconsole.log("hi")\n```')
    expect(result).toContain('<pre><code')
    expect(result).toContain('hljs')
  })

  it('renders inline code', () => {
    const result = renderMarkdown('use `npm install`')
    expect(result).toContain('<code>npm install</code>')
  })

  it('renders links', () => {
    const result = renderMarkdown('[Google](https://google.com)')
    expect(result).toContain('href="https://google.com"')
    expect(result).toContain('Google')
  })

  it('renders task lists', () => {
    const result = renderMarkdown('- [x] done\n- [ ] todo')
    expect(result).toContain('done')
    expect(result).toContain('todo')
  })
})

describe('renderMarkdown with math', () => {
  it('renders inline math with KaTeX', () => {
    const result = renderMarkdown('E = $mc^2$')
    expect(result).toContain('katex-mock')
  })

  it('renders block math with KaTeX', () => {
    const result = renderMarkdown('$$\nx^2 + y^2 = z^2\n$$')
    expect(result).toContain('katex-mock')
  })
})

describe('stripMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(stripMarkdown('')).toBe('')
  })

  it('strips markdown formatting', () => {
    expect(stripMarkdown('**bold** and *italic*')).toBe('bold and italic')
  })

  it('strips code blocks', () => {
    expect(stripMarkdown('```js\ncode\n``` other')).toBe('other')
  })

  it('strips inline code', () => {
    const result = stripMarkdown('text `code` end')
    expect(result).toContain('end')
  })

  it('truncates to max length', () => {
    const long = 'a'.repeat(200)
    const result = stripMarkdown(long, 50)
    expect(result).toHaveLength(51) // 50 + '…'
    expect(result).toMatch(/…$/)
  })

  it('strips frontmatter', () => {
    expect(stripMarkdown('---\ntitle: x\n---\nHello')).toBe('Hello')
  })

  it('strips callout lines', () => {
    expect(stripMarkdown('> [!NOTE]\n> content\nNormal')).toBe('Normal')
  })

  it('strips headings markers', () => {
    expect(stripMarkdown('# Title')).toBe('Title')
  })
})

describe('parseTags', () => {
  it('parses comma-separated tags', () => {
    expect(parseTags('go, react, sqlite')).toEqual(['go', 'react', 'sqlite'])
  })

  it('trims whitespace', () => {
    expect(parseTags('  go ,  react  ')).toEqual(['go', 'react'])
  })

  it('filters empty strings', () => {
    expect(parseTags('go,,react,')).toEqual(['go', 'react'])
  })

  it('returns empty array for empty string', () => {
    expect(parseTags('')).toEqual([])
  })
})

describe('joinTags', () => {
  it('joins tags with comma and space', () => {
    expect(joinTags(['go', 'react'])).toBe('go, react')
  })

  it('returns empty string for empty array', () => {
    expect(joinTags([])).toBe('')
  })
})
