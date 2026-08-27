# TODO — 已知事项与待办

> 本文件记录产品深度评估产出的改进项。Sprint 1-5 已完成（D1-D11, C1-C3, C5-C6, C8, P3, P7, P10-P11, P13-P16, P19, P21）。
> 第三轮终态评估（2026-08-26）：[docs/product-review/2026-08-26-final-deep-review.md](docs/product-review/2026-08-26-final-deep-review.md)。
> 修复后请从此清单移除并写入 CHANGELOG。
>
> **快捷跳转**：[✅ 已完成](#-已完成sprint-1-5) ｜ [🔴 删除项](#-删除项d12d19) ｜ [🟡 收敛项](#-收敛项c10c15) ｜ [🟢 细化项](#-细化项p25p33) ｜ [📋 遗留项](#-遗留项)

---

## ✅ 已完成（Sprint 1-8）

<details>
<summary>展开查看已完成项</summary>

| ID | 内容 | 完成 |
|----|------|------|
| D1 | 删除 `scripts/legacy/` | S1 |
| D2 | 删除 `scripts/generate_screenshots.py` | S1 |
| D3 | `tools/agent-score/` → MCP `gitboard_agent_score` | S1 |
| D4 | 社区文件精简 | S1 |
| D5 | 删除 `.agents/` + gitignore | S1 |
| D6 | 删除 `.workbuddy/` + gitignore | S1 |
| D7 | 删除 `web/dist/` 构建产物 | S3 |
| D8 | 删除 DMG 素材 | S3 |
| D9 | 删除 `tokens.md` | S3 |
| D10 | 删除 `openapi.json` | S3 |
| D11 | 删除 docs issue 模板 | S3 |
| C1 | PWA/SEO 清理 | S1 |
| C2 | 插件系统降级 | S2 |
| C3 | 块编辑器冻结 | S2 |
| C5 | Knowledge 页面数据层拆分 | S4 |
| C6 | Dashboard 页面数据层拆分 | S4 |
| C8 | 历史评估文档压缩 | S3 |
| C10 | NoteSection 拆分（417行 → 305行 + hooks） | S6 |
| C12 | ProjectDetail 拆分（316行 → useProjectDetail） | S7 |
| C13 | CSS 死代码清理（移除 ~20 个未引用类） | S8 |
| C14 | queries_test.go 拆分（784行 → test_helpers + queries_test） | S8 |
| P3 | MCP 写入工具 | S2 |
| P7 | 版本号 SSOT | S2 |
| P10 | MCP 搜索结果结构化 | S3 |
| P11 | MCP 写入返回 note_id | S3 |
| P13 | 搜索排序优化 | S4 |
| P14 | 前端错误边界 | S4 |
| P15 | `db/db.go` 拆分 | S5 |
| P16 | `service/project.go` 拆分 | S5 |
| P19 | 版本历史 diff 可视化 | S5 |
| P21 | useScanPolling 测试 | S5 |
| P25 | `knowledge.go` 拆分（572行 → knowledge.go + types.go） | S7 |
| P26 | `stats.go` 拆分（471行 → 7 files） | S7 |
| P27 | `cmd/mcp/main.go` 拆分（453行 → 6 files） | S7 |
| P28 | MCP 工具描述增强 | S7 |
| P30 | 前端路由懒加载（dashboard/knowledge/projectDetail/settings chunks） | S8 |

</details>

---

## 🔴 删除项（D7-D11）

> 纯减法，零功能回退。

### D7: 删除 `web/dist/` 构建产物

- [x] 删除 `web/dist/` 目录（~200 个 KaTeX 字体/Mermaid chunk/Vite 缓存文件）
- [x] `.gitignore` 已包含 `web/dist/`，`vite build` 重建后 Wails embed 正常

### D8: 删除 macOS DMG 素材

- [x] 删除 `build/dmg-background.svg` + `build/dmg-readme.txt`

### D9: 删除 `tokens.md`

- [x] 删除 `web/src/styles/tokens.md`

### D10: 删除手动维护的 OpenAPI spec

- [x] 删除 `docs/api/openapi.json`（后续改为 CI 自动生成）

### D11: 删除 docs issue 模板

- [x] 删除 `.github/ISSUE_TEMPLATE/docs.yml`

---

## 🟡 收敛项（C10-C15）

> 降低前端复杂度 + Go 大文件治理。

### C10: NoteSection 拆分

- [x] 417 行拆出 `useNoteMutations` + `useNoteDraft` + `useNoteVersionHistory` + `useFilteredNotes` hooks + NoteFilterBar 子组件
- [x] 目标：NoteSection ≤ 200 行（实际 305 行，逻辑下沉至 hooks）

### C11: 插件运行时精简评估

- [ ] 评估 669 行插件代码（runtime + loader + plugin + service/plugin）在冻结策略下是否可压缩
- [ ] Claude importer 路径确认不受影响

### C12: ProjectDetail 拆分

- [x] 316 行 → `useProjectDetail` hook
- [x] 路由懒加载 + manualChunks 独立 chunk

### C13: CSS 死代码清理

- [x] 移除 `.badge-ok`、`.badge-err`（cards.css）
- [x] 移除 `.btn-delete:hover`（buttons.css）
- [x] 移除 `.chart-empty`（project-detail.css）
- [x] 移除 `.plugin-badge`（settings.css）
- [x] 移除 `.form-select` 独立规则（inputs.css，已合并至 `.form-input` 选择器列表）
- [x] 保留 `.task-list`（markdown.css 中由 Markdown 渲染库动态注入）
- [x] 保留 `.heatmap`、`.badge-source`、`.kind-badge` 等实际使用的类

### C14: `queries_test.go` 拆分

- [x] 784 行按域拆分：`test_helpers.go`（setupTestDB + createTestProject）+ `queries_test.go`（测试函数）
- [x] 移除 `database/sql` 未使用 import（helpers 已在 test_helpers.go 中）

### C15: install 脚本评估

- [ ] 评估 `install.sh` + `install.ps1` 是否需要保留（GitHub Release 二进制 + README 说明可能已足够）

---

## 🟢 细化项（P25-P33）

> 新增项。按文件体量和 AI 产品优先级排序。

### P25: `knowledge.go` 拆分 ✅

- [x] 572 行拆为 `knowledge.go`（515 行实现）+ `types.go`（48 行类型定义）

### P26: `stats.go` 拆分 ✅

- [x] 471 行拆为 7 个文件：`types.go` + `stats.go` + `validation.go` + `query.go` + `commits.go` + `range.go` + `dates.go`

### P27: `cmd/mcp/main.go` 拆分 ✅

- [x] 453 行拆为 6 个文件：`main.go` + `tools_notes.go` + `tools_projects.go` + `tools_search.go` + `tools_score.go` + `results.go`

### P28: MCP 工具描述增强 ✅

- [x] 为每个工具补充使用场景 + 参数约束 + 示例值
- [x] 推荐 AI 工作流：ask → read → create → update

### P29: `stats.go` 时间戳解析鲁棒性 🔻低

- [ ] `parseTimestamp` 支持 ISO 8601 和 git 默认格式

### P30: 前端路由级懒加载 ✅

- [x] `React.lazy()` + `Suspense` 对 Dashboard/Knowledge/ProjectDetail/Settings 代码分割
- [x] `vite.config.ts` manualChunks 独立 chunk（dashboard、knowledge、projectDetail、settings）

### P31: `Domain/types.go` 评估 🔻低

- [ ] 评估是否收拢核心 domain 类型（当前仅 15 行，类型散落在各包）

### P32: Wails 绑定层审计 🔸中

- [ ] 审计 `bindings.go` 218 行每个方法：有 MCP 对应？desktop-only？

### P33: `TrendChart` 组件评估 🔻低

- [ ] 评估 100 行纯 SVG 趋势图是否需要或用 CSS 替代

---

## 📋 遗留项

- [ ] 桌面 GUI 回归测试：建议在真机跑一轮冒烟（扫描→收藏→刷新历史→笔记 CRUD→版本恢复→知识库搜索→MCP 问答）
- [x] `mineAndCacheAsync` 后台 goroutine 加 recover（`project_overview.go:138`）
- [ ] 远程曾误提交 `.zcode/`，已在 1.7.0 移出跟踪；如需从历史彻底清除可考虑 history rewrite（可选，影响所有协作者）

---

## 建议执行节奏

| 阶段 | 内容 | 预估 |
|------|------|------|
| ~~Sprint 1-5~~ | ~~D1-D11, C1-C3, C5-C6, C8, P3, P7, P10-P11, P13-P16, P19, P21~~ | ✅ 共 28 项 |
| **Sprint 6** | D12-D19 剩余删除 + C10 NoteSection 拆分 | ~2h |
| **Sprint 7** | C12 + P25-P27 大文件拆分 + P28 MCP 描述增强 | ~3h |
| **Sprint 8** | C13 CSS 清理 + C14 测试拆分 + P30 懒加载 | ~3h |
| **按需** | C7, C11, C15, P12, P17, P20, P22-P24, P29, P31-P33 | 随重构穿插 |
