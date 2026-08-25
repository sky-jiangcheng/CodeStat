# TODO — 已知事项与待办

> 本文件记录 1.7.0 深度重构后**尚未完成**的事项与 2026-08-25 产品深度评估产出的改进项。
> 评估全文见 [docs/product-review/2026-08-25-deep-review.md](docs/product-review/2026-08-25-deep-review.md)。
> 修复后请从此清单移除并写入 CHANGELOG。
>
> **快捷跳转**：[🔴 删除项](#-删除项d1d6) ｜ [🟡 收敛项](#-收敛项c1c3) ｜ [🟢 细化项](#-细化项p1p9) ｜ [📋 遗留项](#-遗留项从原-todomd-保留)

---

## 🔴 删除项（D1-D6）

> 纯减法，零功能回退，建议优先执行。

### D1: 删除 `scripts/legacy/`

- [x] 删除 `scripts/legacy/patches/` 和 `scripts/legacy/statistics.sh`
- [x] 确认无其他文件引用（已归档的遗留脚本，应无依赖）

### D2: 删除 `scripts/generate_screenshots.py`

- [x] 删除 `scripts/generate_screenshots.py`（550+ 行 Pillow mock 截图脚本，标记为 v1.5.0 UI，已过时）
- [x] `screenshots/` 目录保留，替换为真实应用截图（`wails dev` 手动截图或 Playwright 自动化）

### D3: 将 `tools/agent-score/` 合并为 MCP 工具

- [x] 在 `cmd/mcp/main.go` 中新增 `gitboard_agent_score` MCP 工具（复用 agent-score 的 8 项检查逻辑）
- [x] 删除 `tools/agent-score/` 目录
- [x] 更新 `scripts/build.sh` 移除 agent-score 独立构建
- [x] 更新 `SKILL.md` 移除 agent-score 独立二进制说明
- [x] 更新 README 构建说明

### D4: 精简社区健康文件

- [x] 删除 `CODE_OF_CONDUCT.md`（个人项目不需要）
- [x] 删除 `SUPPORT.md`（README 已覆盖）
- [x] 将 `CONTRIBUTING.md` 核心内容合并到 README "参与贡献"节，删除原文件
- [x] 保留 `SECURITY.md`（有实际安全价值）

### D5: 清理 `.agents/` 目录

- [x] 删除 `.agents/` 目录（EasyClaw 工具产物，不属于项目）
- [x] `.gitignore` 添加 `.agents/`

### D6: 清理 `.workbuddy/` 目录

- [x] 删除 `.workbuddy/` 目录（AI 工具记忆文件，不属于项目）
- [x] `.gitignore` 添加 `.workbuddy/`

---

## 🟡 收敛项（C1-C3）

> 按 ADR-0006 执行冻结：标记为"暂缓/实验性"的能力需要真正停手。

### C1: PWA/SEO 代码清理

ADR-0006 明确标记 PWA/SEO 为"暂缓/待移除"，但代码仍全量打包进桌面二进制。桌面应用不需要 install prompt、robots.txt、sitemap.xml、OG meta tags。

- [x] 删除 `web/src/utils/install.ts`（71 行 PWA install prompt 捕获/消费）
- [x] 删除 `web/src/utils/seo.ts`（50 行 OG/Twitter meta 注入）
- [x] 删除 `web/public/offline.html`
- [x] 删除 `web/public/robots.txt` 和 `web/public/sitemap.xml`
- [x] 从 `web/package.json` devDependencies 移除 `vite-plugin-pwa`
- [x] 从 `web/vite.config.ts` 移除 PWA 插件配置
- [x] 从 `App.tsx` 移除 install toast 逻辑（`onInstallPrompt` 相关 ~15 行）
- [x] 从各页面组件移除 `usePageMeta` 调用（如有）
- [x] 保留 `web/public/` 下的图标文件（favicon 等桌面应用仍需要）

> 如果未来要保留 PWA 作为独立交付形态，单独拉分支维护。

### C2: 插件系统降级

ADR-0006 标记插件为"实验性，不扩展平台基础设施"。保留 runtime 核心（支持 Claude 记忆导入），清理平台化 UI 和示例。

- [x] 删除 `examples/plugins/` 目录（hello + importer 两个示例插件）
- [x] `web/src/pages/settings/PluginsTab.tsx` 简化：仅显示已启用的知识源导入器状态（启用/禁用 + 手动触发导入），去掉"脚本插件"概念的 UI
- [x] `docs/plugins/overview.md` 标记为实验性警告，缩减到一页
- [x] 确认 Claude 记忆导入路径不受影响（走 service/plugin.go 的 `TriggerImport`）

### C3: 块编辑器冻结

ADR-0006 明确说"暂缓新增复杂编辑器块"。当前 `BlockEditor.tsx`（357 行）支持 Callout/Tabs/Details/Code/Mermaid/KaTeX/Table 等结构化块。

- [x] 在 `BlockEditor.tsx` 顶部添加冻结标记注释：`// EDITOR-FROZEN: do not add new block types per ADR-0006`
  - [x] ~~将各块类型实现拆到 `web/src/components/blocks/` 子目录（每块一个文件），降低单文件认知负荷
- [ ] 为核心路径补 vitest 测试：拖拽排序、块插入、Markdown 序列化输出
- [ ] 确认块编辑器产物仍为纯 Markdown（AI 可读性约束）

---

## 🟢 细化项（P1-P9）

### P1: `service/project.go` 拆分 🔸中

当前 340 行，混合了 CRUD、升降级、知识挖掘调度三类逻辑。

- [ ] 拆出 `service/project_level.go`（`UpdateProjectLevel` + 相关辅助）
- [ ] 拆出 `service/project_overview.go`（`GetProjectOverview` + `mineAndCacheAsync`）
- [ ] `service/project.go` 保留纯 CRUD（Get/Detail/Stats/Search/ToggleStar/RefreshHistory）

### P2: `db/db.go` 迁移逻辑拆分 🔸中

当前 432 行，`InitDB` + 8 个迁移脚本混在一起。

- [ ] 拆出 `db/migrate.go`（所有迁移 SQL + `migrateSchema` 函数）
- [ ] `db/db.go` 仅保留 `InitDB` 入口 + 连接配置 + WAL/PRAGMA 设置

### P3: MCP 新增写入工具 ⬆️高

当前 6 个工具全是只读，AI 能读知识库但不能写回，闭环缺一环。

- [x] 新增 `gitboard_notes_create` 工具（参数：title, content, category, tags?, projectId?）
- [x] 新增 `gitboard_notes_update` 工具（参数：id, content?, title?, category?, tags?）
- [x] 复用 `internal/service/note.go` 现有的 Create/Save 方法
- [x] 更新 SKILL.md 的 MCP 工具表
- [x] 更新 `docs/api/reference.md`

### P4: 前端测试补齐 ⬆️高

当前 6,400 行 TS/TSX，只有 hooks 和 api 层有测试，组件和页面零覆盖。

- [x] 补 `web/src/utils/markdown.ts` 测试（Mermaid/KaTeX/Callout 渲染是高频路径）
- [x] 补 `web/src/utils/theme.ts` 测试
- [ ] 补 `web/src/components/notes/NoteEditor.tsx` 核心路径组件测试
- [ ] 补 `web/src/components/BlockEditor.tsx` 核心路径测试（配合 C3）
- [ ] 补 `web/src/hooks/useScanPolling.ts` 测试（当前唯一未测 hook）

### P5: CSS 命名空间与隔离评估 🔻低

当前手写全局 CSS，无 CSS Modules / Tailwind。类名冲突风险随组件增长。

- [ ] 短期：在 `styles/design-system/` 中确立 `.gb-*` 命名空间约定
- [ ] 中期：评估 CSS Modules 迁移成本（对桌面应用收益有限，可推迟）
- [ ] 不建议引入 Tailwind（体积大、桌面应用收益低）

### P6: 轻量全局状态评估 🔻低

当前页面级 `useState` + hooks，4 个页面勉强够用。`projects:all` 缓存键跨组件共享靠手动 `invalidateCache`。

- [ ] 评估是否需要 `ProjectContext`（当前选中项目 + 收藏列表）
- [ ] 如果当前规模下没出实际 bug，可推迟

### P7: 版本号 SSOT 强化 🔸中

当前版本号在 `internal/version/version.go`、`wails.json`、`web/package.json` 三处维护，`scripts/bump-version.sh` 同步。

- [x] 考虑 `internal/version/version.go` 为唯一来源
- [x] CI 构建时从 Go 源注入版本号到 `wails.json` 和 `web/package.json`，不在仓库里维护副本
- [x] 简化 `scripts/bump-version.sh`

### P8: `queries_test.go` 按域拆分 🔻低

当前 `internal/db/queries_test.go` 21K，过于集中。

- [ ] 按域拆到 `projects_test.go`、`notes_test.go`、`todos_test.go` 等
- [ ] 与 P2 的 migrate.go 拆分同步进行

### P9: OpenAPI spec 同步维护 🔸中

TODO.md 原有遗留项。1.7.0 已移除多个死方法但 OpenAPI spec 可能未同步。

- [ ] 审计 `docs/api/openapi.json` 与当前 `internal/app/bindings.go` 的对齐情况
- [ ] 移除已删除方法的 spec 条目
- [ ] 补齐新增方法的 spec 条目

---

## 📋 遗留项（从原 TODO.md 保留）

- [ ] 桌面 GUI 无法在无头环境实测，回归依赖 `go test ./...` + `tsc` + `vite build` + vitest；建议在真机跑一轮冒烟（扫描→收藏→刷新历史→笔记 CRUD→版本恢复→知识库搜索→MCP 问答）
- [ ] 项目详情页概览挖掘（`mineAndCacheAsync`）为后台 goroutine，无 recover；`knowledge.Mine` 解析已加测试但可加防御性 recover
- [ ] 远程曾误提交 `.zcode/` 会话文件，已在 1.7.0 移出跟踪并 gitignore；如需从历史彻底清除体积可考虑 history rewrite（破坏性操作，需单独评估）

---

## 建议执行节奏

| 阶段 | 内容 | 预估 |
|------|------|------|
| **Sprint 1（本周）** | D1-D6 全部删除项 + C1 PWA 清理 | ~2h |
| **Sprint 2（下周）** | C2 插件降级 + C3 块编辑器冻结 + P3 MCP 写入工具 | ~5h |
| **Sprint 3** | P4 前端测试 + P7 版本号 SSOT | ~4h |
| **按需** | P1/P2/P5/P6/P8/P9 | 随重构穿插 |
