---
title: 项目详情
order: 4
---

# 项目详情

项目详情页展示单个项目下所有仓库的详细信息，包括统计、知识挖掘与提交记录。

## 页面结构

### 顶部导航

- 项目名称与路径
- 收藏/取消收藏切换按钮
- 刷新历史记录按钮
- 级别调整（提升/降低分组粒度）

### 项目概览（仓库知识挖掘）

自动从仓库工作树中提取：

- **技术栈**：从顶层 manifest 文件检测（package.json、go.mod、Cargo.toml 等）
- **语言占比**：按代码行数统计，展示 Top 8 语言
- **依赖列表**：解析 npm / Go / Cargo 直接依赖
- **Top 贡献者**：基于 `git shortlog -sn` 提取，展示 Top 5
- **活跃度**：近 30 天提交数、90 天活跃天数、总提交数、最近提交日期
- **README 摘录**：最多 200 行 / 8KB 的 README 内容
- 挖掘结果缓存于 `repo_meta` 表，重复加载时不重新扫描

### 提交统计

- 趋势折线图：每日提交量（近 30 天）
- 热力图：全年每日提交密度

### 知识库

该项目下的所有笔记（支持编辑、删除、查看历史）

## 仓库知识挖掘

挖掘过程在后台异步执行，首次加载时显示「实时挖掘」标签，完成后缓存标记为「来自缓存」。

支持的 manifest 文件：

| 文件 | 语言/框架 |
|------|---------|
| `package.json` | JavaScript / TypeScript |
| `go.mod` | Go |
| `Cargo.toml` | Rust |
| `pom.xml` | Java (Maven) |
| `build.gradle` | Java (Gradle) |
| `requirements.txt` | Python |
| `Dockerfile` | Docker |
| `docker-compose.yml` | Docker Compose |
