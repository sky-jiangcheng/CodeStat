# GitBuddy Skill

GitBuddy is a local-first code project context base. It discovers local Git repositories, maintains a cross-project knowledge base (Markdown notes, FTS5 search, version history), mines repository knowledge, and exposes it to AI agents via the MCP server and llms.txt export.

## Recommended AI Workflow

```
1. Search projects  → gitbuddy_projects_list        → find relevant repos
2. Search knowledge → gitbuddy_notes_search / gitbuddy_ask  → find existing notes
3. Read details     → gitbuddy_notes_read            → read a specific note
4. Create knowledge → gitbuddy_notes_create          → capture new insights
5. Update knowledge → gitbuddy_notes_update          → refine existing notes
6. Check readiness  → gitbuddy_agent_score           → verify AI integration health
```

**Typical scenario**: "Help me understand project X"
1. `gitbuddy_projects_list` — find the project and its ID
2. `gitbuddy_ask({ query: "project X recent changes" })` — search across notes
3. `gitbuddy_notes_read({ id })` — read relevant notes found
4. `gitbuddy_notes_create({ project_id, title, content })` — save your understanding

**Typical scenario**: "What do I know about topic Y?"
1. `gitbuddy_notes_search({ query: "Y" })` — full-text search across all notes
2. `gitbuddy_ask({ query: "Y" })` — semantic search with top-5 results
3. `gitbuddy_notes_read({ id })` — read the most relevant note in detail

## What GitBuddy Does

- **Repository discovery**: Automatically finds Git repos under configurable scan roots
- **Daily activity tracking**: Lines added/deleted, files changed, commit counts per repo (365-day backfill on demand)
- **Knowledge base**: Cross-project Markdown notes with tags, pins, version history + LCS diff
- **Full-text search**: SQLite FTS5 trigram + bm25 ranking across notes and todos
- **Claude memory import**: Idempotent import of `~/.claude/projects/*/memory/*.md`
- **Repo knowledge mining**: README excerpt, tech stack, languages, dependencies, contributors, activity
- **AI context export**: `llms.txt` and per-note `.md` export

## MCP Server (`gitbuddy-mcp`)

MCP is the single AI execution interface (the `gitbuddy` CLI is not shipped). stdio server, opens the database once per process. Build and register:

```bash
go build -o /usr/local/bin/gitbuddy-mcp ./cmd/mcp/
```

### MCP Tools

> **Usage patterns**: `gitbuddy_ask` is the primary entry point for most queries (returns top-5 ranked results). Use `gitbuddy_notes_search` for precise FTS5 search. For write operations, always read the existing note first to avoid overwriting.

| Tool | Description | Key Parameters | Example |
|------|-------------|----------------|--------|
| `gitbuddy_ask` | Ask a question, get top-5 ranked results | `query` (string, supports CJK) | `{ query: "数据库迁移方案" }` |
| `gitbuddy_notes_search` | FTS5 full-text search across notes | `query` (string, trigram + bm25) | `{ query: "react hooks" }` |
| `gitbuddy_notes_read` | Read one note by ID | `id` (number) | `{ id: 42 }` |
| `gitbuddy_notes_create` | Create a new note | `project_id`, `title`, `content`, `category?`, `tags?` | `{ project_id: 1, title: "API Design", content: "...", category: "knowledge" }` |
| `gitbuddy_notes_update` | Update note content/metadata | `id`, `content?`, `title?`, `tags?`, `category?` | `{ id: 42, content: "updated text" }` |
| `gitbuddy_notes_list` | List all notes (paginated) | `limit?`, `offset?` | `{ limit: 20 }` |
| `gitbuddy_projects_list` | List all projects with stats | `starred_only?` | `{ starred_only: true }` |
| `gitbuddy_projects_stats` | Get stats for one project | `id` (number) | `{ id: 1 }` |
| `gitbuddy_agent_score` | Check AI-readiness score (0-100) | none | `{}` |

### Registering with clients

**Claude Code** (recommended):

```bash
claude mcp add gitbuddy -- /usr/local/bin/gitbuddy-mcp
```

Or in a project-level `.mcp.json` / user-level MCP config (Cursor: Settings → MCP → Add Server):

```json
{
  "mcpServers": {
    "gitbuddy": { "command": "/usr/local/bin/gitbuddy-mcp", "args": [] }
  }
}
```

> Windows path example: `"command": "C:\\Tools\\gitbuddy-mcp.exe"`.

## Key File Paths

| Content | macOS | Linux | Windows |
|---------|-------|-------|---------|
| Database | `~/Library/Application Support/gitbuddy/dashboard.db` | `~/.config/gitbuddy/dashboard.db` | `%APPDATA%\gitbuddy\dashboard.db` |
| Plugins | `…/gitbuddy/plugins/` | `…/gitbuddy/plugins/` | `…\gitbuddy\plugins\` |
| Log | `~/Library/Logs/gitbuddy.log` | `$XDG_STATE_HOME/gitbuddy/gitbuddy.log` (default `~/.local/state/gitbuddy/`) | `%APPDATA%\gitbuddy\logs\gitbuddy.log` |
| Claude memory | `~/.claude/projects/*/memory/*.md` | same | same |

## Architecture (v1.7.0)

- **Backend**: Go + SQLite (modernc, zero CGO), Wails v2 desktop app
- **Layering**: `internal/app` (thin Wails bindings) → `internal/service` (business core, shared by desktop/MCP) → `internal/db` + `internal/core/git`
- **Frontend**: React 19 + Vite 8 + TypeScript 7, PWA, hand-rolled CSS design system
- **Search**: FTS5 trigram + bm25, LIKE fallback for short CJK queries
- **i18n**: react-i18next, zh-CN + en
- **Markdown**: Mermaid, KaTeX, callouts, highlight.js
- **Plugins**: yaegi in-process Go scripts for knowledge source import (see docs/plugins/overview.md)

Docs: <https://sky-jiangcheng.github.io/GitBuddy/> · Repo: <https://github.com/sky-jiangcheng/GitBuddy>
