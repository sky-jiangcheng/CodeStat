---
title: API 参考
---

# API 参考

GitBuddy 提供两类接口：Wails 绑定方法（桌面模式下直调）与 HTTP REST API（开发模式代理）。
以下文档列出所有可用的 API 端点，对应 Wails 绑定方法的签名。

## 鉴权

所有请求通过内嵌服务器转发，无需额外鉴权。远程访问需通过防火墙或 SSH 隧道。

---

## 项目与仓库

### 获取项目列表

```
GET /projects?date=2024-01-01&starred_only=false
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `date` | string | 查询日期，格式 YYYY-MM-DD，默认昨天 |
| `starred_only` | boolean | 仅返回收藏的项目 |

**响应**：`ProjectResponse[]`

```json
[
  {
    "id": 1,
    "name": "my-project",
    "root_path": "/Users/me/code/my-project",
    "is_starred": true,
    "repo_count": 2,
    "total_added": 1200,
    "total_deleted": 300,
    "my_added": 800,
    "my_deleted": 200,
    "my_files": 15,
    "is_workday": true,
    "below_standard": false
  }
]
```

### 收藏/取消收藏

```
POST /projects/:id/star
```

**响应**：`{ "starred": true }`

### 刷新历史记录

```
POST /projects/:id/refresh-history
```

触发指定项目下所有仓库的近 365 天历史数据回填。

### 项目概览（仓库知识挖掘）

```
GET /projects/:id/overview
```

返回 README 摘录、技术栈、语言占比、依赖、贡献者、活跃度等挖掘数据。

**响应**：`ProjectOverview`

```json
{
  "readme_excerpt": "# My Project\n...",
  "tech_stack": [{"name": "Go", "category": "language"}],
  "languages": [{"language": "Go", "count": 15000}],
  "dependencies": [{"name": "gin", "version": "v1.9.1", "source": "go"}],
  "top_contributors": [{"author": "John Doe", "count": 42}],
  "activity": {
    "total_commits": 1580,
    "active_days": 45,
    "last_commit_date": "2024-06-15",
    "commit_rate_30d": 28,
    "active_months": 11
  },
  "recent_commits": [...],
  "cached": false
}
```

---

## 扫描

### 触发扫描

```
POST /scan
```

**响应**：`{ "success": true, "repos_found": 12, "projects": 3, "task_id": "1234567890" }`

### 查询扫描状态

```
GET /scan/status
```

**响应**：`{ "running": false, "backfilling": false, "progress": 0, "total": 0, "message": "" }`

---

## 统计

### 获取汇总

```
GET /summary?date=2024-06-15
```

**响应**：`SummaryData`

```json
{
  "date": "2024-06-15",
  "repo_count": 12,
  "total_files": 45,
  "total_added": 3200,
  "total_deleted": 800,
  "my_added": 2100,
  "my_deleted": 500,
  "my_files": 28,
  "is_workday": true
}
```

### 获取热力图数据

```
GET /heatmap
```

**响应**：`{ "days": [{ "date": "2024-06-15", "lines_added": 300, "lines_deleted": 50, "commits": 5 }] }`

### 获取状态栏信息

```
GET /status
```

**响应**：`StatusBarData`

```json
{
  "current_time": "2024-06-15 14:30:00",
  "last_commit_time": "2024-06-15 14:25:00",
  "last_commit_repo": "my-project",
  "last_commit_branch": "main",
  "last_commit_msg": "feat: add search"
}
```

---

## 笔记（知识库）

### 获取项目笔记

```
GET /notes?project_id=1
```

### 创建笔记

```
POST /notes
Content-Type: application/json

{ "project_id": 1, "content": "# Hello", "title": "入门笔记", "tags": "guide", "kind": "knowledge" }
```

**响应**：`Note`

### 更新笔记

```
PUT /notes/:id
Content-Type: application/json

{ "content": "# Updated" }
```

### 更新笔记元数据

```
PUT /notes/:id/meta
Content-Type: application/json

{ "title": "新标题", "tags": "new-tag", "kind": "log", "pinned": true }
```

### 置顶/取消置顶

```
PUT /notes/:id/pin
Content-Type: application/json

{ "pinned": true }
```

### 删除笔记

```
DELETE /notes/:id
```

### 获取所有笔记

```
GET /notes/all
```

### 获取所有标签

```
GET /notes/tags
```

### 移动笔记到其他项目

```
POST /notes/:id/move
Content-Type: application/json

{ "project_id": 2 }
```

### 笔记版本历史

```
GET /notes/:id/versions
```

**响应**：`NoteVersion[]`

```json
[
  { "id": 1, "note_id": 5, "title": "入门笔记", "content": "...", "tags": "guide", "kind": "knowledge", "created_at": "2024-06-10" }
]
```

### 回滚笔记到历史版本

```
POST /notes/:id/versions/:version_id/restore
```

### 查看笔记版本差异

```
GET /notes/:id/versions/:version_id/diff
```

**响应**：`string`（行级 diff，`-` 删除，`+` 新增，` ` 未变）

---

## 待办

### 获取项目待办

```
GET /todos?project_id=1
```

### 创建待办

```
POST /todos
Content-Type: application/json

{ "project_id": 1, "title": "完成任务", "priority": 1 }
```

### 切换待办完成状态

```
POST /todos/:id/toggle
```

### 删除待办

```
DELETE /todos/:id
```

---

## 搜索

### 搜索笔记

```
GET /search/notes?q=关键词
```

**响应**：`SearchHit[]`

```json
[
  { "type": "note", "id": 5, "project_id": 1, "project_name": "my-project", "title": "入门笔记", "snippet": "...关键词...", "tags": "guide", "updated_at": "2024-06-15", "rank": 0.85 }
]
```

### 综合搜索（笔记 + 待办）

```
GET /search/all?q=关键词
```

---

## 配置

### 获取配置

```
GET /config
```

**响应**：`{ "config": { "daily_code_standard": "500", "scan_depth": "2" }, "scan_roots": ["/Users/me/code"] }`

### 更新配置

```
PUT /config
Content-Type: application/json

{ "key": "daily_code_standard", "value": "800" }
```

### 更新扫描根目录

```
PUT /config/scan-roots
Content-Type: application/json

{ "scan_roots": ["/Users/me/code", "/Users/me/projects"] }
```

---

## 知识导入

### 导入 Claude 记忆

```
POST /knowledge/import
```

**响应**：`{ "synced": 5, "updated": 2, "skipped": 1 }`

### 获取导入源状态

```
GET /knowledge/sources
```

### 触发指定导入源

```
POST /knowledge/import/:name
```

**响应**：`{ "created": 3, "updated": 1, "skipped": 2 }`

---

## 插件

### 获取插件状态

```
GET /plugins
```

**响应**：`PluginStatus[]`

```json
[
  { "name": "my-plugin", "enabled": true, "error": "" }
]
```

### 重载插件

```
POST /plugins/reload
```

---

## 健康检查

```
GET /health
```

**响应**：`{ "status": "ok", "version": "1.5.7" }`
