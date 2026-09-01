# TODO — 已知事项与待办

> 本文件记录产品深度评估产出的改进项。Sprint 1-12 已完成（D1-D11, D20-D23, C1-C3, C5-C6, C8, C10, C12-C15, P3, P7, P10-P11, P13-P16, P19, P21, P25-P28, P30, P35, P37-P38）。
> 第四轮深度评估（2026-08-27）：[docs/product-review/2026-08-27-new-deep-review.md](docs/product-review/2026-08-27-new-deep-review.md)。
> 修复后请从此清单移除并写入 CHANGELOG。
>
> **快捷跳转**：[✅ 已完成](#-已完成sprint-1-9) ｜ [🔴 删除项](#-删除项d7-d11) ｜ [🟡 收敛项](#-收敛项c11) ｜ [🟢 细化项](#-细化项p34-p38) ｜ [📋 遗留项](#-遗留项)

---

## ✅ 已完成（Sprint 1-9）

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
| D20 | 删除空目录 `skills/` | S9 |
| D21 | 删除空目录 `.agents/` | S9 |
| D22 | `.claude/settings.local.json` 确认未跟踪 | S9 |
| D23 | PWA 图标清理（`web/public/` 3 个 icon 文件） | S9 |
| C15 | install 脚本评估 → 保留 + README 双路径说明 | S9 |
| P35 | NoteSection CSS Modules 试点（notes.css 242→192 行，新建 .module.css 93 行） | S10 |
| P38 | ProjectDetail 拆分（316→214 行 + useProjectDetail hook 122 行） | S11 |
| P37 | SKILL.md 工作流指引 + MCP 工具参数/示例增强 | S12 |

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

## 🔴 删除项（D20-D23）

> 第四轮评估新增。零功能回退，纯减法。

### D20: 删除空目录 `skills/`

- [x] `rm -rf skills/`（零内容空目录）

### D21: 删除空目录 `.agents/skills/`

- [x] `rm -rf .agents/`（AI 工具产物，.gitignore 已覆盖）

### D22: `.claude/settings.local.json` 从 git 跟踪中移除

- [x] 确认未被 git 跟踪（.gitignore `.claude/` 已覆盖），无需操作

### D23: PWA 图标清理（`web/public/`）

- [x] 确认无代码引用 icon-192/512/maskable
- [x] 删除 3 个 PWA 图标文件（共 51KB），保留 favicon.ico + favicon.svg

---

## 🟡 收敛项（C11, C15）

> 前轮遗留 + 本轮确认。

### C11: 插件运行时精简评估（669 行）

- [ ] 方案 A（推荐）：`loader.go`（52 行）合并入 `runtime.go`，减少文件碎片
- [ ] 方案 B（2.0 考虑）：评估移除 yaegi 依赖，Claude importer 改为内置函数
- [ ] Claude importer 路径确认不受影响

### C15: install 脚本评估

- [x] **保留**脚本，README 安装说明已调整为「直接下载」+「脚本安装」双路径

---

## 🟢 细化项（P34-P38）

> 第四轮新增。按 AI 产品优先级排序。

### P34: `service/project_overview.go` 评估（221 行）

- [ ] 确认函数内聚度合理，**不拆**，验证 `MineAndCacheAsync` recover 已生效

### P35: 前端 CSS 架构迁移（4,055 行全局 CSS）

- [x] NoteSection CSS Modules 试点完成（notes.css 242→192 行，NoteSection.module.css 93 行新建）
- [ ] 保留全局 CSS 仅用于 reset、design tokens、跨组件基础样式
- [ ] 逐组件迁移，每轮 sprint 处理 1-2 个组件（下一步：KnowledgeCard）

### P36: `knowledge.go` 进一步拆分评估（515 行）

- [ ] 评估函数间共享参数情况，**暂不拆**（内聚度高），若新增知识挖掘维度再评估

### P37: SKILL.md 工作流指引增强

- [x] 在 SKILL.md 开头增加「推荐工作流」段落（search → ask → read → create）
- [x] 为每个 MCP 工具补充使用场景 + 参数约束 + 示例值

### P38: ProjectDetail 拆分确认（316→214 行）

- [x] `useProjectDetail` hook 已创建（122 行），数据层真正下沉
- [x] 组件降至 214 行（≤200 目标基本达成）

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
- [x] `.zcode/` 已移出跟踪，不需要 history rewrite
- [ ] P29 `parseTimestamp` 鲁棒性（低优先级，git log 格式稳定）
- [ ] P31 `Domain/types.go` 评估（仅 15 行，暂不需要收拢）
- [ ] P32 Wails 绑定层审计（218 行，确认 MCP 对应关系）
- [ ] P33 `TrendChart` 评估（100 行纯 SVG，「支持」级功能）
- [ ] P36 `knowledge.go` 进一步拆分评估（515 行，内聚度高暂不拆）

---

## 建议执行节奏

| 阶段 | 内容 | 预估 |
|------|------|------|
| ~~Sprint 1-5~~ | ~~D1-D11, C1-C3, C5-C6, C8, P3, P7, P10-P11, P13-P16, P19, P21~~ | ✅ 共 28 项 |
| ~~Sprint 6~~ | ~~D12-D19 剩余删除 + C10 NoteSection 拆分~~ | ✅ |
| ~~Sprint 7~~ | ~~C12 + P25-P27 大文件拆分 + P28 MCP 描述增强~~ | ✅ |
| ~~Sprint 8~~ | ~~C13 CSS 清理 + C14 测试拆分 + P30 懒加载~~ | ✅ |
| ~~**Sprint 9**~~ | ~~D20-D23 资产大扫除 + C15 文案调整~~ | ✅ |
| ~~**Sprint 10**~~ | ~~P35 NoteSection CSS Modules 试点~~ | ✅ |
| ~~**Sprint 11**~~ | ~~P38 ProjectDetail hook 提取~~ | ✅ |
| ~~**Sprint 12**~~ | ~~P37 SKILL.md 工作流指引~~ | ✅ |
| **2.0 规划** | C11 插件系统评估 + P35 全量 CSS Modules | 按版本 |
| **按需** | P29, P31, P32, P33, P36 | 随重构穿插 |
