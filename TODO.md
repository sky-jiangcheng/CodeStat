# TODO — 已知事项与待办

> 本文件记录 1.7.0 深度重构（见 [CHANGELOG](CHANGELOG.md) 与 [ADR-0005](docs/adr/0005-service-layer.md)）后**尚未完成**的事项。新问题请开 Issue；修复后请从此清单移除并写入 CHANGELOG。

## 高优先级

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
