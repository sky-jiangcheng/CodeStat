---
title: GitBuddy 文档
---

# GitBuddy 文档

<p class="subtitle">本地优先的「代码项目第二大脑」：自动发现本地 Git 仓库，桌面仪表盘可视化每日提交量；内置知识库、仓库知识挖掘、插件系统与 AI 就绪接口（CLI / MCP / llms.txt）。</p>

<!--NAV_LINKS-->

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
