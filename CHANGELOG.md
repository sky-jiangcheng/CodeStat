# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

版本号同步由 `scripts/bump-version.sh` 维护（SSOT：`wails.json` → `info.productVersion`）。

## [1.6.1] - 2026-08-10

### 新增
- 产品正式更名为 GitBuddy（旧名 GitBoard 残留仅保留 module/包路径级引用）
- 记录产品定位决策 ADR 0002，并标记 RFC 0001（插件平台）为 Superseded
- 社区健康文件（issue #25）：CHANGELOG / CONTRIBUTING / SECURITY / CODE_OF_CONDUCT / SUPPORT / Issue+PR 模板 / Dependabot
- 进程内插件系统：yaegi 脚本运行时（目录扫描 / 加载 / 事件总线 / panic 隔离），插件接口见 `internal/core/plugin`
- Claude 记忆导入重构为内置 KnowledgeImporter 插件，与脚本插件共享运行时导入/去重/统计路径
- 知识源导入触发：启动自动导入（可开关）+ 设置页手动触发 + 前端 toast 结果通知
- 知识库升级为首页，支持快速创建笔记（issue #31）
- 知识库体验增强（issue #37）：首屏搜索框自动聚焦、顶部「最近编辑」快速访问区、空状态引导创建或导入 AI 记忆、编辑器「关联项目」下拉快速迁移笔记（新增 `MoveNote` API）
- 设计系统重构（issue #9）：拆分单体 global.css 为设计系统 token + 组件样式，LCH 自适应色板
- Markdown 渲染增强（issue #10）：highlight.js 语法高亮、Mermaid 图、GFM callout（`> [!NOTE|TIP|IMPORTANT|WARNING|CAUTION|QUESTION]`）、KaTeX 数学公式、任务列表样式
- 全局无障碍基线（issue #12）：skip-link + focus-visible + reduced-motion
- 命令面板无障碍（issue #11）：focus trap + ARIA dialog/listbox
- BrowserRouter 路由升级（issue #13）：可分享 / 可被搜索引擎与 AI 收录的 URL，Pages `_redirects` fallback
- PWA 规范修复（issue #14）：theme-color 一致 + 离线 fallback + 安全加固
- SEO 规范（issue #21）：OG / Twitter Card / canonical / sitemap
- AI-ready 内容分发层（issue #15）：llms.txt + .md 路由 + 问答入口
- FTS5 全文搜索升级（issue #18）：FTS5 + 中文分词 + 相关性排序 + snippet 高亮
- 笔记版本历史 + Diff view（issue #16）：复用本地 Git，超越 GitBook CRUD
- 仓库知识挖掘加深（issue #20）：LOC / 依赖图 / 活跃度 / 贡献者
- 安全规范（issue #24）：CSP / HSTS / 安全策略声明 / 依赖扫描
- i18n 框架（issue #23）：字符串外提 + hreflang + 语言切换（zh-CN / en）
- 用户文档站（issue #26）：使用手册 / 教程 / FAQ（docs/ 落地页）
- API 参考文档（issue #27）：OpenAPI 渲染 + 端点说明
- OpenAPI spec + REST 版本化（issue #22）+ OpenAPI 自动渲染与 Try-it（issue #17）
- CLI + MCP + agent-score（issue #28）：`gitboard-mcp`、`tools/agent-score` 自检工具

## [1.5.7] - 2026-08-10

### 新增
- 块编辑器（issue #19）：Markdown 双轨编辑，输入 `/` 呼起 block 面板插入 callout/tabs/details/代码/Mermaid/公式等结构化块，块级拖拽排序与增删，编辑产物仍为可读 Markdown
- 桌面端深链路由兜底：Wails AssetServer 对未命中的 GET 请求回退 `index.html`，保证 BrowserRouter 深链（如 `/project/123`）直接加载/刷新可访问

## [1.5.5] - 2026-08-10

### 新增
- 启动时历史回填、收藏同步及默认扫描根目录播种

## [1.5.3] - 2026-07-25

### 修复
- 全量扫描策略优化为合并同步，增强跨平台支持

## [1.5.2] - 2026-07-25

### 新增
- 全面更新应用图标系统

## [1.5.1] - 2026-08-01

### 新增
- 优化扫描与性能，支持自定义扫描路径

## [1.5.0] - 2026-08-01

### 新增
- 统一 UI 配色为灰阶并优化仪表盘布局
- 增强数据序列化与前端健壮性

## [1.4.0] - 2026-07-01

### 新增
- 知识库：跨项目笔记中心（Markdown、标签、置顶、全文搜索）
- 仓库知识挖掘：README / 技术栈 / 语言占比
- Claude 记忆导入
- 命令面板（⌘/Ctrl+K）
- PWA 可安装

## [1.3.0] - 2026-06-01

### 新增
- 智能项目分组（Monorepo 识别、级别调整）
- 仓库收藏与按需刷新历史
- 项目详情页：趋势折线图、提交热力图

## [1.2.0] - 2026-05-01

### 新增
- 仪表盘：每日目标进度环、项目卡片、工作日检查

## [1.1.0] - 2026-04-01

### 新增
- 自动发现本地 Git 仓库与基础提交统计
- 模糊搜索

## [1.0.0] - 2026-03-01

### 新增
- 首个正式版本：Wails 桌面应用骨架、GitHub Actions 多平台构建发布

[Unreleased]: https://github.com/sky-jiangcheng/gitbuddy/compare/v1.6.1...HEAD
[1.6.1]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.6.1
[1.5.5]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.5.5
[1.5.3]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.5.3
[1.5.2]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.5.2
[1.5.1]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.5.1
[1.5.0]: https://github.com/sky-jiangcheng/gitbuddy/releases/tag/v1.5.0
