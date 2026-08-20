---
title: GitBuddy 文档
---

# GitBuddy 文档

<p class="subtitle">本地优先的代码项目上下文库：自动发现本地 Git 项目，理解每个项目「现在发生了什么、沉淀了哪些知识」，让用户和 AI 都能快速记录、检索与复用项目知识。</p>

<!--NAV_LINKS-->

## 产品定位

GitBuddy 的核心闭环：

```
发现项目 → 理解项目 → 记录知识 → 检索知识 → 交给 AI 使用
```

- **发现**：自动扫描本地 Git 仓库并按 Monorepo/单仓库智能分组
- **理解**：项目详情自动挖掘 README 摘要、技术栈、依赖、贡献者与活跃度
- **记录**：Markdown 笔记（分类/标签/版本历史），可导入 Claude 记忆
- **检索**：FTS5 全文搜索（含短 CJK 降级），命中可定位、可解释
- **AI 使用**：CLI / MCP / llms.txt 统一接口，供 Claude Code / Cursor 等直接消费

功能分级（核心 / 支持 / 实验性 / 暂缓）与范围冻结规则见 [ADR-0006](adr/0006-scope-freeze.md)。

## 文档说明

本手册覆盖 GitBuddy 的核心功能与使用场景。文档以 Markdown 编写（唯一内容源，存放于仓库 `docs/` 目录），由 `scripts/build-docs.mjs` 生成 HTML 后部署到 GitHub Pages。

- **在线浏览**：<https://sky-jiangcheng.github.io/gitbuddy/>，随 master 分支自动更新
- **本地生成**：`node scripts/build-docs.mjs`（依赖 `web/node_modules` 中的 marked）
- **问题反馈**：<https://github.com/sky-jiangcheng/gitbuddy/issues>

## 快速导览

| 我想… | 去看 |
|------|------|
| 安装并跑起第一次扫描 | [快速开始](getting-started.md) |
| 看提交量 / 目标 / 热力图 | [仪表盘](features/dashboard.md) |
| 写笔记、搜笔记、找回旧版本 | [知识库与笔记](features/knowledge.md) |
| 看某个项目的技术栈与依赖 | [项目详情](features/project-detail.md) |
| 让 Claude / Cursor 读写我的知识库 | [AI 集成](features/ai-integration.md) |
| 写一个插件或知识源导入器 | [插件手册](plugins/overview.md) |
| 理解代码分层与关键决策 | [架构说明](architecture.md)、[ADR](adr/index.md) |
