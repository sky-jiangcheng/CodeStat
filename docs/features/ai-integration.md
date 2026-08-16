---
title: AI 集成（CLI/MCP/llms.txt）
order: 7
---

# AI 集成

GitBuddy 面向 AI 代理提供四条读取通道与一个自检工具，全部复用同一 `internal/service` 实现（与桌面端行为一致）。

## CLI（`gitboard`）

```bash
go build -o gitboard ./cmd/gitboard/

gitboard notes list                     # 全部笔记（JSON，含所属项目）
gitboard notes search "查询词"           # FTS5 搜索笔记+待办（JSON）
gitboard notes read <id>                # 单条笔记（JSON）
gitboard projects list                  # 全部项目（JSON）
gitboard stats project <id>             # 项目统计+仓库列表（JSON）
gitboard ask "这个项目是做什么的？"       # Top-5 命中，文本输出
gitboard config                         # 配置与扫描根（JSON）
```

## MCP Server（`gitboard-mcp`）

stdio 协议，进程内单次开库，6 个只读工具：

| 工具 | 说明 |
|------|------|
| `gitboard_notes_list` | 全部笔记 |
| `gitboard_notes_search` | FTS5 搜索（query） |
| `gitboard_notes_read` | 按 ID 读笔记 |
| `gitboard_projects_list` | 全部项目 |
| `gitboard_projects_stats` | 项目统计（id） |
| `gitboard_ask` | 问答式检索，Top-5 文本 |

### 接入 Claude Code

```bash
claude mcp add gitboard -- /path/to/gitboard-mcp
```

或写入 `.mcp.json`（项目级）/ `~/.claude.json`（用户级）：

```json
{
  "mcpServers": {
    "gitboard": { "command": "/usr/local/bin/gitboard-mcp", "args": [] }
  }
}
```

### 接入 Cursor / 其他 MCP 客户端

在对应客户端的 MCP 配置中添加同样的 `command` 指向 `gitboard-mcp` 二进制（Cursor：`Settings → MCP → Add Server`）。

## llms.txt 与 Markdown 导出（应用内）

- **llms.txt**：`GenerateLLMsTxt` 生成知识库总览 Markdown（项目目录 + 技术栈 + 最近 20 条知识笔记），适合喂给 LLM 建立上下文
- **笔记导出**：任意笔记导出为带 YAML frontmatter 的 `.md`（`ExportNoteAsMarkdown`）
- **Claude 记忆导入**：`~/.claude/projects/*/memory/*.md` 幂等导入（见[知识库](knowledge.md)）

## agent-score 自检

```bash
go build -o gitboard-agent-score ./tools/agent-score/
./gitboard-agent-score
```

输出 8 项 AI 就绪度评分：数据库健康、笔记数、FTS5 可用、Claude 记忆源、CLI、MCP、SKILL.md、i18n。

## 面向 AI 代理的技能卡

仓库根目录的 [SKILL.md](https://github.com/sky-jiangcheng/gitbuddy/blob/master/SKILL.md) 是给代理阅读的能力卡片（命令、工具表、路径），可直接投喂。
