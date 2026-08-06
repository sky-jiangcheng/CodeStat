# GitBook 能力调研报告（2025–2026）

> 用途：为本地 Git 仓库可视化 + 知识笔记桌面应用 **GitBuddy** 与 GitBook 做差距对标。
> 信息来源：GitBook 官方文档站（`gitbook.com/docs`）、官方博客、Changelog、帮助中心、定价页、官方 GitHub 仓库（`GitbookIO/public-docs` 镜像）。检索时间窗聚焦 2025–2026 最新状态（截至 2026-08）。
> 说明：GitBook 在 2025 年完成了从"老 GitBook CLI（开源工具）"向"AI 原生托管文档平台"的产品形态跃迁，能力清单以**当前 SaaS 平台**为准；老的开源 `gitbook` CLI（`book.json` / `gitbook pdf`）已不是主线路径，仅在个别迁移场景被提及。

---

## 0. TL;DR（一句话定位）

GitBook 是一个 **AI 原生、托管式、块编辑 + Markdown 双轨、Git 双向同步、OpenAPI 即文档** 的现代文档/知识协作平台，2025–2026 的核心叙事是「让文档既 AI-ready 又 trustworthy」。它的强项是**开箱即用的视觉品味**、**面向 AI Agent 的内容分发（llms.txt / MCP / .md 路由）**、**双向 Git Sync + Change Request 协作流**、以及**OpenAPI 自动渲染 + Scalar Try-it**。

---

## 1. UI / 交互 / 设计品味

### 1.1 设计系统：从"header preset"升级为"Themes + Styles"语言
2025-04 GitBook 发布了完整的 docs 定制系统重构（官方博客：*How we upgraded docs customization*），核心理念是 **"一种语言，千万种声音"**——把数千种风格压缩成少量、可组合的选择。

- **4 套站点主题（Site themes）**：
  - `Clean`（默认，所有站点可用）：现代、半透明、最小化样式；primary/tint 影响链接与高亮元素。
  - `Muted`（所有站点可用）：低对比、背景更突出、部分元素反转。
  - `Bold`（Premium & Ultimate）：高冲击、强对比，primary 用于 header。
  - `Gradient`（Premium & Ultimate）：渐变背景 + 色彩泼溅。
- **样式（Styles）作为修饰层**：sidebar 样式（`default` 无背景 / `filled` 带背景）、link 样式、hint block 样式。关键设计哲学：**样式定义"去哪里"而非"怎么去"**——同一 `filled` 在 Clean 主题下是更深背景，在 Muted 主题下自动反转为更浅背景，保证任意组合都好看。
- **色彩系统**：primary color（链接/导航/当前页/面包屑/header 按钮）+ tint color（全站文字与图标的微妙染色，**不**影响导航元素）+ semantic colors（Premium，用于 hint block / code block 的 info/success/warning/danger）。
- **色彩技术**：2025-02 起改用 **LCH 感知色彩空间**（而非 RGB）生成色板，按"功能"分配每个 shade，并**保证可访问性对比度**——任意输入颜色都能自动生成达标色板，并在系统请求更高对比时自动调整。
- **自定义字体**（Custom fonts）：支持上传自有字体。
- **自定义 Logo**（Premium & Ultimate）：可分别上传 light/dark 两版 logo 替换标题与图标（推荐 ≥600px 宽）；icon 设置 132×132px，兼作 favicon。

> 官方来源：<https://gitbook.com/docs/publishing-documentation/customization/icons-colors-and-themes> · <https://www.gitbook.com/blog/how-we-upgraded-docs-customization>

### 1.2 亮色 / 暗色 / 跟随系统
- 站点可设默认模式（light / dark），并开启 **Show mode toggle** 让读者手动切换（toggle 位于发布页底部，桌面与移动端都有）。
- GitBook App 内的主题在 Settings 菜单切换。
- 多处组件支持 `prefers-color-scheme`（如 Assistant 图标 `<picture><source media="(prefers-color-scheme: dark)">`）。

### 1.3 响应式与移动端
- 发布站点全响应式，移动端有**紧凑版 "On this page" 菜单**（2026 changelog）。
- 全宽（full-width）改为整页级，窄屏自动收起目录。
- 搜索/AI 面板、Assistant、page actions 在移动端均可用。

### 1.4 内容区阅读排版
- **页面宽度**：`default` / `wide`（2025-08 新增，适合 landing page，自动展开可展开 block）。
- **Block 全宽**：code blocks / images / tables / cards / API blocks / integration blocks 可单独设 Full width。
- **代码块**：基于 **Prism** 语法高亮；可设 syntax、line numbers、caption、wrap；一键复制；可与 tabs block 组合做多语言示例；`x-hideTryItPanel`、`x-codeSamples` 等 OpenAPI 扩展。
- **表格**：支持单元格级评论（2025-08）；可全宽。
- **引用 / Callout**：`{% hint style="info|warning|danger|success" %}`，加标题时自动变更显眼。
- **图片**：inline（默认 ≤300px，三档尺寸：inline size / original / convert to block）+ image block（带 caption、多尺寸）。
- **页面封面（Page cover）**：2026-07 增强——可作背景图衬于内容后、可控制叠层文字颜色、可加径向遮罩（radial mask）实现 header 到内容的无缝过渡，配合既有的定位与高度控制，形成完整的封面系统。
- **页面元数据**：默认显示"最后更新时间 + 更新人"（编辑器与发布页都显示），可在 Page options → Footer 关闭。

### 1.5 侧边栏导航
- 目录树（SUMMARY.md 驱动），可折叠、锚点。
- 当前页/当前 section 高亮（primary color）。
- scrollspy 通过"On this page"大纲实现。
- sidebar 样式可选 `default` / `filled`。

### 1.6 顶部导航、面包屑、页面大纲
- 2025-02 起 header 与 sub-nav **合并为单一 header**，跨 space / change request / site 保持一致布局，通过 tabs 切换视图（Changes / Preview / Customization / Insights / Settings）。
- 面包屑、当前 section 高亮、primary header 按钮均受 primary color 驱动。

### 1.7 加载态 / 骨架屏 / 空状态 / 错误态
- 官方未在公开文档详述设计规范，但发布站有统一的 404 "Page not found" 页（且 analytics 单独追踪 Broken URLs）。
- 分析面板加载失败时官方建议关闭广告拦截器（说明有可观测的加载态文案）。

### 1.8 微交互与动画
- Insights 仪表盘有"旋转地球仪"展示最近一小时访问地理位置。
- Page actions 菜单、Assistant 排队消息（queued messages）等均有过渡。
- 整体品味偏克制、professional（参考客户证言："feel like an extension of a product"）。

### 1.9 图标体系
- 每个 space 可设 emoji 或上传图标（兼 favicon）。
- block insert palette、inline palette、page actions 均有图标体系（如 `gitbook-assistant` 图标）。
- 文档 frontmatter 支持 `icon` 字段（如 `code-branch`、`book-open`、`sparkles`、`rocket-launch`）。

---

## 2. 功能设计

### 2.1 内容编辑器：Block-based WYSIWYG + Markdown 双轨
- **块编辑器**：每个页面是任意数量 block 的组合，无数量上限。
- **插入**：`/` 唤起 block insert palette（鼠标点 `+` 或键盘 `/`）；`⌘/Ctrl + /` 唤起 block-modifier palette（上下文菜单）。
- **Markdown 直接书写**：支持 CommonMark 风格的 bold/italic/strikethrough/inline code、`#`/`##`/`###` 标题、` ``` ` 代码块（含 ` ```py ` 语法）、`-`/`*`/`1.`/`- [ ]` 列表、`>` 引用、`---` 分隔线。
- **行内 palette**：`/` 在文本块中唤起，插入 image / button / emoji / link / math & TeX / icon / expression / annotation。
- **Block 类型清单**（官方）：paragraph、heading、unordered/ordered/task list、hint、code block、table、tabs、stepper、columns（≤2 列）、updates（时间线/changelog）、cards（`<table data-view="cards">`）、file、button、image、OpenAPI block、Mermaid、embed、expandable `<details>`、math、annotation（footnote 语法）。
- **全宽 block**、**软换行** `Shift+Enter`、**块复制/剪切/删除**（`Esc` 选中后 `⌘C`/`⌘X`/`⌫`）。

> 官方来源：<https://gitbook.com/docs/creating-content/blocks> · <https://gitbook.com/docs/creating-content/formatting/markdown>

### 2.2 层级模型：Page → Space → Collection → Site (Sections / Groups / Variants)
- **Page**：单个 markdown 文件。
- **Space**：页面集合（一个文档站点单元），由 `SUMMARY.md` 定义目录。
- **Collection**：跨 space 的空间分组。
- **Site**（2025 起的 sites-first 工作区）：发布单元，可含多个 **Sections**（不同产品/受众/主题）与 **Groups**；Ultimate 才有 sections/groups。
- **Content variants**：在同一站点内为**多产品版本或多语言**发布变体。
- **文件结构**（Git Sync 视角）：`/.gitbook/`（assets / includes / `vars.yaml` / `.gitbook.yaml`）、`/README.md`（首页）、`/SUMMARY.md`（TOC）。

### 2.3 版本管理与变更追踪：Change Requests（类 PR）
- **Change Request**：主内容副本，源自 Git **branching** 概念，对 GitHub/GitLab 用户零学习成本。
- **Diff view**：在 Changes tab 高亮每个被编辑的 page 与 block；两种模式——`Show all pages`（默认，含未改页）与 `Show only changed pages`（聚焦改动，大空间友好）。
- **Review 流程**：Request a review（可 @tag 具体人，未 tag 则通知所有 reviewer+）、approve / request changes、merge 回 main。
- **Preview**：在已发布站点的预览窗口看变更全貌。
- **Live edits 模式**：可直接在线编辑主版本（启用 Git Sync 后锁定 live edit，改走 CR）。
- **冲突处理**：CR 有冲突时 Changes tab 不可用并明确提示原因（2026-07 fix）。
- **AI Change Requests**（Alpha）：用自然语言描述改动 → AI 起草计划 → 人审阅调整 → AI 执行；当前限制：GitBook 专属 block 暂不支持。

### 2.4 协作：实时多人 + 评论 + 提及 + 分享权限
- 实时多人共编（CR 内可多人）。
- 评论：block 级、**表格单元格级**（2025-08）、expandable block 标题级（2026-07 fix）。
- 提及、reviewer 通知。
- 权限：viewer / reviewer / editor / admin / creator；document-level permissions。

### 2.5 搜索：三档体验
- **Keyword search**：所有站点默认，基于关键词。
- **GitBook AI search**（Premium & Ultimate）：在 "Ask or search…" 栏直接问答，给摘要答案 + 可展开来源 + 相关问题。
- **GitBook Assistant**（Ultimate）：高级聊天式 AI agent，见 2.10。
- 入口：`⌘/Ctrl + K` 开 Ask or search；多 section 站点可跨 section 检索。
- Search insights：追踪高频关键词、按 section 过滤。

### 2.6 命令面板 / 快捷键体系
- `⌘/Ctrl + K`：Ask or search 面板（编辑器内则插链接）。
- `⌘/Ctrl + I`：GitBook Assistant 聊天窗。
- `/`：block insert palette；`⌘/Ctrl + /`：block-modifier palette。
- `⌘/Ctrl + ⌥ + 0/1/2/3`：转 paragraph / H1 / H2 / H3。
- `⌘/Ctrl + B/I/E`：bold / italic / inline code；`⌘/Ctrl + Shift + S`：strikethrough。
- `⌘/Ctrl + D`：复制块；`⌘/Ctrl + Enter`：退出 block；`Esc`：选中整块。
- 表格：`⌥/Alt + Shift + Enter` 插入下行、`⌥/Alt + Enter` 上行、`⌘/Ctrl + -` 删行。
- 列表/代码：`Tab`/`Shift+Tab` 缩进。

> 官方来源：<https://gitbook.com/docs/resources/keyboard-shortcuts>

### 2.7 集成
- **Git Sync**：GitHub Sync、GitLab Sync，**双向**（CR merge → commit；commit → history commit）；支持 monorepo、PR preview、commit autolink。
- **Slack**：AI 问答、把 thread 总结成文档、实时通知；Channels（Ultimate）还接 Linear、GitHub。
- **OpenAPI / Swagger**：见 2.9。
- **Mermaid**：独立 Mermaid block（非 code block），需组织级安装并 space 启用。
- **Math & TeX**：行内/块级公式（inline palette）。
- **RunKit**：交互式 Node.js notebook。
- **Google Analytics / Google Tag Manager**：站点流量追踪。
- **Intercom**：客服集成。
- **认证集成**（Authenticated access, Ultimate）：Auth0、AWS Cognito、自定义后端。
- **Connections**（Ultimate）：把 GitHub issues/discussions、Slack/Discord 会话、support 内容、外部 docs/help center/website 同步进站点供 Assistant 检索。
- **MCP servers**：见 2.10。
- **自定义集成**：通过 `@gitbook/cli` 的 `gitbook integration new/dev/publish` 构建 & 发布。

### 2.8 API 文档能力（OpenAPI / Swagger 自动渲染）✅ 官方重点能力
- **支持版本**：Swagger 2.0、OpenAPI 3.0、**OpenAPI 3.1**（含 3.1 专属 `webhooks`）。
- **导入方式**：上传文件 / 提供 URL（URL 每 6 小时自动检查更新，可手动 Check for updates）/ **GitBook CLI** `gitbook openapi publish --spec <name> --org <id> <path-or-url>`。
- **渲染**：spec 转为**交互式、可测试的 API block**，可视化每个 method。
- **Try-it（powered by Scalar）**：用户可在文档页直接测试 endpoint，参数从编辑器预填。
- **OpenAPI Reference**：在 TOC 一键插入，按 spec 的 tags **自动生成 endpoint 页**（含可选 models 页），spec 更新时自动同步。
- **自定义扩展**：`x-hideTryItPanel`、`x-codeSamples`（root 或 per-operation）。
- **校验改进**（2025-08）：更早识别 spec 问题。
- **CORS 注意**：URL 方式要求 API 允许 docs 站点 origin 的 GET。
- **OpenAPI analytics**：endpoint views / 参数搜索 / 请求探索（Premium & Ultimate）。

> 官方来源：<https://gitbook.com/docs/api-references/openapi> · <https://gitbook.com/docs/developers/gitbook-api/api-reference/openapi-1>

### 2.9 变量、模板、内容复用
- **变量**：space 级 `/.gitbook/vars.yaml`，page 级 frontmatter `vars:`。
- **表达式**：`<code class="expression">space.vars.variableName</code>` / `page.vars.x`，动态渲染。
- **可复用内容**：`{% include %}` 跨页复用 block，改一处全更新；`includes/` 目录。
- **条件内容**（Adaptive content, Ultimate）：frontmatter `if: visitor.claims.unsigned.condition`，按用户身份显示/隐藏；page 级细粒度控制。
- **模板化 block**：tabs / stepper / columns / updates / cards / hint / file / button / details。

### 2.10 AI 能力（2025–2026 的主战场）✅ 核心差异化
GitBook 把 AI 拆成**三层 + 一套可观测性**：

1. **GitBook AI search**（Premium & Ultimate）：搜索栏内的轻量问答，仅基于本站内容。
2. **GitBook Assistant**（Ultimate）：
   - 聊天式 sidebar，**agentic retrieval**（结合当前页、历史阅读、历史对话理解意图）。
   - 与 **adaptive content** 集成：按用户身份给个性化答案。
   - 通过 **MCP servers** 连外部工具/数据（实时账户状态、创建工单等）。
   - 通过 **Connections** 同步内容源（GitHub issues、Slack 等）。
   - 可**嵌入到自家产品**：script tag / Node.js / React 组件；可配 welcome message / actions / suggestions / 自定义 tools。
   - **Custom instructions**（2026-07）：管理员设语气与产品术语（不覆盖 guardrail）。
   - **Channels**（Ultimate）：把 Assistant / Agent 接入 Slack、Linear、GitHub；Slack 中直接回复客户。
3. **GitBook Agent**（Ultimate）：**写/改/更新文档**的 AI agent——监控 docs 与产品的 drift、主动建议改进、起草 change request、识别内容缺口；可附任意类型文件（MD/Word 等）作参考。
4. **AI insights**：见 2.13。AI 回答评分 + 问题聚合，形成可行动的"docs 缺口 backlog"。

**面向 AI Agent 的内容分发**（这是 GitBuddy 最值得对标的范式）：
- **`llms.txt`**：站点根目录的 AI 索引（H1 标题 + 分组 + 链接到 .md 版本 + 简述）。
- **`llms-full.txt`**：全量文档语料导出。
- **`.md` 路由**：任意页 URL 加 `.md` 返回 Markdown 版（如 `gitbook.com/docs/.../page.md`）。
- **`?ask=<question>&goal=<endgoal>` 查询参数**：对页面 URL 发 GET，返回带来源的答案（机器可读）。
- **Published-site MCP server**（AI 开启时）：暴露 `askQuestion`、`sendFeedback` 等 tool 给外部 AI agent。
- **Page actions**：每页菜单可"问 Assistant / 复制 Markdown / 在 ChatGPT 或 Claude 中打开预填 prompt"。
- **Agent feedback**：AI agent 浏览站点时可经 MCP `sendFeedback` 上报内容问题，进入 analytics。
- **Agent Score**（<https://www.gitbook.com/agent-score>）：agent-readiness 自检工具。
- **官方 SKILL.md / skills**：`npx skills add GitbookIO/gitbook-skills`，给 Claude Code/Cursor/Codex 注入 GitBook 能力知识。

### 2.11 国际化 i18n / 多语言空间
- **Multilingual sections**：为 site / section / group 设本地化标题。
- **Content variants**：同一站点发多语言/多版本变体。
- 注：第三方对比指出 GitBook "无原生翻译管理"，多语言走 sections/variants 结构而非翻译记忆库。

### 2.12 访问控制
- 公开 / 私有 / share links（Premium & Ultimate）/ **Authenticated access**（Ultimate：Auth0、AWS Cognito、自定义后端、SAML 2.0 IdP）/ **SAML SSO**（Enterprise：Okta、Azure AD 等）/ 文档级权限 / adaptive content page 级显隐。
- Site-level permissions 优先于继承的 org/collection 权限（2026 改动）。

### 2.13 分析洞察（Insights）✅ 2025-02 大改版
独立 Analytics tab，含 7+ 数据集，支持 filters / groups / 自定义时间范围 / CSV 导出：
- **Traffic**：page views（按国家/语言/浏览器/设备）、Events vs Visitors 区分。
- **Pages & feedback**：页面评分均值 + 评论文本（需开 page ratings）。
- **Agent & LLMs**：追踪 `llms.txt`/`llms-full.txt`/`.md` 请求，看哪些 agent 最常访问。
- **Broken URLs**：404 入站链接 → 可设 site redirects。
- **Search**：高频关键词、按 section 过滤。
- **Ask AI**：用户问 AI 的问题 + 答案评分 + 相似问题数（识别文档缺口）。
- **Links**：外链域名与位置（header/footer/sidebar）。
- **MCP**：MCP 请求趋势与访问 bot/agent。
- **OpenAPI**：endpoint views / 参数搜索 / 请求探索（Premium & Ultimate）。
- 顶层 Overview 有"旋转地球仪"显示最近一小时访问地理位置。

### 2.14 导入导出
- **导入**（内置面板，单次 ≤20 页 / ≤20 文件）：Markdown / HTML / Word `.docx` / Confluence / Notion / GitHub Wiki / Quip / Dropbox Paper / Google Docs；ZIP 打包多页。
- **大批量导入**：走 **Git Sync**（≤5000 markdown 页），推荐用 `markitdown` 等先转 Markdown。
- **导出**：
  - Markdown：通过 Git Sync 同步到空仓库导出（部分自定义 block 以 HTML 形式落盘）。
  - PDF：Premium & Ultimate（超大 space 可能受限）。
  - 注意：app 内**不能**直接导出单页 Markdown。

### 2.15 Webhook / API / CLI / MCP
- **REST API**：`https://api.gitbook.com/v1`，覆盖 orgs / spaces / pages / change requests / OpenAPI specs 等，Bearer token 鉴权。
- **GitBook CLI**（`@gitbook/cli`，2026-07 发布，需 Node ≥18）：
  - `gitbook login`（OAuth）/ `gitbook auth --token <PAT>`（CI/发布集成用）。
  - 命令按资源分组：`organizations list`、`spaces list/get`、`spaces content pages list`、`organizations ask stream --query "..."`（流式问答带来源）。
  - 输出：`--pretty`（默认交互）/ `--json`（agent 友好）/ `--yaml`/ `--full`。
  - 集成开发：`gitbook integration new/dev/publish`。
  - OpenAPI 发布：`gitbook openapi publish`。
- **MCP server**（`https://mcp.gitbook.com/mcp`，streamable HTTP + OAuth/PAT）：给 Claude Code / Cursor / Codex 等 AI agent 用，可建站、开 CR、改内容、问文档；Claude Code 用 `claude plugin marketplace add GitbookIO/gitbook-skills`。
- **官方 plugins**：Claude / ChatGPT / Cursor marketplace 都有 GitBook connector。
- Webhook：官方未在公开文档强调通用 webhook，事件分发主要通过 MCP、Connections、Slack 通知、Insights 实现。

> 官方来源：<https://gitbook.com/docs/getting-started/ai-documentation/gitbook-cli> · <https://gitbook.com/docs/developers/gitbook-api>

---

## 3. 协议与技术规范

### 3.1 内容格式规范
- **基础**：Markdown（CommonMark 兼容）。
- **frontmatter**：`description`、`icon`、`hidden`、`vars`、`if`（条件）、`layout`（width/title/description/tableOfContents/outline/pagination/metadata 的可见性）。
- **自定义 block 标签**（非 MDX，而是 GitBook 专属 Nunjinja 风格 + HTML 扩展）：
  - `{% hint style="..." %}`、`{% tabs %}`/`{% tab %}`、`{% stepper %}`/`{% step %}`、`{% columns %}`/`{% column %}`、`{% updates %}`/`{% update %}`、`{% file %}`、`{% include %}`、`{% embed %}`、`{% code %}`。
  - HTML 扩展：`<table data-view="cards">`、`<a class="button">`、`<details><summary>`、`<code class="expression">`、`<kbd>`。
- **目录**：`SUMMARY.md`（Git Sync 视角的核心结构文件）。
- **配置**：`.gitbook/` 目录（`vars.yaml`、`.gitbook.yaml`、`assets/`、`includes/`）。
- **重要**：GitBook **不使用 MDX**（这是它与 Mintlify/Docusaurus 的关键区别）；OpenAPI spec **不能内嵌 markdown**，必须经 API/CLI/UI 上传。
- 老开源 `gitbook` CLI 的 `book.json` + `plugins` + Nunjucks `{{ }}` 模板属于遗留路径，**非当前平台主格式**。

### 3.2 OpenAPI 规范支持版本
- Swagger 2.0 ✅
- OpenAPI 3.0 ✅
- OpenAPI 3.1 ✅（含 `webhooks`）
- 自定义扩展：`x-hideTryItPanel`、`x-codeSamples`。
- 渲染引擎：Try-it 由 **Scalar** 提供支持。

### 3.3 语义化 HTML 与无障碍
- 官方目标：**WCAG 2.1 Level AA**（EAA/ADA 基线），并关注 WCAG 2.2 的 focus appearance（2.4.11/2.4.13）、target size（2.5.8）、redundant entry（3.3.7）。
- 平台侧保障：LCH 色板**自动保证对比度**、系统请求更高对比时自动调整、支持 high contrast。
- 作者侧责任：alt text、heading 层级、链接措辞、表头、可读品牌色。
- 键盘导航：搜索结果方向键 + Enter + Esc；skip links / ARIA 由作者配合。
- 第三方（a11yfix.dev）整理了 GitBook 专属 a11y checklist。

### 3.4 SEO 规范 ✅ 高度自动化
- 官方表态："GitBook handles most SEO automatically. Published sites are responsive, pre-rendered, and served via a global CDN."
- 自动处理：`<title>` / meta description（来自 frontmatter `description`）/ **Open Graph** / **Twitter Card** / **canonical** / **sitemap** / **robots** / structured data。
- 站点级 social metadata 与 sharing 选项可配。
- **GEO（生成式引擎优化）**：官方专门发布 GEO guide，强调机器友好结构、可答小节。
- `site redirects`（Premium & Ultimate）处理迁移与 404。

### 3.5 PWA 规范
- 官方公开文档**未声明**完整 PWA（manifest + service worker + 离线）。发布站是响应式 web app，重预渲染 + CDN，但不是可安装离线 PWA。**这是 GitBuddy（桌面应用）可差异化的点。**

### 3.6 性能规范
- 预渲染（pre-rendered）+ 全局 CDN。
- 未公开具体 Core Web Vitals 目标值。
- Insights 不直接报 CWV，但追踪 traffic / broken URLs / agent 流量。

### 3.7 安全规范 ✅
- **SOC 2 Type II** + **ISO/IEC 27001**（2023-09 取得，持续维护）。
- **GDPR 合规**。
- **SAML 2.0 SSO**（Enterprise，Okta/Azure AD 等）+ 授权邮件域 SSO。
- state-of-the-art 加密、可靠基础设施伙伴、文档级权限、专职安全官。
- 漏洞上报项目（bug reporting program）。
- **缺口**（第三方对比）：无 audit logs、无 data residency、无 HIPAA、无 air-gap、Ultimate 以下无 uptime SLA——对强监管行业是短板。

### 3.8 i18n 规范
- 通过 multilingual sections + content variants 实现，本地化标题。
- 未公开是否自动输出 `hreflang`；多语言走 URL 结构（sections）而非子域名强制。
- 无原生翻译记忆库/协作翻译工作流。

### 3.9 可观测性
- 内置 Site analytics（见 2.13）。
- Google Analytics / GTM 集成。
- Agent & LLMs 流量追踪（llms.txt/llms-full.txt/.md 请求 + agent 类型）。
- Broken URL、Search、Ask AI、MCP、OpenAPI 全维度可观测。
- 无公开的客户端错误监控（Sentry 类）声明。

### 3.10 浏览器兼容矩阵
- 官方未公开明确矩阵；按预渲染 + 现代 web 特性推断为**现代 evergreen 浏览器**（Chrome/Edge/Firefox/Safari 最新版）。

---

## 4. 文档与开发者体验

### 4.1 官方文档站本身的结构与质量 ✅ 自身就是最佳实践样板
- 位于 `gitbook.com/docs`，**自身就用 GitBook 发布**——所见即所得。
- 完整索引：`gitbook.com/docs/llms.txt`（H1 + 分组 + 链 .md + 简述）；全量语料 `gitbook.com/docs/llms-full.txt`；sitemap `gitbook.com/docs/sitemap.md`。
- 每页可加 `.md` 取 Markdown 版，可加 `?ask=...&goal=...` 动态问答。
- 每页底部内嵌 "Agent Instructions" 块，教 agent 如何查询本站。
- 结构：Overview / Quickstart / Build with AI / Migrate / Git Sync / Docs site / Creating content / Collaboration / Integrations / Developers / Resources / Changelog / Help center。

### 4.2 API 参考 / SDK / CLI 文档
- **API reference**：<https://gitbook.com/docs/developers/gitbook-api/api-reference>——**用 GitBook 自己的 OpenAPI block 渲染**（自举），每个 endpoint 有 Try-it。
- **CLI 文档**：<https://gitbook.com/docs/getting-started/ai-documentation/gitbook-cli>。
- **MCP 文档**：<https://gitbook.com/docs/getting-started/ai-documentation/gitbook-mcp>。
- **Integrations 开发**：Quickstart + reference + CLI 命令。
- SDK：以 REST + 官方 CLI/MCP 为主，未公开多语言 SDK。

### 4.3 CHANGELOG / Release notes ✅
- <https://gitbook.com/docs/changelog>，按月归档，每条标注 `new-releases / improvements / fixes`，格式规整、信息密度高（如 2026-07-29、2026-07-27 CLI、2026-07-24 page cover、2025-08-01 Assistant 大版本、2025-02-04 insights 大改版）。

### 4.4 贡献指南 / 开源策略
- 帮助中心有 "How can I contribute to GitBook's Documentation?"。
- 开源解决方案页：<https://www.gitbook.com/solutions/open-source>——**开源项目免费 + 资助**。
- 老开源 CLI 仍在 GitHub（`GitbookIO`），但平台本身闭源 SaaS。

### 4.5 模板与示例库
- Quickstart guides（AI quickstart / Editor quickstart）。
- Demo 站：<https://gitbook.com/adaptive-content-demo>。
- SKILL.md（<https://gitbook.com/docs/skill.md>）：完整列出 block 语法、frontmatter、变量、include、决策表，供外部编辑器/Cursor/Claude Code 使用。
- 客户案例库（Nvidia、Zoom、n8n、Snyk、Roboflow、Gravitee、bunq 等）。

### 4.6 迁移指南
- "Migrate to GitBook" 章节：Confluence / Notion / Git / GitHub Wiki / Quip / Dropbox Paper / Google Docs。
- 专门博客：*Confluence to GitBook Migration: The CTO's Technical Guide*（指出原生导入上限 20 页，大规模走 XML→MD→Git Sync）。
- Enterprise 提供 white-glove migration service。

### 4.7 状态页 / 支持渠道
- 支持：support@gitbook.com；Enterprise 1:1 dedicated support + 用户培训。
- 状态页：官方有 policies.gitbook.com 下的安全与隐私页；公开 status page 未在检索中明确出现。
- 销售入口 sales@gitbook.io。

### 4.8 学习资源
- 官方博客（Industry / Tutorials & tips / Product updates / Company news），每篇带 "AI summary"。
- 指南：SEO、GEO、llms.txt、AI docs optimization、best API docs/SDK tools 等。
- Agent Score 在线自检工具。

---

## 5. 品牌与定位

### 5.1 产品定位与目标用户
- **定位**："AI-native documentation platform" / "docs infrastructure that does both"（既 AI-ready 又 trustworthy）。
- **叙事**："AI made docs easy to write. Not easy to trust."——强调**准确性**而非"能写"，差异化点在"主动检测 drift、把错误挡在分发前"。
- **目标用户**：SaaS 公司、API 驱动的开发者平台、开源项目、技术团队、Enterprise（Nvidia/Zoom/Snyk/n8n 级）。
- **核心场景**：product docs / API reference / developer portal / help center / 内部 knowledge base / SDK docs。

### 5.2 价格分层（2025-06 起的 sites-first 新模型）
**站点（Site）计划**：
| 计划 | 价格（年付/月付） | 关键能力 |
|---|---|---|
| Free | $0/站点/月（1 用户） | 块编辑器 + 自定义块、GitHub/GitLab Sync、交互式 OpenAPI、preview deployments、**LLM 优化（llms.txt/llms-full.txt/.md）** |
| Premium | $65/$79 站点/月 | + 团队协作、**AI search**、自定义域名、高级品牌定制、analytics + 用户反馈、site redirects、PDF 导出 |
| Ultimate | $249/$299 站点/月 | + **AI Assistant**、**AI insights**、**GitBook Agent**、**adaptive content**、authenticated access、**site sections/groups**（内容聚合）、**Channels**（Slack/Linear/GitHub） |
| Enterprise | 定制 | + **SAML SSO**、white-glove 迁移、自定义集成、1:1 支持、培训、自定义合同、法务/安全审查、unlimited adaptive content、**Git Sync IP allowlisting** |

**用户**：每位 +$12/月（年付）/ +$15（月付）。读者免费。
**已弃用**：2025-06-26 起 Team/Business 计划自动迁移到新模型。

### 5.3 品牌口号与视觉关键词
- 口号：**"AI made docs easy to write. Not easy to trust."**
- 视觉关键词：clean、modern、professional、translucent、sophisticated、high-impact（按主题）、"extension of a product"。
- 强调"docs as code + visual editing 双轨"、"agent-ready by default"、"knowledge that compounds"。

### 5.4 与竞品差异
- **vs Docusaurus**：Docusaurus 是免费 OSS React 框架，需自管 hosting/搜索/CI/主题；GitBook 是托管 SaaS，开箱即用、零基建、含 AI/analytics/可视化编辑——适合不想养前端基建的团队。
- **vs Mintlify**：Mintlify 代码优先 + **MDX**，Pro $450/月起 + AI credit 超量计费；ISO 27001/GDPR 仍在进行中；mock API only。GitBook **可视化 + Git 双轨**、SOC2+ISO27001 已认证、AI 不按用量计费、Try-it 由 Scalar 提供支持且可连 MCP。
- **vs ReadMe**：ReadMe 强在交互式 API explorer + API 使用 analytics（Developer Dashboard）；GitBook 合规组合更全（SOC2+ISO27001）、MCP/Agent 更成熟；两者都缺 audit logs/HIPAA/data residency。
- **vs Confluence**：Confluence 强在内部 wiki + Atlassian 生态（Jira/JSM）；GitBook 强在公开站设计、API 文档、AI-ready 输出（llms.txt/MCP/.md）、docs-as-code 协作。

---

## 6. GitBook 最值得 GitBuddy 对标的 10 个能力点（按对开发者文档/知识库产品的重要性排序）

> GitBuddy 是"本地 Git 仓库可视化 + 知识笔记桌面应用"，与 GitBook 的托管 SaaS 形态不同。下列项兼顾"GitBook 做得好"与"对 GitBuddy 这种本地+知识笔记产品有移植价值"。

1. **面向 AI Agent 的内容分发层（llms.txt / llms-full.txt / `.md` 路由 / `?ask=` 查询）**
   GitBuddy 可为本地仓库笔记自动生成 `llms.txt` 索引、每篇笔记可导出纯 Markdown、提供 `?ask=` 风格的本地问答接口——让本地知识库同样 AI-ready。这是 2025–2026 文档平台的最强新共识，必做。

2. **块编辑器 + Markdown 双轨 + 自定义 block 标签**
   Notion 风格块编辑 + `/` palette + 原生 Markdown 输入，配合 `{% hint %}`/`{% tabs %}`/`{% stepper %}`/`{% columns %}`/`{% updates %}`/`cards`/`<details>` 等语义化 block。GitBuddy 的笔记编辑器应同时满足"键盘流 Markdown 老手"与"可视化新手"。

3. **OpenAPI 自动渲染 + Try-it（Scalar）+ 自动生成 endpoint 页**
   开发者文档的硬通货。GitBuddy 若做"本地仓库内嵌 API 文档"，应支持导入 spec（2.0/3.0/3.1）→ 生成可测试 block，spec 变更自动同步。

4. **Git 双向同步 + Change Request（类 PR）+ Diff view**
   GitBuddy 天然有"本地 Git 仓库"优势：可把笔记变更建模为 branch/CR/diff，复用 Git 本身的版本与评审能力，diff view 支持"仅看改动页"。这是 GitBuddy 相对 GitBook 的潜在**超越点**（本地 Git 一等公民）。

5. **SUMMARY.md + frontmatter + `.gitbook/vars.yaml` 的内容规范**
   用 `SUMMARY.md` 表达目录、frontmatter（`description`/`icon`/`hidden`/`vars`/`if`/`layout`）表达元数据、`vars.yaml` + `<code class="expression">` 表达变量与动态内容。GitBuddy 可直接借鉴这套"文件即配置"的 docs-as-code 规范。

6. **设计系统：4 主题 + primary/tint/semantic 三色 + LCH 自动达标色板 + light/dark logo**
   "样式定义意图而非外观、跨主题自动适配"的设计哲学非常值得学习；LCH 色板保证可访问性对比度自动达标，是高质量桌面应用 UI 的参考标杆。

7. **Insights：7+ 数据集 + filters/groups/自定义时间 + Agent & LLMs 流量追踪**
   特别是"Agent & LLMs"维度（追踪 llms.txt/llms-full.txt/.md 请求 + 哪些 agent 访问）和"Ask AI 评分 → 文档缺口 backlog"——这是传统笔记应用普遍缺失、但对知识库产品极有价值的能力。

8. **GitBook Assistant / Agent 三层 AI + MCP server + Channels**
   聊天 Assistant（agentic retrieval + adaptive content + 嵌入产品）+ 写作 Agent（监控 drift、起草 CR）+ Channels（Slack/Linear/GitHub）。GitBuddy 可对标"本地知识库问答 + 笔记 drift 检测 + 可选 MCP 暴露给外部 agent"。

9. **官方文档自举 + 完整 DX（CLI / MCP / SKILL.md / Agent Score）**
   GitBook 用自家产品发布自家文档，并提供 CLI（`@gitbook/cli`，`--json` agent 友好）、MCP server、SKILL.md、Agent Score 自检。GitBuddy 作为开发者工具，应同样提供 CLI/可被 AI agent 调用 + 自检工具，并让自身文档成为产品能力的展示窗。

10. **快捷键体系 + 命令面板（`⌘K` 搜索 / `⌘I` Assistant / `/` block palette / `⌘/` modifier）**
    桌面应用尤其依赖键盘流。GitBook 的"搜索/Assistant/block 插入/block 修改/标题转换/表格操作"全键盘覆盖是优秀范本，GitBuddy 应提供等价的命令面板与块级快捷键。

---

## 附：关键官方来源索引

- 文档总览：<https://gitbook.com/docs> · <https://gitbook.com/docs/llms.txt>
- 定制（主题/色/字体）：<https://gitbook.com/docs/publishing-documentation/customization/icons-colors-and-themes>
- 块编辑器：<https://gitbook.com/docs/creating-content/blocks>
- Markdown：<https://gitbook.com/docs/creating-content/formatting/markdown>
- SKILL.md（外部编辑器用语法全集）：<https://gitbook.com/docs/skill.md>
- Change Requests：<https://gitbook.com/docs/collaboration/change-requests>
- Git Sync：<https://gitbook.com/docs/getting-started/git-sync>
- OpenAPI：<https://gitbook.com/docs/api-references/openapi>
- AI Search / Assistant：<https://gitbook.com/docs/docs-site/ai-search> · <https://gitbook.com/docs/ai-and-search/gitbook-ai-assistant>
- Insights：<https://gitbook.com/docs/docs-site/insights>
- 快捷键：<https://gitbook.com/docs/resources/keyboard-shortcuts>
- CLI：<https://gitbook.com/docs/getting-started/ai-documentation/gitbook-cli>
- MCP：<https://gitbook.com/docs/getting-started/ai-documentation/gitbook-mcp>
- API reference：<https://gitbook.com/docs/developers/gitbook-api/api-reference>
- Changelog：<https://gitbook.com/docs/changelog>
- 定价：<https://www.gitbook.com/pricing>
- 安全（SOC2/ISO27001）：<https://www.gitbook.com/blog/gitbook-security-soc2-iso27001>
- llms.txt 解读：<https://www.gitbook.com/blog/what-is-llms-txt>
- 设计系统重构：<https://www.gitbook.com/blog/how-we-upgraded-docs-customization>
- 首页（定位与口号）：<https://www.gitbook.com/>
