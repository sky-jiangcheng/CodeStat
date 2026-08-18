# GitBuddy 深度代码审查报告（2026-08-18）

审查范围：Go 后端（service/db/core/stats/knowledge/scanner/grouper/diff）、CLI/MCP/agent-score、前端 React/TS、CI 与文档。
验证方式：`go build ./...`、`go vet ./...`、`go test ./...`（后台终端实测），前端静态比对。

## 高严重度

### H1. service 包编译失败，全链路构建中断

- 位置：`internal/service/project.go:8`
- 问题：存在未使用的 `"sync"` 导入，`go build ./internal/service/` 报 `"sync" imported and not used`，阻塞 `internal/app`、`cmd/mcp`、`tools/agent-score` 全部构建。
- 修复：删除该导入。

### H2. 内置 Claude 导入器注册后被立即清空

- 位置：`internal/service/service.go:86-87`、`internal/core/plugin/runtime/runtime.go:91`
- 问题：`Startup()` 先 `registerClaudeImporter()` 注册 `sources["claude"]`，随后 `s.rt.Load(pluginsDir())` 把 `r.sources` 重置为空 map。内置 Claude memory 导入器运行时不可用，Knowledge 页"导入 Claude 记忆"报 `unknown knowledge source`。`ReloadPlugins`（plugin.go:89）同样触发。
- 修复：调整顺序为先 `Load` 后注册；`ReloadPlugins` 后重新注册内置源。

### H3. 收藏开关功能实际不可用（前端）

- 位置：`web/src/api/endpoints.ts:62-69`、`web/src/pages/Dashboard.tsx:83-95`
- 问题：Wails 绑定 `ToggleStar(id) (bool, error)` 序列化为裸布尔值，前端却按 `{ starred: boolean }` 解包，`r.starred` 恒为 `undefined`。连锁导致 `newStarred` 恒 `undefined`、"仅收藏"视图下每次点星都移除卡片、`is_starred` 被污染。
- 修复：`call<boolean>` 直接返回。

## 中严重度

### M4. fresh checkout 下 `go build ./...` 必失败

- 位置：`main.go:21`
- 问题：`//go:embed all:web/dist`，无 `web/dist` 时报 `pattern all:web/dist: no matching files found`。CI 因先跑 `npm run build` 不触发。
- 修复：仓库内置占位 `web/dist/index.html`，允许无前端产物时编译。

### M5. `collected` 标志从未置位，收藏项目历史回填失效

- 位置：`internal/db/db.go:246-248`、`internal/db/projects.go:150-166`、`internal/service/scan.go:46`
- 问题：迁移 v5 加列 + 查询存在，但全库无 `UPDATE projects SET collected=TRUE`。`GetCollectedProjectIDs` 恒空，`refreshCollectedStats` 永不执行。
- 修复：扫描流程完成后将本次扫描的项目标记 `collected`。

### M6. `git_author` 配置设置后不生效

- 位置：`internal/service/config.go:20`、`internal/service/service.go:69`
- 问题：允许写入 `git_author`，但 `s.guser` 仅在 `New()` 时固定。"mine" 统计、热力图、RecentCommits 均不随配置刷新。
- 修复：`UpdateConfig("git_author", v)` 时同步更新 `s.guser`（加锁）。

### M7. 热力图 commits 数值错误

- 位置：`internal/db/daily_stats.go:60`
- 问题：`COUNT(DISTINCT d.author)` 被当作 `Commits`，显示的是当日去重作者数而非提交数。
- 修复：`daily_stats` 增加 `commits` 列（迁移 v6），刷新时写入真实提交数，热力图用 `SUM(commits)`。

### M8. Markdown 渲染 XSS 与崩溃风险

- 位置：`web/src/utils/markdown.ts:14,105-108,169-172,217-220`
- 问题：
  - mermaid `securityLevel: 'loose'` 允许点击回调执行；
  - KaTeX/hljs 在 `DOMPurify.sanitize` 之后注入、输出未再净化；
  - `hljs.highlight` 对未知语言抛未捕获异常，含 ` ```unknowngolang ` 代码块的笔记渲染崩溃。
- 修复：`securityLevel` 改 strict；hljs 包 try/catch 并校验语言名；KaTeX 输出再净化。

### M9. 前端异步响应竞态

- 位置：`web/src/pages/Dashboard.tsx:36-55,61-70`、`web/src/pages/Knowledge.tsx:68-73`
- 问题：快速切换 date/starredOnly 时旧响应覆盖新响应；`searchAll` 旧结果覆盖新结果。
- 修复：请求序号比对 / AbortController。

## 低严重度

### L10. `lastErr` 恒为 nil

- 位置：`internal/core/plugin/runtime/runtime.go:294`
- 问题：`TriggerImport` 中 err 非 nil 时已早返回，此处赋 nil，`SourceStatus.Enabled` 恒 true，源失败状态不可见。
- 修复：记录循环内首个 doc 错误。

### L11. `upsertDoc` 非事务

- 位置：`internal/core/plugin/runtime/runtime.go:302-327`
- 问题：`UpdateNote` 与 `UpdateNoteMeta` 分两步执行，meta 失败则数据不一致。
- 修复：包在单个事务中。

### L12. `TriggerImport` 无 per-source 互斥

- 位置：`internal/core/plugin/runtime/runtime.go:261`
- 问题：并发触发同一源会重复导入。
- 修复：加导入互斥锁。

### L13. MCP `gitboard_notes_list` 忽略 `limit` 参数

- 位置：`cmd/mcp/main.go:42-47`
- 问题：schema 声明了 limit 却全量返回。
- 修复：透传 limit 到 `ListAllNotes`。

### L14. 前端卸载后 setState/定时器泄漏

- 位置：`web/src/pages/Knowledge.tsx:35-38`、Dashboard/Settings/PluginsTab、`web/src/hooks/useScanPolling.ts:33-45`
- 问题：setTimeout 未清理；组件卸载后 setState；扫描完成回调在卸载后仍触发父组件刷新。
- 修复：定时器引用管理 + 卸载标志。

### L15. `Backfilling` 字段后端恒 false

- 位置：`internal/service/scan.go:26`
- 问题：定义字段但无置位处。
- 修复：回填阶段置 `backfilling=true`；前端判断保留。

### L16. 文档引用不存在的 `cmd/gitboard`

- 位置：README.md:113、SKILL.md:21、docs/getting-started.md:90、docs/architecture.md
- 问题：仓库只有 cmd/mcp 与 tools/agent-score，`cmd/gitboard` 不存在。
- 修复：更正文档。

### L17. agent-score 依赖 CWD

- 位置：`tools/agent-score/main.go:128-150`
- 问题：SKILL.md 与 locales 用相对路径，从其他目录运行误报。
- 修复：基于可执行文件路径定位项目根。

### L18. `handleRefreshHistory` 整页 loading 闪烁

- 位置：`web/src/pages/Dashboard.tsx:97-104`
- 问题：刷新单个项目后调用 `fetchData` 触发全屏 skeleton。
- 修复：静默刷新（不置 loading）。

### L19. HTTP fallback 模式无真实后端

- 位置：`web/src/api/transport.ts:34-43`、docs/api/openapi.json
- 状态：已知事项（TODO.md 已记录），桌面端 Wails 绑定 + SPA 静态服务，HTTP 路由不实现。
- 处理：保持现状，文档标注。

### L20. `GetRecentCommits` 未做 author 校验

- 位置：`internal/stats/stats.go:277`
- 问题：filterAuthor 仅来自 s.guser，实际风险低。
- 修复：与 `GetRecentCommit` 保持一致，调用前校验。

## 亮点（无需修改）

- Wails 双模 transport 与绑定面收敛干净；ProjectResponse/SummaryData 前后端字段一致。
- QueryStats/QueryStatsRange 对 date/author 参数校验 + 30s/120s 超时，命令注入面收口。
- 迁移循环增量安全；ToggleProjectStar 用 RETURNING 避免 TOCTOU。
- 插件 runtime 全面 recover，脚本 panic 不会拖垮宿主。
- useScanPolling 对 interval 清理、卸载取消有基本防护。
