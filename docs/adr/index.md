---
title: 架构决策（ADR）
order: 21
---

# 架构决策记录（ADR）

| 编号 | 标题 | 状态 |
|------|------|------|
| [0001](0001-plugin-platform.md) | 插件平台（M1-M4：HTTP server / RBAC / PG-ES / K8s） | Superseded（被 0002 取代） |
| [0002](0002-c-end-repositioning.md) | C 端重新定位：本地优先「代码项目第二大脑」+ 进程内插件 | Accepted |
| [0003](0003-fts5-search.md) | FTS5 trigram 全文搜索 | Accepted |
| [0004](0004-block-editor.md) | 块编辑器（产物保持纯 Markdown） | Accepted |
| [0005](0005-service-layer.md) | 服务层重构（service / app / domain 分层） | Accepted |
| [0006](0006-scope-freeze.md) | 范围冻结与功能分级（核心闭环优先） | Accepted |

## 约定

- 每个重大不可逆决策一篇：背景 → 决策 → 后果
- 被 superseded 的 ADR 保留原文与横幅，不删除
- 新 ADR 从 `0006` 递增编号，文件名 `NNNN-kebab-title.md`
