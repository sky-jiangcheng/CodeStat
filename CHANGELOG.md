# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

版本号 SSOT 为 `internal/version/version.go`，由 `scripts/bump-version.sh` 同步至 `wails.json`、`web/package.json` 与文档站徽章。

## [Unreleased]

### 变更

- **定位治理（PR1）**：统一对外定位为「本地优先的代码项目上下文库」，核心闭环为「发现本地项目 → 理解项目 → 沉淀知识 → 检索知识 → 交给 AI 使用」；仪表盘与统计降级为支持能力（前端默认页已是知识库，导航顺序 知识库 → 仪表盘 → 设置）。README 截图与功能特性表按核心能力优先重排（知识库 / 项目详情 / AI 接口在前，仪表盘在后）；`docs/positioning-brief.md` 新增「统一对外口径（权威短文案）」节，写入中英文三句定位与 release note。详见 [ADR-0006](docs/adr/0006-scope-freeze.md)。
- **错误一致性与可用性（PR2）**：新增 `web/src/components/ErrorBanner.tsx` 作为页面级错误的统一渲染路径（消息 + 重试按钮 + i18n），替换 Dashboard / ProjectDetail / Knowledge / Settings 四页各自内联的 `error-banner` JSX 与重复 catch 样板。ProjectDetail 与 Settings 的重试改为复用与初次加载相同的加载函数，修复旧实现只 setProject / 漏 reset loading 的半状态问题。`NoteSection` 的 create/save/move/delete/pin/restore/diff 等原本 `/* ignore */` 的静默 catch 改走统一的 `run(op, errMsg)` 包装：失败时 setError 并记录最近失败操作供 ErrorBanner 的重试按钮重放；乐观 pin 失败回滚原状态。
- **TODO 收尾（中优先级）**：补齐 `useConfirmClick` 测试；将 `useApiData`（TTL 缓存 + 请求去重）接入 NoteSection 与 CommandPalette 的「全部项目」下拉列表，共享缓存键 `projects:all`，跨组件只发一次请求；Dashboard 的 projects 拉取现已迁移到 `useApiData`（独立键 `dashProjects`，按 date/starredOnly 作用域，因卡片依赖按日统计），star 切换 `invalidateCache('projects:all')` 使三处组件 starred 状态一致，保留乐观 star 覆盖层避免骨架闪烁；移除 `wails.json` 中从未使用的 `wailsjsdir`；校验 `examples/plugins` 两个示例插件（宿主 SPI 未变，`go build ./...` 通过，预期兼容）；`openapi.json` 契约说明与 `build-docs.mjs` 对 `marked` 的依赖经核实已满足，无额外改动。
- **桌面端路由（HashRouter）**：Wails WebView 在自定义源下 BrowserRouter 的 history/location 变更会抛 DOMException，故桌面壳改用 `HashRouter`、PWA/浏览器仍用 `BrowserRouter`；`spaFallback` 注释同步说明该约定。

## [1.7.0] - 2026-08-17

深度重构版本：后端服务化、前端组件化，行为保持不变（除下述明示的修复与契约变更）。决策记录见 [ADR-0005](docs/adr/0005-service-layer.md)。

### 新增

- **internal/service 业务层**：Wails 桌面、CLI、MCP 三端共享同一实现，消除三处重复的查询/格式化逻辑
- **internal/app 薄绑定层**：根目录 14 个 handler 文件（约 1900 行）收敛为每方法 1-3 行委托；`package main` 只剩 `main.go`
- **internal/domain / internal/diff / internal/version**：跨层行类型独立、笔记行级 diff 独立成包、四处硬编码版本号统一为单一常量
- **db 层按域拆分**：1195 行 `queries.go` 拆为 projects / notes / note_versions / todos / repositories / daily_stats / repo_meta / config / scan_roots / search / cleanup；项目升降级 SQL 事务化为受测的 `SplitProjectDown` / `MergeProjectUp`
- **测试补齐**：knowledge 解析（含 go.mod 块状 require）、scanner、diff、项目拆分/合并事务、热力图项目过滤、service 层（fake git provider）；db 测试改用真实 `InitDB` schema（消除手抄 DDL 漂移）
- **前端 API 层拆分**：627 行 client.ts → types / transport / endpoints，统一 `call()` 路由
- **前端 hooks 层**：`useApiData`（TTL 缓存 + 请求去重，待接入页面）、`useDebouncedCallback`、`useScanPolling`、`useConfirmClick`
- **组件拆分**：Dashboard 搜索下拉、Settings 六个 tab、NoteSection 统一 NoteEditor + 版本历史面板、ProjectDetail 概览面板、Knowledge 卡片
- 日志路径按平台（Linux `$XDG_STATE_HOME`、Windows `%APPDATA%\gitbuddy\logs`），修复非 macOS 平台写入 `~/Library/Logs`
- MCP server 进程内单次开库（此前每次工具调用都执行全套迁移）
- vitest + ESLint 工具链（ESLint 受 TS7 兼容性阻塞，见 [TODO](TODO.md)）；tsconfig 恢复 `noUnusedLocals/Parameters`
- 仓库卫生：移除误提交的 20MB 二进制与 AI 工具产物目录，遗留脚本归档至 `scripts/legacy/`

### 修复

- **存量 bug：repository 查询引用不存在的列**（`display_name` / `git_user` / `organization` 从未建列），导致项目仓库列表、扫描后统计刷新、状态栏最近提交、llms.txt 仓库目录在生产环境**全部静默失败**；已核对真实用户数据库确认并修复
- **存量 bug：go.mod 块状 `require (...)` 解析越界 panic**，可致项目概览后台挖掘崩溃；解析器重写并支持单行 + 块状两种形式
- 前端 Rules-of-Hooks 违规（普通函数内调用 `useTranslation`）
- toast 双重定时器互相重置；`EventsOn` 监听器随语言切换累积泄漏（现真实退订）
- 9 处裸 `<a href>` 全页刷新破坏 SPA；ProjectCard 中 `<button>` 嵌套 `<a>` 的非法 HTML/a11y 问题
- **项目详情页热力图显示全局数据**：`GetHeatmapData` 新增 `projectId` 参数（契约变更，前端已适配）
- 笔记两击确认删除、防抖搜索、扫描轮询等三处重复实现合并

### 变更

- 移除死代码约 1100 行：旧扫描管线（`ScanForRepositories` 等）、未使用的 `ExportProjectStats` / `ExportHeatmapCSV` / `GetNoteVersion` / 分支查询 / storage 垫片等（绑定面变更已同步至 API 参考）
- 约 300 行硬编码中文提取至 zh-CN / en locale 文件
- `GetStatusBar` 改为双检锁（不持锁执行 git 命令）；`ToggleProjectStar` 原子化（TOCTOU）；`ReorderTodos` 单事务（自 1.6.x 移植）

## [1.6.3] - 2026-08-11

### 修复

- 代码质量专项：CSV 注入防护（csvSafe）、TOCTOU 与事务化修复（ToggleProjectStar / ReorderTodos）、状态栏锁优化、`wail()` 空守卫、`ensurePath` 去重、跨平台日志目录（`getLogDir`）

## [1.6.2] - 2026-08-11

### 变更

- 第二轮代码质量清理：错误包裹（`%w`）、helpers 归并、`refreshStatsForRepo` 抽取

## [1.6.1] - 2026-08-10

### 新增

- 产品正式更名为 GitBuddy（旧名 GitBoard，当时仅 module/包路径级引用待跟进）
- 记录产品定位决策 ADR 0002，并标记 RFC 0001（插件平台）为 Superseded
- 社区健康文件（issue #25）：CHANGELOG / CONTRIBUTING / SECURITY / CODE_OF_CONDUCT / SUPPORT / Issue+PR 模板 / Dependabot
- 进程内插件系统：yaegi 脚本运行时（目录扫描 / 加载 / 事件总线 / panic 隔离），插件接口见 `internal/core/plugin`
- Claude 记忆导入重构为内置 KnowledgeImporter 插件，与脚本插件共享运行时导入/去重/统计路径
- 知识源导入触发：启动自动导入（可开关）+ 设置页手动触发 + 前端 toast 结果通知
- 知识库升级为首页，支持快速创建笔记（issue #31）
- 知识库体验增强（issue #37）：首屏搜索框自动聚焦、顶部「最近编辑」快速访问区、空状态引导创建或导入 AI 记忆、编辑器「关联项目」下拉快速迁移笔记（新增 `MoveNote` API）
- 设计系统重构（issue #9）：拆分单体 global.css 为设计系统 token + 组件样式，LCH 自适应色板
- Markdown 渲染增强（issue #10）：highlight.js 语法高亮、Mermaid 图、GFM callout、KaTeX 数学公式、任务列表样式
- 全局无障碍基线（issue #12）：skip-link + focus-visible + reduced-motion
- 命令面板无障碍（issue #11）：focus trap + ARIA dialog/listbox
- BrowserRouter 路由升级（issue #13）：可分享 URL，Pages `_redirects` fallback
- PWA 规范修复（issue #14）：theme-color 一致 + 离线 fallback + 安全加固
- SEO 规范（issue #21）：OG / Twitter Card / canonical / sitemap
- AI-ready 内容分发层（issue #15）：llms.txt + .md 路由 + 问答入口
- FTS5 全文搜索升级（issue #18）：FTS5 + 中文分词 + 相关性排序 + snippet 高亮
- 笔记版本历史 + Diff view（issue #16）：复用本地 Git，超越 GitBook CRUD
- 仓库知识挖掘加深（issue #20）：LOC / 依赖图 / 活跃度 / 贡献者
- 安全规范（issue #24）：CSP / HSTS / 安全策略声明 / 依赖扫描
- i18n 框架（issue #23）：字符串外提 + hreflang + 语言切换（zh-CN / en）
- 用户文档站（issue #26）：使用手册 / 教程 / FAQ（docs/ 落地页）
- API 参考文档（issue #27）：OpenAPI 渲染 + 端点说明
- OpenAPI spec + REST 版本化（issue #22）+ OpenAPI 自动渲染与 Try-it（issue #17）
- CLI + MCP + agent-score（issue #28）：`gitbuddy-mcp`、`tools/agent-score` 自检工具

## [1.5.7] - 2026-08-10

### 新增

- 块编辑器（issue #19）：Markdown 双轨编辑，输入 `/` 呼起 block 面板插入 callout/tabs/details/代码/Mermaid/公式等结构化块，块级拖拽排序与增删，编辑产物仍为可读 Markdown
- 桌面端深链路由兜底：Wails AssetServer 对未命中的 GET 请求回退 `index.html`

## [1.5.6] - 2026-08-10

### 修复

- 扫描稳定性与收藏同步修复

## [1.5.5] - 2026-08-10

### 新增

- 启动时历史回填、收藏同步及默认扫描根目录播种

## [1.5.3] - 2026-07-25

### 修复

- 全量扫描策略优化为合并同步，增强跨平台支持

## [1.5.2] - 2026-07-25

### 新增

- 全面更新应用图标系统

## [1.5.1] - 2026-08-01

### 新增

- 优化扫描与性能，支持自定义扫描路径

## [1.5.0] - 2026-08-01

### 新增

- 统一 UI 配色为灰阶并优化仪表盘布局
- 增强数据序列化与前端健壮性

## [1.4.0] - 2026-07-01

### 新增

- 知识库：跨项目笔记中心（Markdown、标签、置顶、全文搜索）
- 仓库知识挖掘：README / 技术栈 / 语言占比
- Claude 记忆导入
- 命令面板（⌘/Ctrl+K）
- PWA 可安装

## [1.3.0] - 2026-06-01

### 新增

- 智能项目分组（Monorepo 识别、级别调整）
- 仓库收藏与按需刷新历史
- 项目详情页：趋势折线图、提交热力图

## [1.2.0] - 2026-05-01

### 新增

- 仪表盘：每日目标进度环、项目卡片、工作日检查

## [1.1.0] - 2026-04-01

### 新增

- 自动发现本地 Git 仓库与基础提交统计
- 模糊搜索

## [1.0.0] - 2026-03-01

### 新增

- 首个正式版本：Wails 桌面应用骨架、GitHub Actions 多平台构建发布

[Unreleased]: https://github.com/sky-jiangcheng/GitBuddy/compare/v1.7.2...HEAD
[1.7.2]: https://github.com/sky-jiangcheng/GitBuddy/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/sky-jiangcheng/GitBuddy/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/sky-jiangcheng/GitBuddy/compare/v1.6.3...v1.7.0
[1.6.3]: https://github.com/sky-jiangcheng/GitBuddy/compare/v1.6.2...v1.6.3
[1.6.2]: https://github.com/sky-jiangcheng/GitBuddy/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/sky-jiangcheng/GitBuddy/releases/tag/v1.6.1
[1.5.7]: https://github.com/sky-jiangcheng/GitBuddy/compare/v1.5.5...v1.5.7
[1.5.6]: https://github.com/sky-jiangcheng/GitBuddy/compare/v1.5.5...v1.5.6
[1.5.5]: https://github.com/sky-jiangcheng/GitBuddy/releases/tag/v1.5.5
[1.5.3]: https://github.com/sky-jiangcheng/GitBuddy/releases/tag/v1.5.3
[1.5.2]: https://github.com/sky-jiangcheng/GitBuddy/releases/tag/v1.5.2
[1.5.1]: https://github.com/sky-jiangcheng/GitBuddy/releases/tag/v1.5.1
[1.5.0]: https://github.com/sky-jiangcheng/GitBuddy/releases/tag/v1.5.0
[1.4.0]: https://github.com/sky-jiangcheng/GitBuddy/releases/tag/v1.4.0
[1.3.0]: https://github.com/sky-jiangcheng/GitBuddy/releases/tag/v1.3.0
[1.2.0]: https://github.com/sky-jiangcheng/GitBuddy/releases/tag/v1.2.0
[1.1.0]: https://github.com/sky-jiangcheng/GitBuddy/releases/tag/v1.1.0
[1.0.0]: https://github.com/sky-jiangcheng/GitBuddy/releases/tag/v1.0.0

## [1.7.2] - 2026-08-18

深度代码审查（`docs/code-review/2026-08-18-deep-review.md`）缺陷修复：

### 修复

- **🔴 并发数据库锁**：`InitDB` 限制连接池为单连接（`SetMaxOpenConns(1)` + `SetConnMaxLifetime(0)`）并设置 `PRAGMA busy_timeout=5000`，消除并发 Wails/扫描/插件访问导致的 `database is locked`
- **🔴 知识缓存静默失效（存量库）**：新增 v10 幂等迁移，为早期版本创建的 `repo_meta` 补齐 `dependencies` / `top_contributors` / `activity` 三列（`createTables` 新建表已含，存量库需此修复才能命中缓存）
- **🟠 知识源状态误报**：插件导入 `TriggerImport` 的 `lastErr` 改为记录逐文档 upsert 真实错误，知识源 `Enabled` 不再恒为 true
- **🟠 大仓库挂起**：`DetectContributors` 用 30s 上下文超时包裹 `git shortlog`
- **🟠 首屏阻塞**：`GetProjects` / `GetProjectStats` 的按需 git 统计刷新移至后台 goroutine，仪表盘/概览首开不再卡顿
- **🟠 `git_author` 配置生效**：运行时可设置个人作者，覆盖自动检测的 `git user.name`（"我的"统计/热力图/最近提交随之更新）
- **🟡 健壮性**：`mineAndCache` 记录 `UpsertRepoMeta` 错误而非吞掉；`Mine` 返回非 nil 切片避免 JSON `null`；按语言行数统计 scanner 缓冲放大到 16MB（兼容 minified 文件）；`daily_stats` 新增真实提交数 `commits` 列（此前热力图误用 `COUNT(DISTINCT author)`）

### 维护

- **🟡 `InferRepoMeta` 无超时**：派生仓库展示名时读取 `git config user.name` 改用 30s 上下文超时包裹，避免挂掉的 working tree 阻塞扫描/发现路径
- **🟡 `refreshProjectStatsForDate` 缺失非零守卫**：与 `refreshRepoStatsRange` 对齐，git 出错返回的全 0 `Result` 不再写入每日统计行（原会令仪表盘显示「0」而非「无数据」，掩盖错误）
- **版本号对齐**：`internal/version/version.go` 经 `scripts/bump-version.sh` 同步至 `1.7.2`（`wails.json` / `web/package.json` 一并更新），消除应用内报告版本与 tag 长期漂移

## [1.7.1] - 2026-08-18

### 修复

- 修复 ESLint 被 TypeScript 7.0 兼容性阻塞问题：降级 TypeScript 至 6.0.3，修复 react-hooks/refs 违规（4 个 hook），修复 set-state-in-effect 违规（7 个文件），修复 markdown.ts 不必要转义和 seo.ts 缺失依赖
