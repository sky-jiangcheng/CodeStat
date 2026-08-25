---
title: 知识源导入
order: 8
---

# 知识源导入

> ⚠️ **实验性**：插件系统接口可能变更，不作为平台扩展方向（见 [ADR-0006](../adr/0006-scope-freeze.md)）。

GitBuddy 支持通过 yaegi 解释执行的 Go 脚本向知识库幂等导入文档。

## 内置知识源

| 源 | 说明 |
|----|------|
| `claude` | 导入 `~/.claude/projects/*/memory/*.md`，按项目名 / 仓库路径匹配归属 |

启动自动导入可在 **设置 → 插件** 开关（`auto_import` 配置项）。手动触发见设置页。

## 幂等导入语义

运行时按 `(project_id, source, title)` upsert：重复导入**更新**既有笔记而非重复创建。
