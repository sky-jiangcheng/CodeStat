# 剩余 Issue 处理计划

基于代码库现状，按你指定的顺序设计 4 个核心 issue 的实施方案。其余 issue（#20、#17、#22、#27、#26、#24、#23、#28）建议放到下一阶段，避免单次改动过大。

## 关键现状
- 前端：Vite + React 19 + PWA，无 Tailwind；单文件 `web/src/styles/global.css` 已达 3616 行，存在未定义 token（`--success`、`--success-soft`、`--accent-dark`、`--text-danger`）。
- 后端：Wails v2 + Go + SQLite（modernc），已有 FTS5 trigram + bm25 搜索（migration v7）。
- 内容：笔记存为 Markdown，`project_notes` 无版本表；`renderMarkdownAsync` 支持 Mermaid/KaTeX/callout/highlight。
- 路由：BrowserRouter + Wails fallback；无 `/llms.txt`、无 `?ask=`、无服务端导出。

---

## Phase 1：#9 UI 设计系统重构

**目标**：拆分单体 global.css，补齐 token，建立可维护的设计系统。

### 方案
1. 新建目录 `web/src/styles/design-system/`
   - `tokens.css`：颜色、间距、字体、阴影、圆角、动效等 CSS 变量（light/dark）。
   - `reset.css`：`* { box-sizing }`、滚动条、聚焦环、reduced motion 等基础样式。
   - `typography.css`：标题、正文、代码、链接、列表样式。
   - `components/`：按钮、输入框、卡片、badge、toast、command-palette 等原子组件样式。
   - `layouts/`：navbar、main-content、page layouts。
   - `features/`：markdown-body、block-editor、heatmap、charts 等。
2. `web/src/styles/index.css` 作为统一入口按顺序 `@import` 以上文件。
3. 将 `global.css` 内容逐步迁移并删除。
4. 补齐缺失 token：
   - `--success` / `--success-soft`
   - `--accent-dark`
   - `--text-danger`
5. 新增 `web/src/styles/tokens.md` 设计 token 文档（issue #9 要求）。
6. 在 `Settings.tsx` 保留主题切换，确保 token 文档引用一致。

### 验收
- `global.css` 不再存在，样式模块化。
- 所有组件无未定义 CSS 变量。
- light/dark 主题正常切换。
- 构建产物无样式回归。

---

## Phase 2：#15 AI-ready 内容分发层

**目标**：让 GitBuddy 的内容可被 AI/LLM 消费（llms.txt + 笔记 .md 路由 + 本地 ?ask= 问答）。

### 方案
1. **生成 `llms.txt`**
   - 后端新增 Wails 绑定 `GenerateLLMsTxt() string`。
   - 内容聚合：项目列表、每个项目下知识类笔记（`kind='knowledge'`）的标题/标签/正文。
   - 输出 Markdown 格式，包含项目名、技术栈、README 摘要、知识笔记链接占位。
2. **提供 `.md` 路由/导出**
   - 后端新增 `ExportNoteAsMarkdown(noteID int64) string`。
   - 在 `Knowledge.tsx` 增加「导出 .md」按钮，调用后复制或下载。
   - 格式：`---\ntitle: ...\ntags: ...\nproject: ...\nupdated_at: ...\n---\n\n{content}`。
3. **本地 `?ask=` 问答**
   - 不引入 LLM API，先实现基于全文搜索的本地问答：
     - 前端 URL 解析 `?ask=query`。
     - 调用已有 `SearchAll(query)`，按 bm25 排序。
     - 展示「相关笔记」列表与摘要片段。
   - 在 `Knowledge.tsx` 增加 ask 输入框，支持回车触发搜索。
   - 未来可扩展为 RAG（本地向量库/LLM）。

### 验收
- 能生成符合社区约定的 `llms.txt` 内容。
- 单篇笔记可导出为带 frontmatter 的 Markdown。
- 访问 `/knowledge?ask=xxx` 能显示搜索结果。

---

## Phase 3：#18 FTS5 全文搜索升级

**目标**：完善中文分词与相关性排序，解决已知 bug。

### 现状
- 已用 `tokenize='trigram'` + `bm25` + `LIKE` 回退，search_test.go 覆盖 CJK/短词/同步。

### 方案
1. **诊断当前 bug**
   - 运行 `go test ./internal/db/ -run TestSearch` 确认现状。
   - 检查 `SearchNotes` 中 bm25 调用是否缺失 `rank` 字段导致无相关度返回。
2. **优化排名与摘要**
   - 在 `SearchNotes` / `SearchAll` 中返回 `rank` 或至少按 bm25 排序。
   - 高亮片段生成：利用 `snippet(project_notes_fts, 0, '<mark>', '</mark>', '…', 32)` 替换当前手动 `searchSnippetWindow` 截取。
3. **可选中文分词增强**
   - SQLite FTS5 默认无中文分词；trigram 已可匹配连续 3 字。
   - 评估是否引入 `sqlite-fts5-tokenizer` 或保持 trigram（跨平台编译复杂）。
   - 决策：优先保持 trigram，优化查询语法（`MATCH` 加双引号支持短语）。
4. **扩展搜索范围**
   - 给 `project_notes` 增加 `tags` 搜索（FTS 已覆盖 title/content，可补充 tag 匹配）。
   - `SearchAll` 增加项目名匹配权重。

### 验收
- 搜索测试全通过。
- 中文查询结果按相关性排序。
- 搜索摘要包含高亮标记。

---

## Phase 4：#16 笔记版本历史 + Diff view

**目标**：每次保存笔记自动留档，支持历史版本对比与回滚。

### 方案
1. **数据库**
   - migration v8：新建 `note_versions` 表。
     ```sql
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     note_id INTEGER NOT NULL,
     title TEXT,
     content TEXT NOT NULL,
     tags TEXT,
     kind TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (note_id) REFERENCES project_notes(id) ON DELETE CASCADE
     ```
   - 索引：`note_id, created_at DESC`。
2. **后端**
   - 在 `UpdateNote` 前将当前行 snapshot 插入 `note_versions`。
   - 新增 Wails 方法：
     - `ListNoteVersions(noteID int64) []Version`
     - `GetNoteVersion(versionID int64) Version`
     - `RestoreNoteVersion(noteID, versionID int64) Note`
   - 限制：保留最近 50 个版本，或按时间窗口清理（避免 DB 膨胀）。
3. **前端**
   - `NoteSection.tsx` 增加「历史版本」入口。
   - 新增 `NoteVersionHistory` 组件：列表 + Diff view。
   - Diff view 使用纯文本 diff 或基于行的简单 diff（可引入 `diff-match-patch` 或自研 LCS）。
   - 提供「预览此版本」和「回滚到此版本」按钮。

### 验收
- 每次更新笔记产生一个历史版本。
- 能查看版本列表与任意两版本差异。
- 回滚后笔记内容正确更新。

---

## 执行顺序与依赖

1. **先 #9**：设计系统是后续所有前端改造的基础。
2. **再 #15**：依赖设计系统的 markdown-body / button 样式。
3. **再 #18**：纯后端改造，与 UI 解耦。
4. **最后 #16**：需要设计系统的 modal/list/diff 组件样式。

## 需要确认的问题

1. **#15 的 LLM 问答**：当前是否允许调用外部 LLM API？还是先做本地搜索问答即可？
2. **#16 版本保留策略**：保留最近 50 个版本 + 30 天以上的每日只保留最新一个，是否接受？
3. **CSS 迁移风险**：是否接受一次性迁移 global.css？如果担心回归，可以按 page 分批迁移。

请确认以上方向，我将按顺序进入实现。