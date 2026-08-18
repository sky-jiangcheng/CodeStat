---
title: 架构说明
order: 20
---

# 架构说明

> 1.7.0 服务层重构的动机与取舍见 [ADR-0005](adr/0005-service-layer.md)；产品定位见 [ADR-0002](adr/0002-c-end-repositioning.md)。

## 总体形态

单文件 **Wails v2** 桌面应用：Go 后端 + React SPA（`web/dist` 经 `go:embed` 打进二进制），SQLite（modernc 纯 Go，零 CGO），统计通过本机 `git` CLI 读取。**本地优先**：不监听端口、不上传数据。

## 分层（后端）

```
main.go                  Wails 入口：DB 初始化、扫描根播种、窗口/AssetServer/安全头
   │
internal/app             绑定层：每方法 1-3 行委托 service（transport glue）
   │
internal/service         业务核心（唯一访问 db 与 git Provider 的层）
   │            │
internal/db   internal/core/git
(SQLite 查询)   (Git Provider 抽象，本地 CLI 实现)
```

**Wails 桌面与 MCP（cmd/mcp）两种入口共享同一 service 实现**——行为永远一致，新功能只需实现一次。

支撑包：`internal/domain`（跨层行类型）、`internal/version`（版本 SSOT）、`internal/diff`（笔记行级 diff）、`internal/stats`（git log 解析）、`internal/knowledge`（仓库知识挖掘）、`internal/scanner` + `internal/grouper`（扫描与分组）、`internal/platform`（OS 差异）、`internal/core/plugin`（插件 SPI + yaegi 运行时）。

## 关键数据流

### 扫描管线（service/scan.go，唯一管线）

```
scan_roots ──▶ scanner.ScanRepositories ──▶ grouper.GroupRepositories
        ──▶ db 事务：SyncProjectTx + UpsertRepositoryTx + CleanupStaleDataTx
        ──▶ refreshCollectedStats（365 天窗口，all + 个人作者双行 upsert）
        ──▶ 事件 project.scanned
```

### 统计刷新（service/refresh.go，唯一循环）

`refreshRepoStatsRange`：对单仓库按日期区间查询 `git log --shortstat` 聚合，跳过零行，写 `all` 与个人作者两行；取消感知。扫描完成刷新、项目历史回填、按需单日刷新共用此实现。

### 知识库

`project_notes` + FTS5 trigram 虚拟表（bm25 排序，短查询降级 LIKE，见 [ADR-0003](adr/0003-fts5-search.md)）；每次更新触发器写入 `note_versions` 快照（保留 50），diff 由 `internal/diff` LCS 生成。

### 插件运行时（ADR-0002）

yaegi 解释 `<config>/gitboard/plugins/*/plugin.go`；事件总线 + 知识源注册表；内置 `claude` 导入器与脚本插件同一 upsert 路径。

## 前端（web/src）

```
api/        types + transport（Wails window.go / HTTP 双模）+ endpoints（每后端方法一个函数）
hooks/      useApiData（TTL 缓存+去重）/ useDebouncedCallback / useScanPolling / useConfirmClick
pages/      Knowledge（首页）/ Dashboard / ProjectDetail / Settings，大页面按域拆子组件
components/ ProjectCard / Heatmap / TrendChart / notes/NoteEditor / notes/VersionHistoryPanel…
locales/    zh-CN + en（i18next 懒加载）
styles/     设计系统：tokens / reset / components / layouts / features
```

无全局状态库：页面级 `useState` + hooks；主题走 `data-theme` CSS 变量。

## 数据库（internal/db）

单文件 SQLite（WAL + 外键），8 个版本化迁移自动执行；表：`projects` / `repositories` / `daily_stats` / `project_notes`(+FTS) / `project_todos`(+FTS) / `note_versions` / `repo_meta` / `app_config` / `scan_roots`。查询按域拆分文件（projects.go / notes.go / …）；升降级等事务操作（`SplitProjectDown` / `MergeProjectUp`）有单测覆盖。

## 构建与产物

| 产物 | 来源 | 说明 |
|------|------|------|
| `gitboard` | 根包 | Wails 桌面应用（`scripts/build.sh`） |
| `gitboard-mcp` | `cmd/mcp` | MCP stdio 服务器（知识库查询工具） |
| `gitboard-agent-score` | `tools/agent-score` | AI 就绪度自检 |

CI（`.github/workflows/release.yml`）多平台构建 + macOS 签名公证；文档站（`pages.yml`）由 `scripts/build-docs.mjs` 从 `docs/**/*.md` 生成后部署 GitHub Pages。
