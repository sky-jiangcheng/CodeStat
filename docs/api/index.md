---
title: API 参考
order: 100
---

# API 参考

GitBuddy 提供 Wails 绑定方法与 HTTP REST API 两种调用方式。
以下文档列出所有可用的 API 端点。

> 本文档由仓库自动生成功能补充，完整 API 参考见 [API Reference](./reference.md)。

## 端点总览

| 分类 | 端点 | 方法 | 说明 |
|------|------|------|------|
| 项目 | `/projects` | GET | 获取项目列表 |
| 项目 | `/projects/:id/star` | POST | 收藏/取消收藏 |
| 项目 | `/projects/:id/refresh-history` | POST | 回填历史数据 |
| 项目 | `/projects/:id/overview` | GET | 仓库知识挖掘概览 |
| 扫描 | `/scan` | POST | 触发扫描 |
| 扫描 | `/scan/status` | GET | 查询扫描状态 |
| 统计 | `/summary` | GET | 获取汇总统计 |
| 统计 | `/heatmap` | GET | 获取热力图数据 |
| 统计 | `/status` | GET | 获取状态栏信息 |
| 笔记 | `/notes` | GET/POST | 笔记列表/创建 |
| 笔记 | `/notes/:id` | PUT/DELETE | 更新/删除笔记 |
| 笔记 | `/notes/:id/meta` | PUT | 更新笔记元数据 |
| 笔记 | `/notes/:id/pin` | PUT | 置顶笔记 |
| 笔记 | `/notes/:id/move` | POST | 迁移笔记到其他项目 |
| 笔记 | `/notes/:id/versions` | GET | 版本历史列表 |
| 笔记 | `/notes/:id/versions/:vid/restore` | POST | 回滚到历史版本 |
| 笔记 | `/notes/:id/versions/:vid/diff` | GET | 查看版本差异 |
| 待办 | `/todos` | GET/POST | 待办列表/创建 |
| 待办 | `/todos/:id/toggle` | POST | 切换完成状态 |
| 待办 | `/todos/:id` | DELETE | 删除待办 |
| 搜索 | `/search/notes?q=` | GET | 搜索笔记 |
| 搜索 | `/search/all?q=` | GET | 综合搜索 |
| 配置 | `/config` | GET/PUT | 获取/更新配置 |
| 知识 | `/knowledge/import` | POST | 导入 Claude 记忆 |
| 知识 | `/knowledge/sources` | GET | 导入源状态 |
| 知识 | `/knowledge/import/:name` | POST | 触发指定导入源 |
| 插件 | `/plugins` | GET | 插件状态 |
| 插件 | `/plugins/reload` | POST | 重载插件 |
| 健康 | `/health` | GET | 健康检查 |

## 调用方式

### Wails 绑定（桌面模式）

直接通过 `window.go.main.App.<Method>(args...)` 调用，无需 HTTP。

```typescript
// TypeScript 类型安全调用
const projects = await window.go.main.App.GetProjects('2024-06-15', false)
const notes = await window.go.main.App.ListNotes(projectId)
```

### HTTP API（开发/远程模式）

开发模式下 Vite 代理到 `localhost:18731`，远程模式直接访问端口。

```bash
curl http://localhost:18731/health
curl -X POST http://localhost:18731/scan
curl http://localhost:18731/search/all?q=gitboard
```

完整接口说明参见 [API Reference](./reference.md)。
