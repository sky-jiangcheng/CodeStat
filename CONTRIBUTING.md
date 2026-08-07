# Contributing

感谢你愿意为 GitBuddy 贡献代码！请阅读以下指南以确保协作顺畅。

## 开发环境

- **Go** 1.23+
- **Node.js** 18+（前端构建）
- **Git** 必须可用且在 PATH 中（应用依赖 git 命令解析统计）

## 本地开发

```bash
# 1. 安装前端依赖
cd web && npm install && cd ..

# 2. 构建前端（编译为静态资源）
cd web && npm run build && cd ..

# 3. 开发模式（两个终端）
# 终端1：启动后端开发服务器
go run . -dev

# 终端2：启动前端热更新开发服务器
cd web && npm run dev
```

前端开发服务器 `http://localhost:5173` 会将 `/api` 请求代理到后端 `http://localhost:18731`。

## 代码规范

- **Go**：遵循 `gofmt` 格式，运行 `go vet ./...` 与 `go test ./...` 保证无错误
- **TypeScript/React**：遵循项目既有风格，组件采用函数式 + Hooks
- **SQL**：所有查询使用参数化语句，禁止字符串拼接（防注入）
- 提交前移除调试用 `console.log` 与临时注释

## 提交规范

提交信息采用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
feat: 新增知识库全文搜索
fix: 修复热力图日期边界错误
refactor: 统一错误处理结构
docs: 补充 API 说明
chore: 更新依赖版本
```

## 分支与 PR 流程

1. 从 `master` 检出新分支：`git checkout -b YYMMDD-feat-短描述`
2. 提交改动（小步提交，一次提交只做一件事）
3. 推送分支并创建 Pull Request
4. PR 描述请使用仓库提供的模板，说明变更内容、动机与验证方式
5. 等待审查，处理 CI 与审查意见

## 测试

- 后端单元测试：`go test ./internal/...`
- 修改涉及数据库查询或统计逻辑时，请补充对应包的测试用例
- 前端暂无自动化测试，改动后请手动验证对应页面

## 报告问题

使用 GitHub Issues 报告缺陷或功能建议，请选择对应模板填写。

## 行为准则

所有参与者需遵守 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)。
