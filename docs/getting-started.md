---
title: 快速开始
order: 1
---

# 快速开始

GitBuddy 是一款本地 Git 仓库可视化面板，自动发现仓库并以仪表盘形式展示每日代码提交量统计，同时内置知识库与仓库知识挖掘功能。

## 下载安装

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/sky-jiangcheng/gitboard/master/scripts/install.sh | bash
```

### Windows

```powershell
iwr -useb https://raw.githubusercontent.com/sky-jiangcheng/gitboard/master/scripts/install.ps1 | iex
```

或从 [GitHub Releases](https://github.com/sky-jiangcheng/gitboard/releases) 下载对应平台的二进制文件。

## 首次启动

启动后应用自动打开浏览器，默认访问 `http://localhost:18731`。

### 1. 配置扫描目录

进入 **设置** 页面，配置扫描根目录：

| 平台 | 默认扫描范围 |
|------|-------------|
| macOS | 当前用户 HOME 目录 |
| Linux | 当前用户 HOME 目录 |
| Windows | 除 C: 盘外的所有磁盘 |

### 2. 执行扫描

点击 **重新扫描** 按钮，应用将递归扫描指定目录下所有 Git 仓库。

> 首次扫描仅登记仓库名称，不会触发历史提交数据回填。

### 3. 收藏仓库

在仪表盘中找到目标仓库，点击星标将其收藏。收藏后卡片展示完整统计信息。

### 4. 回填历史数据

在收藏的仓库卡片上点击 **刷新历史记录**，系统将扫描该仓库近 365 天的每日提交数据。

## 核心功能

| 功能 | 说明 |
|------|------|
| 仪表盘 | 每日目标进度环、项目卡片、趋势折线图、提交热力图 |
| 知识库 | 跨项目笔记中心，支持 Markdown、标签、置顶、全文搜索 |
| 仓库知识挖掘 | 自动提取 README、技术栈、语言占比、依赖、贡献者、活跃度 |
| 命令面板 | `⌘/Ctrl+K` 快速搜索笔记/待办并跳转项目 |
| PWA | 支持安装到桌面/主屏幕 |

## 从源码构建

**前置要求**：Go 1.23+、Node.js 18+

```bash
# 安装前端依赖
cd web && npm install && cd ..

# 构建前端
cd web && npm run build && cd ..

# 编译二进制（前端资源自动 embed）
go build -ldflags="-s -w" -o gitboard .
```
