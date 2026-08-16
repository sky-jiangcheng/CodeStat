---
title: 快速开始
order: 1
---

# 快速开始

GitBuddy 是一款本地优先的桌面应用（Wails v2，单文件、零运行时依赖），自动发现本机 Git 仓库并以仪表盘展示每日提交量，同时内置跨项目知识库与仓库知识挖掘。

## 下载安装

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/sky-jiangcheng/gitbuddy/master/scripts/install.sh | bash
```

### Windows

```powershell
iwr -useb https://raw.githubusercontent.com/sky-jiangcheng/gitbuddy/master/scripts/install.ps1 | iex
```

或从 [GitHub Releases](https://github.com/sky-jiangcheng/gitbuddy/releases) 下载对应平台的二进制文件。

## 首次启动

启动后直接打开桌面窗口（Wails 应用，无需浏览器）。

### 1. 配置扫描目录

首次启动会自动播种默认扫描根目录：

| 平台 | 默认扫描范围 |
|------|-------------|
| macOS | 当前用户 HOME 目录 |
| Linux | 当前用户 HOME 目录 |
| Windows | 除 C: 盘外的所有磁盘 |

可在 **设置 → 扫描目录** 中修改（支持添加 / 移除，扫描深度 1-2 级）。

### 2. 执行扫描

仪表盘点击 **重新扫描**，应用递归发现扫描根下的所有 Git 仓库并按目录智能分组为项目。

> 首次扫描仅登记仓库与项目，不预扫历史提交数据。

### 3. 收藏仓库

在仪表盘中点击星标收藏关注的仓库。收藏后卡片展示完整统计（今日新增 / 文件 / 仓库数 / 净增 / 团队总量）。

### 4. 回填历史数据

在收藏的仓库卡片上点击 **刷新历史** 按钮，回填该仓库近 365 天的每日统计数据（进度环与热力图随即填充）。

## 核心功能速览

| 功能 | 说明 |
|------|------|
| 仪表盘 | 每日目标进度环、项目卡片、趋势折线图、提交热力图 |
| 知识库 | 跨项目笔记中心：Markdown / 块编辑器、标签、置顶、FTS5 全文搜索、版本历史 |
| 仓库知识挖掘 | 自动提取 README、技术栈、语言占比、依赖、贡献者、活跃度 |
| 命令面板 | `⌘/Ctrl+K` 快速搜索笔记/待办并跳转项目 |
| AI 集成 | CLI、MCP 服务器、llms.txt、agent-score（见[ AI 集成](features/ai-integration.md)） |
| 插件系统 | yaegi 进程内 Go 脚本插件（见[插件手册](plugins/overview.md)） |
| PWA | 支持安装到桌面/主屏幕，离线可用 |

## 数据与日志位置

| 内容 | macOS | Windows | Linux |
|------|-------|---------|-------|
| 数据库 | `~/Library/Application Support/gitboard/dashboard.db` | `%APPDATA%\gitboard\dashboard.db` | `~/.config/gitboard/dashboard.db` |
| 插件目录 | `…/gitboard/plugins/` | `…/gitboard\plugins\` | `…/gitboard/plugins/` |
| 日志 | `~/Library/Logs/gitboard.log` | `%APPDATA%\gitboard\logs\gitboard.log` | `$XDG_STATE_HOME/gitboard/gitboard.log`（默认 `~/.local/state/gitboard/`） |

升级时 schema 自动迁移，数据无需手工处理。详细排障见[故障排查](troubleshooting.md)。

## 从源码构建

**前置要求**：Go 1.25+、Node.js 20+；开发调试可选 [Wails CLI](https://wails.io) v2.13+。

```bash
# 前端依赖与构建（产物被 go:embed 进二进制）
cd web && npm install && npm run build && cd ..

# 桌面应用
go build -ldflags="-s -w" -o gitboard .

# CLI / MCP / agent-score
go build -o gitboard ./cmd/gitboard/
go build -o gitboard-mcp ./cmd/mcp/
go build -o gitboard-agent-score ./tools/agent-score/
```

开发模式：`wails dev`（前端热更新 + Wails 绑定注入）。测试：`go test ./...`；前端 `npm test` / `npm run build`（tsc 严格检查）。

## 下一步

- [仪表盘](features/dashboard.md)：目标进度、热力图与排序
- [知识库与笔记](features/knowledge.md)：块编辑器与全文搜索
- [设置](features/settings.md)：扫描、标准、外观、插件
