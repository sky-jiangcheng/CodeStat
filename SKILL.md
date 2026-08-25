# GitBuddy Skill

GitBuddy is a local-first code project context base. It discovers local Git repositories, maintains a cross-project knowledge base (Markdown notes, FTS5 search, version history), mines repository knowledge, and exposes it to AI agents via the MCP server and llms.txt export.

## What GitBuddy Does

- **Repository discovery**: Automatically finds Git repos under configurable scan roots
- **Daily activity tracking**: Lines added/deleted, files changed, commit counts per repo (365-day backfill on demand)
- **Knowledge base**: Cross-project Markdown notes with tags, pins, version history + LCS diff
- **Full-text search**: SQLite FTS5 trigram + bm25 ranking across notes and todos
- **Claude memory import**: Idempotent import of `~/.claude/projects/*/memory/*.md`
- **Repo knowledge mining**: README excerpt, tech stack, languages, dependencies, contributors, activity
- **AI context export**: `llms.txt` and per-note `.md` export

## MCP Server (`gitboard-mcp`)

MCP is the single AI execution interface (the `gitboard` CLI is not shipped). stdio server, opens the database once per process. Build and register:

```bash
go build -o /usr/local/bin/gitboard-mcp ./cmd/mcp/
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `gitboard_notes_list` | List all notes |
| `gitboard_notes_search` | FTS5 search (query string) |
| `gitboard_notes_read` | Read note by ID |
| `gitboard_notes_create` | Create a new note (params: project_id, title, content, category?, tags?) |
| `gitboard_notes_update` | Update note content/metadata (params: id, content?, title?, tags?, category?) |
| `gitboard_projects_list` | List all projects |
| `gitboard_projects_stats` | Project stats by ID |
| `gitboard_ask` | Ask a question, get top-5 results |
| `gitboard_agent_score` | Check AI-readiness (database, notes, search, llms.txt, SKILL.md, i18n) |

### Registering with clients

**Claude Code** (recommended):

```bash
claude mcp add gitboard -- /usr/local/bin/gitboard-mcp
```

Or in a project-level `.mcp.json` / user-level MCP config (Cursor: Settings → MCP → Add Server):

```json
{
  "mcpServers": {
    "gitboard": { "command": "/usr/local/bin/gitboard-mcp", "args": [] }
  }
}
```

> Windows path example: `"command": "C:\\Tools\\gitboard-mcp.exe"`.

## Key File Paths

| Content | macOS | Linux | Windows |
|---------|-------|-------|---------|
| Database | `~/Library/Application Support/gitboard/dashboard.db` | `~/.config/gitboard/dashboard.db` | `%APPDATA%\gitboard\dashboard.db` |
| Plugins | `…/gitboard/plugins/` | `…/gitboard/plugins/` | `…\gitboard\plugins\` |
| Log | `~/Library/Logs/gitboard.log` | `$XDG_STATE_HOME/gitboard/gitboard.log` (default `~/.local/state/gitboard/`) | `%APPDATA%\gitboard\logs\gitboard.log` |
| Claude memory | `~/.claude/projects/*/memory/*.md` | same | same |

## Architecture (v1.7.0)

- **Backend**: Go + SQLite (modernc, zero CGO), Wails v2 desktop app
- **Layering**: `internal/app` (thin Wails bindings) → `internal/service` (business core, shared by desktop/MCP) → `internal/db` + `internal/core/git`
- **Frontend**: React 19 + Vite 8 + TypeScript 7, PWA, hand-rolled CSS design system
- **Search**: FTS5 trigram + bm25, LIKE fallback for short CJK queries
- **i18n**: react-i18next, zh-CN + en
- **Markdown**: Mermaid, KaTeX, callouts, highlight.js
- **Plugins**: yaegi in-process Go scripts for knowledge source import (see docs/plugins/overview.md)

Docs: <https://sky-jiangcheng.github.io/gitbuddy/> · Repo: <https://github.com/sky-jiangcheng/gitbuddy>
