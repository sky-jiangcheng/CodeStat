# GitBuddy

本地优先的「代码项目第二大脑」：自动发现本地所有 Git 仓库，桌面仪表盘可视化每日提交量；内置跨项目知识库（Markdown 笔记、块编辑器、FTS5 全文搜索、版本历史）、仓库知识挖掘，以及面向 AI 的 CLI / MCP / llms.txt 接口。

[![Go](https://img.shields.io/badge/Go-1.25+-00ADD8?logo=go)](https://go.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

> 单文件 Wails v2 桌面应用（Go + React，SQLite 内嵌，零 CGO）。macOS / Windows / Linux。

## 截屏预览

![仪表盘首页](screenshots/dashboard.png)

![知识库](screenshots/knowledge.png)

![项目详情](screenshots/project-detail.png)

> 截图为示意渲染（由 `scripts/generate_screenshots.py` 生成），实际界面以应用为准。

## 功能特性

### 仪表盘与统计

| 特性 | 说明 |
|------|------|
| 自动发现仓库 | 配置扫描根目录后递归发现所有 Git 仓库；平台自适应默认规则 |
| 可视化仪表盘 | 每日目标进度环、项目卡片、趋势折线图（7 天 / 30 天 / 全部）、提交热力图 |
| 仓库收藏 | 已收藏仓库展示完整统计卡片；未收藏仓库仅显示名称，按需关注 |
| 按需刷新历史 | 收藏卡片「刷新历史」按需回填该仓库近 365 天的每日统计 |
| 智能项目分组 | 自动识别 Monorepo 与单仓库，手动拆分/合并走单事务（笔记与待办随项目迁移） |
| 工作日检查 | 自定义每日代码量标准，未达标告警 |
| 状态栏 | 最近提交实时展示（仓库 / 分支 / 时间，30 秒缓存） |

### 知识库（首页）

| 特性 | 说明 |
|------|------|
| Markdown 笔记 | 标题 / 标签 / 分类（知识·日志·想法·其他）/ 置顶 / 跨项目迁移；草稿自动保存 |
| 块编辑器 | 输入 `/` 呼起块面板插入 Callout / Tabs / 折叠块 / 代码 / Mermaid / 公式 / 表格等结构化块，拖拽排序，产物仍是纯 Markdown |
| 富渲染 | highlight.js 代码高亮、Mermaid 图、KaTeX 数学公式、GFM Callout 与任务列表 |
| FTS5 全文搜索 | trigram + bm25 相关性排序、snippet 高亮，覆盖笔记与待办；短 CJK 查询自动降级 LIKE |
| 版本历史 | 每次保存自动快照，查看任意版本与当前的行级 diff，一键恢复 |
| 全局搜索 | ⌘/Ctrl+K 命令面板 + 仪表盘联合搜索（仓库 / 笔记 / 待办） |

### 仓库知识挖掘

项目详情页自动提取：README 摘要、技术栈清单（20+ manifest 识别）、语言 LOC 占比、依赖清单（npm / go.mod 含块状 require / cargo）、Top 贡献者、活跃度统计、最近提交流；结果缓存于 `repo_meta`，避免重复扫描。

### AI 就绪接口

| 通道 | 说明 |
|------|------|
| CLI | `gitboard notes/projects/stats/ask/config` 子命令，JSON 输出（见 [SKILL.md](SKILL.md)） |
| MCP Server | `gitboard-mcp` stdio 服务器，6 个只读工具，可接入 Claude Code / Cursor 等 |
| llms.txt | `GenerateLLMsTxt` 生成面向 LLM 的知识库总览 Markdown |
| 笔记导出 | 任意笔记导出为带 YAML frontmatter 的 `.md` |
| agent-score | `gitboard-agent-score` 自检 AI 就绪度（数据库/搜索/插件/CLI/MCP） |
| Claude 记忆导入 | 一键将 `~/.claude/projects/*/memory/*.md` 幂等导入为知识笔记 |

### 其他

| 特性 | 说明 |
|------|------|
| 插件系统 | yaegi 进程内 Go 脚本插件 + 知识源导入器（示例见 `examples/plugins/`，指南见[插件手册](docs/plugins/overview.md)） |
| i18n | 中文 / English 一键切换（react-i18next，zh-CN + en） |
| PWA | 可安装到桌面 / 主屏幕，离线 fallback |
| 单文件跨平台 | Go 编译单二进制，无运行时依赖 |

## 快速开始

### 下载安装

从 [Releases](https://github.com/sky-jiangcheng/gitbuddy/releases) 下载对应平台的最新版本。

| 平台 | 一键安装 |
|------|---------|
| macOS / Linux | `curl -fsSL https://raw.githubusercontent.com/sky-jiangcheng/gitbuddy/master/scripts/install.sh \| bash` |
| Windows | `iwr -useb https://raw.githubusercontent.com/sky-jiangcheng/gitbuddy/master/scripts/install.ps1 \| iex` |

启动后直接打开桌面窗口（Wails 应用，无需浏览器）：

1. 首次启动自动播种默认扫描根目录（macOS/Linux 为 HOME，Windows 为非系统盘）
2. 仪表盘点击 **重新扫描** 发现仓库
3. 收藏关注的仓库 → **刷新历史** 回填 365 天统计 → 开始使用知识库

更多见[快速开始](docs/getting-started.md)。

### 数据目录

配置与数据库存储在用户应用数据目录（升级自动迁移 schema）：

- **macOS**: `~/Library/Application Support/gitboard/dashboard.db`
- **Windows**: `%APPDATA%/gitboard/dashboard.db`
- **Linux**: `~/.config/gitboard/dashboard.db`

日志路径见[故障排查](docs/troubleshooting.md)。

## 从源码构建

环境要求：**Go 1.25+**、**Node.js 20+**（前端构建）、可选 [Wails CLI](https://wails.io) v2.13+。

```bash
# 前端依赖与构建（web/dist 会被 go:embed 进二进制）
cd web && npm install && npm run build && cd ..

# 桌面应用
go build -ldflags "-s -w" -o gitboard .

# MCP server / agent-score
go build -o gitboard-mcp ./cmd/mcp/
go build -o gitboard-agent-score ./tools/agent-score/

# 或使用脚本
./scripts/build.sh
```

开发模式：`wails dev`（前端热更新 + Wails 绑定注入）。

测试与检查：

```bash
go test ./...            # Go 全量测试（service/db/knowledge/scanner/diff…）
cd web && npm test       # vitest
cd web && npm run build  # tsc 严格检查 + 构建（ESLint 现状见 TODO.md）
```

## 项目分组规则

| 场景 | 分组规则 |
|------|---------|
| 单仓库项目 | 父目录包含唯一仓库 → 父目录即为项目 |
| MonoRepo | 父目录包含多个子仓库 → 归为一个项目 |
| 嵌套仓库 | 父目录本身是 Git 仓库且子目录也有仓库 → 拆分为独立项目 |

在项目详情页可手动 **向上合并** / **向下拆分** 调整分组级别（单事务，笔记与待办随迁）。

## 项目结构（1.7.0 重构后）

```
main.go                  # Wails 入口：DB 初始化、扫描根播种、窗口与安全头
internal/
  app/                   # Wails 绑定层：每方法 1-3 行委托 service
  service/               # 业务核心：扫描管线、统计刷新、项目/笔记/搜索/导出
                          # （Wails 桌面、CLI、MCP 三端共享同一实现）
  domain/                # 跨层共享的行类型
  db/                    # SQLite：schema/迁移 + 按域拆分的查询（projects/notes/…）
  core/git/              # Git Provider 抽象（本地 CLI 实现）
  core/plugin/           # 插件 SPI + yaegi 运行时
  stats/ knowledge/      # git log 统计、仓库知识挖掘
  scanner/ grouper/      # 文件系统扫描、项目分组
  platform/              # OS 差异：数据目录、日志路径、扫描根默认值
  version/ diff/         # 单一版本号源、笔记行级 diff
cmd/
  gitboard/              # CLI（Cobra）
  mcp/                   # MCP stdio 服务器
tools/agent-score/       # AI 就绪度自检
web/src/
  api/                   # types + transport（Wails/HTTP 双模）+ endpoints
  hooks/                 # useApiData（缓存）/ useDebouncedCallback / useScanPolling…
  pages/ components/     # 页面与组件（大页面已按域拆分子目录）
  locales/ styles/       # zh-CN + en；设计系统 CSS
```

架构决策见 [ADR](docs/adr/)（尤其 [ADR-0005 服务层重构](docs/adr/0005-service-layer.md)）；分层与数据流详见[架构说明](docs/architecture.md)。前后端接口契约（Wails 绑定面）见 [API 参考](docs/api/reference.md)。

## 文档

| 文档 | 内容 |
|------|------|
| [快速开始](docs/getting-started.md) | 安装、首次配置、扫描 |
| [功能手册](docs/features/dashboard.md) | 仪表盘 / 知识库 / 项目详情 / 设置 / 命令面板 |
| [插件手册](docs/plugins/overview.md) | 插件 SPI、事件、知识源导入器 |
| [AI 集成](docs/features/ai-integration.md) | CLI、MCP、llms.txt、agent-score |
| [API 参考](docs/api/reference.md) | Wails 绑定面契约 + OpenAPI |
| [架构说明](docs/architecture.md) | 分层、数据流、关键决策 |
| [故障排查](docs/troubleshooting.md) | FAQ 与日志路径 |
| [SKILL.md](SKILL.md) | 面向 AI 代理的能力卡片 |
| [TODO.md](TODO.md) | 已知事项与待办 |

[在线文档](https://sky-jiangcheng.github.io/gitbuddy/)（GitHub Pages，随 master 自动部署）。

## 参与贡献

见 [CONTRIBUTING](CONTRIBUTING.md)。安全问题请走[私密报告渠道](SECURITY.md)。

## 许可

[MIT](LICENSE)
