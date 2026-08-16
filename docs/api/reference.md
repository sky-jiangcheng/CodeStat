---
title: API 参考
order: 22
---

# API 参考

GitBuddy 的对外接口是 **Wails 绑定面**：Go 方法经 Wails Bind 暴露给前端（`window.go.main.App.<方法名>`），方法名与 JSON 载荷即契约。`docs/api/openapi.json` 以 HTTP 路径形式**镜像同一契约**，供 AI 代理与网关消费者阅读——桌面应用本身不监听 HTTP 端口。

> 绑定层是薄委托（`internal/app`），实现全部在 `internal/service`；CLI 与 MCP 复用同一实现。

## 1.7.0 契约变更

- `GetHeatmapData(projectId int64)`：新增参数，`0` 为全局，`>0` 限定该项目的仓库（此前项目详情页误用全局数据）
- 移除从未被前端调用的死方法：`ExportProjectStats`、`ExportHeatmapCSV`、`GetNoteVersion`、`ScanForRepositories`、`RefreshStats`、`RefreshAllStats`、`RefreshProjectStats`

---

## 项目

| 方法 | 签名 | 说明 |
|------|------|------|
| `GetProjects` | `(date string, starredOnly bool) → ProjectResponse[]` | 项目列表（默认昨天；今/昨无数据时按需触发单日刷新） |
| `GetProjectDetail` | `(id) → ProjectDetail` | 项目 + 仓库列表及各自历史统计 |
| `GetProjectStats` | `(id, date) → DailyStat[]` | 某日（默认昨天）项目统计 |
| `GetProjectOverview` | `(id) → ProjectOverview` | 知识挖掘：README/技术栈/语言/依赖/贡献者/活跃度/最近提交（缓存于 repo_meta，未命中异步挖掘） |
| `SearchProjects` | `(query) → ProjectResponse[]` | 名称/路径模糊搜索（含昨日统计增强） |
| `ToggleStar` | `(id) → bool` | 切换收藏，返回新状态（原子 UPDATE） |
| `UpdateProjectLevel` | `(id, "up"\|"down") → {success, new_level}` | 合并/拆分项目（单事务） |
| `RefreshProjectHistory` | `(id) → {success}` | 回填该项目近 365 天统计 |

**ProjectResponse**（节选）：

```json
{
  "id": 1, "name": "my-project", "root_path": "/Users/me/code/my-project",
  "is_starred": true, "repo_count": 2,
  "total_added": 1200, "total_deleted": 300,
  "my_added": 800, "my_deleted": 200, "my_files": 15,
  "is_workday": true, "below_standard": false
}
```

## 扫描

| 方法 | 签名 | 说明 |
|------|------|------|
| `TriggerScan` | `() → {success, task_id}` | 异步全量扫描，立即返回 |
| `GetScanStatus` | `() → ScanStatus` | `{running, backfilling, message, progress, total}` |

## 摘要与状态

| 方法 | 签名 | 说明 |
|------|------|------|
| `GetSummary` | `(date) → Summary` | 全局日摘要（团队/个人新增删除、文件、仓库数、是否工作日） |
| `GetHeatmapData` | `(projectId) → {days: HeatmapDay[]}` | 近一年热力图；`projectId>0` 限定项目 |
| `GetStatusBar` | `() → StatusBarData` | 当前时间 + 最近提交（30s 缓存） |
| `GetTodoCounts` / `GetNoteCounts` | `() → counts[]` | 各项目待办（未完成/总数）与笔记计数 |

## 搜索

| 方法 | 签名 | 说明 |
|------|------|------|
| `SearchNotes` | `(query) → SearchHit[]` | 笔记 FTS5 搜索（bm25 + snippet 高亮） |
| `SearchAll` | `(query) → SearchHit[]` | 笔记 + 待办联合搜索 |

## 笔记

| 方法 | 说明 |
|------|------|
| `ListNotes(projectID)` / `ListAllNotes()` / `ListAllTags()` | 项目笔记 / 全局笔记（含项目名）/ 全部标签 |
| `CreateNote(projectID, content)` | 创建（默认 kind=other, source=manual） |
| `CreateNoteWithMeta(projectID, title, content, tags, kind, source)` | 带元数据创建 |
| `UpdateNote(noteID, content)` / `UpdateNoteMeta(noteID, title, tags, kind, pinned)` | 更新内容 / 元数据 |
| `PinNote(noteID, pinned)` / `MoveNote(noteID, projectID)` / `DeleteNote(noteID)` | 置顶 / 迁移 / 删除 |
| `ListNoteVersions(noteID)` | 版本列表（最近 50） |
| `RestoreNoteVersion(noteID, versionID)` | 恢复到历史版本 |
| `DiffNoteVersions(noteID, versionID)` | 版本 vs 当前行级 diff（`+/-/空格` 前缀） |

创建成功会发出插件事件 `note.created`。

## 待办

`ListTodos(projectID)` / `CreateTodo(projectID, title)` / `ToggleTodo(id)` / `DeleteTodo(id)` / `ReorderTodos(ids[])`（单事务重排）。

## 配置

| 方法 | 说明 |
|------|------|
| `GetConfig()` | `{config: map, scan_roots: []}` |
| `UpdateConfig(key, value)` | 允许键：`daily_code_standard` / `scan_depth` / `git_author` / `auto_import`（数值键校验数字） |
| `UpdateScanRoots(roots[])` | 原子替换扫描根列表 |

## AI 导出与插件

| 方法 | 说明 |
|------|------|
| `GenerateLLMsTxt()` | 面向 LLM 的知识库总览 Markdown |
| `ExportNoteAsMarkdown(noteID)` | 带 YAML frontmatter 的笔记 Markdown |
| `GetPluginStatuses()` / `ReloadPlugins()` | 插件加载状态 / 热重载 |
| `GetKnowledgeSources()` | 知识源列表（内置 claude + 插件注册） |
| `TriggerKnowledgeImport(name)` / `TriggerAllKnowledgeImports()` | 触发导入（发出 `import.completed` 前端事件） |
| `ImportClaudeMemory()` | Claude 记忆一键导入 |
| `Health()` | `{status, version}` |

## 事件（Wails → 前端）

| 事件 | 载荷 |
|------|------|
| `import.completed` | `{source, created, updated, skipped, error?}` |

---

## OpenAPI

机器可读契约见 [openapi.json](openapi.json)（版本随 `internal/version`，路径与上表方法一一对应）。⚠️ 该 spec 描述的是**绑定面镜像**；桌面应用不提供 HTTP 服务（见 [TODO](../../TODO.md)）。
