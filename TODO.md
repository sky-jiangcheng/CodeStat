# TODO — 已知事项与待办

> 本文件记录 1.7.0 深度重构（见 [CHANGELOG](CHANGELOG.md) 与 [ADR-0005](docs/adr/0005-service-layer.md)）后**尚未完成**的事项。新问题请开 Issue；修复后请从此清单移除并写入 CHANGELOG。

## 高优先级

### 先统一产品定位与入口叙事（优先于功能新增）

当前产品同时承担「提交统计面板」「本地知识库」「AI 上下文工具」三个叙事，容易导致优先级模糊、回归成本高、问题定位困难。

建议接下来优先修复：

1. README / 首页 / Getting Started 统一为「本地项目上下文库」
2. 仪表盘、统计、热力图重新定义为「支持能力」而非主入口主叙事
3. 插件、PWA、Experimental 功能已经标记后，不要再成为其他核心功能的前置依赖
4. 前端错误恢复路径（重试、状态回退、异常边界）统一做一次
5. 对外短文案（中文+英文）统一三句定位，减少用户误判

> PR1 已落地覆盖第 1、2、3、5 项（见 [CHANGELOG Unreleased](CHANGELOG.md)）；第 4 项（前端错误恢复路径）归入 PR2。

### PR 与外发口径（可直接执行）

PR1（定位治理）已落地，见 [CHANGELOG Unreleased](CHANGELOG.md) 与 [positioning-brief.md 统一对外口径](docs/positioning-brief.md)。剩余：

**PR2：错误一致性与可用性（紧随其后）**
- 标题：`fix(web): unify retry and error recovery paths`
- 描述：本 PR 统一前后端错误边界、重试闭环和状态恢复，减少用户感知的按钮失效和页面假死。
- Commit message：`fix(web): unify error handling, retry and recovery paths`

### 品牌与二进制统一为 GitBuddy（重构方案阶段 11，已推迟）

## 中优先级

### 前端测试与数据层收尾

- [ ] vitest 目前仅 `utils/dates` 有测试；补 `hooks/useDebouncedCallback`、`hooks/useConfirmClick`、`hooks/useApiData`（缓存/失效语义）与 `api/endpoints`（transport 路由）测试
- [ ] `hooks/useApiData`（带 TTL 的跨组件缓存 + 请求去重）已实现但**尚未接入页面**——Dashboard/NoteSection/CommandPalette 仍各自直接拉取 projects 列表，接入后可消除重复请求
- [ ] `wails.json` 的 `wailsjsdir: web/src/lib` 从未生成使用，评估移除或真正启用 Wails 生成绑定

### 文档与 API 契约收尾

- [ ] `docs/api/openapi.json` 描述的 HTTP `/api/*` 路由在桌面端**并不存在**（后端为 Wails 绑定 + SPA 静态服务，spec 作为绑定面契约供 AI/网关消费者使用）；如未来恢复 HTTP server 模式需同步实现
- [ ] OpenAPI spec 需随绑定方法增删同步维护（1.7.0 已移除 `ExportProjectStats`/`ExportHeatmapCSV`/`GetNoteVersion`/`ScanForRepositories` 等死方法）
- [ ] docs 站生成脚本（`scripts/build-docs.mjs`）依赖 `web/node_modules` 的 marked；评估独立 devDependencies 或 vendor

### 上游协作

- [ ] `examples/plugins` 两个示例插件在重构后回归验证一次（插件 SPI 未变，预期兼容）

## 低优先级 / 观察项

- [ ] 桌面 GUI 无法在无头环境实测，回归依赖 `go test ./...` + `tsc` + `vite build` + vitest；建议在真机跑一轮冒烟（扫描→收藏→刷新历史→笔记 CRUD→版本恢复→知识库搜索→MCP 问答）
- [ ] 项目详情页概览挖掘（`mineAndCacheAsync`）为后台 goroutine，无 recover；`knowledge.Mine` 解析已加测试但可加防御性 recover
- [ ] MCP server 版本号与 `internal/version` 已统一，`scripts/bump-version.sh` 中对 `cmd/mcp` 硬编码的替换逻辑可移除
- [ ] 远程曾误提交 `.zcode/` 会话文件，已在 1.7.0 移出跟踪并 gitignore；如需从历史彻底清除体积可考虑 history rewrite（破坏性操作，需单独评估）
