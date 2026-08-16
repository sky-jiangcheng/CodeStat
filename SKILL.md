# GitBuddy Skill

GitBuddy is a local-first desktop "second brain" for code projects. It tracks commit activity across all local repositories, maintains a cross-project knowledge base (Markdown notes, block editor, FTS5 search, version history), mines repository knowledge, and exposes it all to AI agents via CLI, MCP and llms.txt.

## What GitBuddy Does

- **Repository discovery**: Automatically finds Git repos under configurable scan roots
- **Daily activity tracking**: Lines added/deleted, files changed, commit counts per repo (365-day backfill on demand)
- **Knowledge base**: Cross-project Markdown notes with block editor, tags, pins, version history + LCS diff
- **Full-text search**: SQLite FTS5 trigram + bm25 ranking across notes and todos
- **Claude memory import**: Idempotent import of `~/.claude/projects/*/memory/*.md`
- **Repo knowledge mining**: README excerpt, tech stack, languages, dependencies, contributors, activity
- **AI-ready exports**: `llms.txt` and per-note `.md` export

## CLI (`gitboard`)

Standalone binary sharing the same service layer as the desktop app. JSON output for agent consumption.

```bash
# Install
go build -o /usr/local/bin/gitboard ./cmd/gitboard/

# Usage
gitboard notes list                      # all notes across projects (JSON)
gitboard notes search "query"            # FTS5 search notes + todos (JSON)
gitboard notes read <id>                 # single note by ID (JSON)
gitboard projects list                   # all projects (JSON)
gitboard stats project <id>              # project stats + repos (JSON)
gitboard ask "what is this project about?"  # top-5 search hits as text
gitboard config                          # config + scan roots (JSON)
```

## MCP Server (`gitboard-mcp`)

stdio MCP server, opens the database once per process. Build and register:

```bash
go build -o /usr/local/bin/gitboard-mcp ./cmd/mcp/
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `gitboard_notes_list` | List all notes |
| `gitboard_notes_search` | FTS5 search (query string) |
| `gitboard_notes_read` | Read note by ID |
| `gitboard_projects_list` | List all projects |
| `gitboard_projects_stats` | Project stats by ID |
| `gitboard_ask` | Ask a question, get top-5 results |

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

## Agent Score

Check AI-readiness of the local install:

```bash
go build -o gitboard-agent-score ./tools/agent-score/
./gitboard-agent-score
```

Scores 8 checks: database health, notes count, FTS5 search, Claude memory sources, CLI binary, MCP binary, SKILL.md, i18n locales.

## Key File Paths

| Content | macOS | Linux | Windows |
|---------|-------|-------|---------|
| Database | `~/Library/Application Support/gitboard/dashboard.db` | `~/.config/gitboard/dashboard.db` | `%APPDATA%\gitboard\dashboard.db` |
| Plugins | `…/gitboard/plugins/` | `…/gitboard/plugins/` | `…\gitboard\plugins\` |
| Log | `~/Library/Logs/gitboard.log` | `$XDG_STATE_HOME/gitboard/gitboard.log` (default `~/.local/state/gitboard/`) | `%APPDATA%\gitboard\logs\gitboard.log` |
| Claude memory | `~/.claude/projects/*/memory/*.md` | same | same |

## Architecture (v1.7.0)

- **Backend**: Go + SQLite (modernc, zero CGO), Wails v2 desktop app
- **Layering**: `internal/app` (thin Wails bindings) → `internal/service` (business core, shared by desktop/CLI/MCP) → `internal/db` + `internal/core/git`
- **Frontend**: React 19 + Vite 8 + TypeScript 7, PWA, hand-rolled CSS design system
- **Search**: FTS5 trigram + bm25, LIKE fallback for short CJK queries
- **i18n**: react-i18next, zh-CN + en
- **Markdown**: Mermaid, KaTeX, callouts, highlight.js
- **Plugins**: yaegi in-process Go scripts (see docs/plugins/overview.md)

Docs: <https://sky-jiangcheng.github.io/gitbuddy/> · Repo: <https://github.com/sky-jiangcheng/gitbuddy>
