---
title: AI 集成（MCP/llms.txt）
order: 7
---

# AI 集成

GitBuddy 面向 AI 代理提供读取通道与自检工具，全部复用同一 `internal/service` 实现（与桌面端行为一致）。

## MCP Server（`gitboard-mcp`）

MCP 是唯一的 AI 执行接口（`gitboard` CLI 未随版本发布）。stdio 协议，进程内单次开库，6 个只读工具：

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

- **llms.txt**：`GenerateLLMsTxt` 生成知识库总览 Markdown（项目目录 + 技术栈 + 最近 20 条知识笔记），适合喂给 LLM 建立上下文。**llms.txt 是导出格式**（应用内生成，不随仓库分发），不作为独立产品方向扩张（见 ADR-0006）
- **笔记导出**：任意笔记导出为带 YAML frontmatter 的 `.md`（`ExportNoteAsMarkdown`）
- **Claude 记忆导入**：`~/.claude/projects/*/memory/*.md` 幂等导入（见[知识库](knowledge.md)）

## agent-score 自检

```bash
go build -o gitboard-agent-score ./tools/agent-score/
./gitboard-agent-score
```

输出 8 项 AI 就绪度评分：数据库健康、笔记数、FTS5 可用、Claude 记忆源、MCP 二进制、llms.txt 导出、SKILL.md、i18n。

## 面向 AI 代理的技能卡

仓库根目录的 [SKILL.md](https://github.com/sky-jiangcheng/gitbuddy/blob/master/SKILL.md) 是给代理阅读的能力卡片（命令、工具表、路径），可直接投喂。
