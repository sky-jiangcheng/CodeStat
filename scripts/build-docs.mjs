#!/usr/bin/env node
// scripts/build-docs.mjs — 文档站生成器。
//
// 以 docs/**/*.md 为唯一内容源，按 docs/sidebar.json 的导航结构渲染出
// 同目录的 .html（套用原手写文档站的模板样式）。生成物不入库
//（.gitignore 忽略 docs/**/*.html），GitHub Pages 部署时由
// .github/workflows/pages.yml 先执行本脚本。
//
// 依赖 marked（复用 web/node_modules），运行方式：
//   node scripts/build-docs.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = join(root, 'docs')

// Resolve marked from web/node_modules (the project keeps a single dep tree).
const requireFromWeb = createRequire(join(root, 'web', 'noop.js'))
const { marked } = requireFromWeb('marked')

const sidebar = JSON.parse(readFileSync(join(docsDir, 'sidebar.json'), 'utf8'))
const version = JSON.parse(readFileSync(join(root, 'web', 'package.json'), 'utf8')).version
const REPO = 'https://github.com/sky-jiangcheng/gitbuddy'
const PAGES = 'https://sky-jiangcheng.github.io/gitbuddy/'

// --- Markdown helpers ---------------------------------------------------------

function parseDoc(mdPath) {
  const raw = readFileSync(mdPath, 'utf8')
  let title = ''
  let body = raw
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/)
  if (fm) {
    body = raw.slice(fm[0].length)
    const t = fm[1].match(/^title:\s*(.+)$/m)
    if (t) title = t[1].trim().replace(/^["']|["']$/g, '')
  }
  if (!title) {
    const h1 = body.match(/^#\s+(.+)$/m)
    if (h1) title = h1[1].trim()
  }
  return { title, body }
}

function renderMarkdown(mdPath) {
  const { title, body } = parseDoc(mdPath)
  let html = marked.parse(body, { gfm: true })
  // Rewrite relative .md links to generated .html pages.
  html = html.replace(/href="([^"#]*?)\.md(#[^"]*)?"/g, (m, path, hash) =>
    path === '' || path.startsWith('http') ? m : `href="${path}.html${hash ?? ''}"`)
  return { title, html }
}

// --- Template -------------------------------------------------------------------

const navHtml = sidebar.sections.map(sec => `
      <h3>${sec.title}</h3>
${sec.items.map(it => `      <a href="${it.file}.html" data-page="${it.file}">${it.label}</a>`).join('\n')}
`).join('')

function page(title, activeFile, contentHtml, extraHead = '') {
  const active = activeFile
    ? `document.querySelectorAll('.sidebar a[data-page]').forEach(a => { if (a.dataset.page === ${JSON.stringify(activeFile)}) a.classList.add('active') })`
    : ''
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title ? title + ' · ' : ''}GitBuddy 文档</title>
${extraHead}  <style>
    :root { --bg: #f8f9fa; --text: #1a1a2e; --muted: #6c757d; --accent: #4caf50; --border: #e2e8f0; --sidebar-w: 240px; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); display: flex; min-height: 100vh; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .sidebar { width: var(--sidebar-w); background: #1a1a2e; color: #fff; padding: 24px 0; flex-shrink: 0; overflow-y: auto; position: fixed; height: 100vh; }
    .sidebar-brand { padding: 0 20px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 12px; }
    .sidebar-brand h1 { font-size: 18px; font-weight: 700; }
    .sidebar-brand span { color: var(--accent); }
    .sidebar-brand small { display: block; font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px; }
    .sidebar nav { padding: 8px 0; }
    .sidebar h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); padding: 12px 20px 6px; }
    .sidebar a { display: block; padding: 6px 20px; color: rgba(255,255,255,0.75); font-size: 13px; }
    .sidebar a:hover { background: rgba(255,255,255,0.08); color: #fff; text-decoration: none; }
    .sidebar a.active { color: var(--accent); font-weight: 600; }
    .main { margin-left: var(--sidebar-w); flex: 1; padding: 40px 48px; max-width: 860px; }
    .main h1 { font-size: 28px; margin-bottom: 8px; }
    .main .subtitle { color: var(--muted); margin-bottom: 32px; font-size: 15px; }
    .main h2 { font-size: 20px; margin-top: 36px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    .main h3 { font-size: 16px; margin-top: 24px; margin-bottom: 8px; }
    .main p { line-height: 1.75; margin-bottom: 16px; font-size: 14px; color: #334155; }
    .main ul, .main ol { margin-bottom: 16px; padding-left: 24px; font-size: 14px; color: #334155; }
    .main li { margin-bottom: 6px; }
    .main code { background: #eef2f7; padding: 1px 5px; border-radius: 3px; font-size: 13px; font-family: 'SF Mono', Menlo, monospace; }
    .main pre { background: #1a1a2e; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; margin-bottom: 16px; font-size: 13px; line-height: 1.6; }
    .main pre code { background: none; color: inherit; padding: 0; }
    .main table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
    .main th, .main td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }
    .main th { background: #f1f5f9; font-weight: 600; }
    .main blockquote { background: #eff6ff; border-left: 3px solid #3b82f6; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px; font-size: 13px; color: #334155; }
    .main blockquote.warning { background: #fef3c7; border-left-color: #f59e0b; }
    .main .nav-links { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 32px; }
    .main .nav-links a { background: var(--bg); border: 1px solid var(--border); padding: 6px 14px; border-radius: 6px; font-size: 13px; color: var(--text); }
    .main .nav-links a:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }
    .main hr { border: none; border-top: 1px solid var(--border); margin: 32px 0; }
    .main .back-to-top { display: inline-block; font-size: 13px; color: var(--muted); margin-top: 32px; }
    @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 24px; } }
  </style>
</head>
<body>
  <aside class="sidebar">
    <div class="sidebar-brand">
      <h1>Git<span>Buddy</span></h1>
      <small>用户文档 · v${version}</small>
    </div>
    <nav>${navHtml}
    </nav>
  </aside>
  <main class="main">
${contentHtml}
    <hr>
    <a href="${REPO}" class="back-to-top">← 返回 GitHub 仓库</a>
  </main>
  <script>${active}</script>
</body>
</html>
`
}

// --- Build -----------------------------------------------------------------------

const built = []

for (const sec of sidebar.sections) {
  for (const item of sec.items) {
    const mdPath = join(docsDir, item.file + '.md')
    if (!existsSync(mdPath)) {
      console.error(`✗ sidebar 条目缺失源文件: docs/${item.file}.md`)
      process.exitCode = 1
      continue
    }
    const { title, html } = renderMarkdown(mdPath)
    const outPath = join(docsDir, item.file + '.html')
    writeFileSync(outPath, page(title, item.file, html))
    built.push(relative(root, outPath))
  }
}

// Landing page: docs/index.md → index.html, with quick nav links.
{
  const { title, html } = renderMarkdown(join(docsDir, 'index.md'))
  const quick = sidebar.sections.flatMap(s => s.items).slice(0, 7)
    .map(it => `      <a href="${it.file}.html">${it.label}</a>`).join('\n')
  const content = html.replace('<!--NAV_LINKS-->', quick)
  writeFileSync(join(docsDir, 'index.html'), page(title || 'GitBuddy 文档', '', content))
  built.push('docs/index.html')
}

console.log(`✓ 生成 ${built.length} 个页面（v${version}）：\n  ${built.join('\n  ')}`)
