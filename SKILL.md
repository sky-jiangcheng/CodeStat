# GitBuddy Skill

GitBuddy is a local Git dashboard that tracks commit activity across all your repositories. It also maintains a cross-project knowledge base with Markdown notes, full-text search (FTS5), and AI-ready content distribution.

## What GitBuddy Does

- **Repository discovery**: Automatically finds Git repos under configurable scan roots
- **Daily activity tracking**: Lines added/deleted, files changed, commit counts per repo
- **Knowledge base**: Cross-project Markdown notes with tags, pins, and search
- **Claude memory import**: One-click import of `~/.claude/projects/*/memory/*.md`
- **AI-ready exports**: `llms.txt` and per-note `.md` export for LLM consumption

## CLI (`gitboard`)

A standalone CLI built from the same binary. Outputs JSON for agent consumption.

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

## MCP Server

Exposes GitBuddy as MCP tools for Claude Code, Cursor, etc.

```bash
# Run as stdio MCP server
go run ./cmd/mcp/

# Or built binary
/tmp/gitboard-mcp
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

### Claude Code Configuration

Add to `.cursor/rules/gitbuddy.mdc` or equivalent:

```json
{
  "mcpServers": {
    "gitboard": {
      "command": "/tmp/gitboard-mcp",
      "args": []
    }
  }
}
```

## Agent Score

Check AI-readiness of your GitBuddy install:

```bash
go build -o /tmp/gitboard-agent-score ./tools/agent-score/
/tmp/gitboard-agent-score
```

Outputs a scored report: database health, notes count, search coverage, llms.txt status, and export readiness.

## Key File Paths

- Database: `~/Library/Application Support/gitboard/dashboard.db` (macOS)
- Plugins: `~/Library/Application Support/gitboard/plugins/`
- Claude memory sources: `~/.claude/projects/*/memory/*.md`

## Architecture

- **Backend**: Go + SQLite (modernc), Wails v2 desktop app
- **Frontend**: React 19 + Vite 8 + PWA
- **Search**: FTS5 with trigram tokenizer + bm25 ranking
- **i18n**: react-i18next, zh-CN + en locales
- **Markdown**: Mermaid, KaTeX, callout blocks supported
