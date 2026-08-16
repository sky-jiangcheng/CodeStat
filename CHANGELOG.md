# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

版本号 SSOT 为 `internal/version/version.go`，由 `scripts/bump-version.sh` 同步至 `wails.json`、`web/package.json` 与文档站徽章。

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
- 日志路径按平台（Linux `$XDG_STATE_HOME`、Windows `%APPDATA%\gitboard\logs`），修复非 macOS 平台写入 `~/Library/Logs`
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

- 产品正式更名为 GitBuddy（旧名 GitBoard 残留仅保留 module/包路径级引用）
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
- CLI + MCP + agent-score（issue #28）：`gitboard-mcp`、`tools/agent-score` 自检工具

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

[Unreleased]: https://github.com/sky-jiangcheng/gitbuddy/compare/v1.7.0...HEAD
[1.7.0]: https://github.com/sky-jiangcheng/gitbuddy/compare/v1.6.3...v1.7.0
[1.6.3]: https://github.com/sky-jiangcheng/gitbuddy/compare/v1.6.2...v1.6.3
[1.6.2]: https://github.com/sky-jiangcheng/gitbuddy/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.6.1
[1.5.7]: https://github.com/sky-jiangcheng/gitbuddy/compare/v1.5.5...v1.5.7
[1.5.6]: https://github.com/sky-jiangcheng/gitbuddy/compare/v1.5.5...v1.5.6
[1.5.5]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.5.5
[1.5.3]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.5.3
[1.5.2]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.5.2
[1.5.1]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.5.1
[1.5.0]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.5.0
[1.4.0]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.4.0
[1.3.0]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.3.0
[1.2.0]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.2.0
[1.1.0]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.1.0
[1.0.0]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.0.0
