---
title: AI 集成（MCP/llms.txt）
order: 7
---

# AI 集成

GitBuddy 面向 AI 代理提供读取通道与自检工具，全部复用同一 `internal/service` 实现（与桌面端行为一致）。

## 价值定位：GitBuddy 是 AI 的数据源，而非 AI 本身

**GitBuddy 不调用任何大语言模型**——代码里没有 OpenAI / Anthropic / 任何 API key 配置，没有模型选择、没有 endpoint 设置。它的 AI 功能全部是「把项目知识出口给 AI 工具用」，而不是内置聊天或生成能力。更准确地说：

- GitBuddy 是**数据底座**：把 git 原始信息建模成结构化、可索引、可物化的本地知识库（详见[存储结构优化与 AI 价值](../storage-optimization.md)）；
- AI 工具（Claude Code / Cursor 等）通过 MCP 的 9 个工具来**消费**这层数据，按需取数、精确检索。

这一层「为什么比让 AI 直接读 git 更优」的论证，见[存储结构优化与 AI 价值](../storage-optimization.md)。

### 配置项（均与模型 / API 无关）

`internal/service/config.go` 白名单只含 4 个配置键，**没有任何一项涉及 LLM**：

| 键 | 类型 | 默认 | 用途 |
|----|------|------|------|
| `auto_import` | 0 / 1 | `1` | 是否自动导入 Claude 记忆（**唯一与 AI 相关的配置**） |
| `daily_code_standard` | 整数 | `500` | 每日代码行数目标，用于仪表盘达标展示。名字带 “code standard” 但非 AI 规范，易误读 |
| `scan_depth` | 整数 | `2` | 扫描目录深度 |
| `git_author` | 字符串 | 系统 git 用户 | 影响「我的」统计 / 热力图归属 |

## MCP Server（`gitbuddy-mcp`）

MCP 是唯一的 AI 执行接口（`gitbuddy` CLI 未随版本发布）。stdio 协议，进程内单次开库，9 个工具（含 2 个写操作）：

| 工具 | 说明 | 读写 |
|------|------|------|
| `gitbuddy_notes_list` | 全部笔记 | 读 |
| `gitbuddy_notes_search` | FTS5 搜索（query） | 读 |
| `gitbuddy_notes_read` | 按 ID 读笔记 | 读 |
| `gitbuddy_notes_create` | 新建知识笔记 | 写 |
| `gitbuddy_notes_update` | 更新笔记内容与元数据 | 写 |
| `gitbuddy_projects_list` | 全部项目 | 读 |
| `gitbuddy_projects_stats` | 项目统计（按 id） | 读 |
| `gitbuddy_ask` | 问答式检索，Top-5 文本 | 读 |
| `gitbuddy_agent_score` | 检查本地 AI 就绪度（DB/笔记/搜索/MCP/llms.txt/SKILL.md/i18n） | 读 |

### 接入 Claude Code

```bash
claude mcp add gitbuddy -- /path/to/gitbuddy-mcp
```

或写入 `.mcp.json`（项目级）/ `~/.claude.json`（用户级）：

```json
{
  "mcpServers": {
    "gitbuddy": { "command": "/usr/local/bin/gitbuddy-mcp", "args": [] }
  }
}
```

### 接入 Cursor / 其他 MCP 客户端

在对应客户端的 MCP 配置中添加同样的 `command` 指向 `gitbuddy-mcp` 二进制（Cursor：`Settings → MCP → Add Server`）。

## llms.txt 与 Markdown 导出（应用内）

- **llms.txt**：`GenerateLLMsTxt` 生成知识库总览 Markdown（项目目录 + 技术栈 + 最近 20 条知识笔记），适合喂给 LLM 建立上下文。**llms.txt 是导出格式**（应用内生成，不随仓库分发），不作为独立产品方向扩张（见 ADR-0006）
- **笔记导出**：任意笔记导出为带 YAML frontmatter 的 `.md`（`ExportNoteAsMarkdown`）
- **Claude 记忆导入**：`~/.claude/projects/*/memory/*.md` 幂等导入（见[知识库](knowledge.md)）

## agent-score 自检

agent-score 已合并为 MCP 工具 `gitbuddy_agent_score`，无需独立构建。通过任意 MCP 客户端调用即可获取 7 项 AI 就绪度评分。

## 为什么不直接让 AI 读 git 仓库

一个常见疑问：既然 Claude Code / Cursor 都能直接 `git log`、读文件，为什么还要经过 GitBuddy？核心答案是**成本与确定性**：

- **读得贵**：每次让 AI 直接 `git log` 或逐文件扫描都是一次性消费，重复读 = 重复 token；
- **读得乱 / 不全**：大仓必超上下文窗口、被截断，模型还可能幻觉或漏读二进制 / `.gitignore`；
- **读得慢**：每次重算统计，秒级任务退化成分钟级。

GitBuddy 在**扫描时一次性**把 git 原始数据解析并物化进本地 SQLite（`daily_stats` 预聚合统计、`repo_meta` 缓存挖掘结果、`project_notes_fts` 建全文索引），之后 AI 只通过 MCP 工具**按需取数、精确命中**。完整对比与存储结构细节见[存储结构优化与 AI 价值](../storage-optimization.md)。

## 面向 AI 代理的技能卡

仓库根目录的 [SKILL.md](https://github.com/sky-jiangcheng/GitBuddy/blob/master/SKILL.md) 是给代理阅读的能力卡片（命令、工具表、路径），可直接投喂。
