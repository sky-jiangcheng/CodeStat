---
title: 插件手册
order: 8
---

# 插件手册

插件是放在配置目录 `plugins/` 下的 **Go 脚本**（[yaegi](https://github.com/traefik/yaegi) 解释执行，进程内、免编译、免重启热重载）。两类能力：

1. **事件处理器**：订阅应用事件（如 `note.created`、`project.scanned`、`import.completed`）
2. **知识源导入器**：向知识库幂等导入文档（与内置 Claude 记忆导入同一运行时路径）

## 快速开始

每个插件 = 一个目录 + 一个 `plugin.go`。把目录放进 `<配置目录>/gitboard/plugins/`：

| 平台 | 插件目录 |
|------|---------|
| macOS | `~/Library/Application Support/gitboard/plugins/<名字>/plugin.go` |
| Windows | `%APPDATA%\gitboard\plugins\<名字>\plugin.go` |
| Linux | `~/.config/gitboard/plugins/<名字>/plugin.go` |

然后在 **设置 → 插件 → 重新加载**。完整示例见仓库 [`examples/plugins/`](https://github.com/sky-jiangcheng/gitbuddy/tree/master/examples/plugins)。

## 插件接口

```go
//go:build ignore

package main

import "gitboard/internal/core/plugin"

func Name() string { return "hello" }          // 必需：设置页展示的稳定标识
func Init(ctx *plugin.Context) error {         // 必需：启动时调用一次
    ctx.On("note.created", func(e plugin.Event) error {
        return nil // 事件名 → Data map[string]any
    })
    return nil
}

// 可选：知识源导入器（出现于 设置→插件→知识导入源）
func Source() string { return "example" }      // 默认取 Name()
func Import(ctx *plugin.Context) ([]plugin.ImportDoc, error) {
    return []plugin.ImportDoc{{
        ProjectID: 1,        // 0 表示跳过（计入 skipped）
        Title:     "标题",
        Content:   "Markdown 内容",
        Kind:      "knowledge",
    }}, nil
}
```

## 可用事件

| 事件 | 时机 | Data |
|------|------|------|
| `note.created` | 笔记创建 | `id` / `project_id` / `title` / `content` / `tags` / `kind` |
| `project.scanned` | 扫描完成 | `repos_found` / `projects` |
| `import.completed` | 知识源导入完成 | `source` / `created` / `updated` / `skipped` |

## 数据访问

`ctx.DB()` 返回底层 `*sql.DB`（SQLite，WAL）。⚠️ 插件拥有完整读写权限，请只安装可信来源的插件；这是 ADR-0002 明确接受的本地信任模型。

## 幂等导入语义

运行时按 `(project_id, source, title)` upsert：重复导入**更新**既有笔记而非重复创建（与 Claude 记忆导入一致）。

## 安全与隔离

- 插件 panic 不会崩溃宿主：运行时 recover 并把错误显示在设置页
- 插件在独立解释器实例中执行，符号表仅暴露标准库与 `gitboard/internal/core/plugin`
- 删除插件目录 + 重新加载 即可卸载

## 内置知识源

| 源 | 说明 |
|----|------|
| `claude` | 导入 `~/.claude/projects/*/memory/*.md`，按项目名 / 仓库路径匹配归属 |

启动自动导入可在 **设置 → 插件** 开关（`auto_import` 配置项）。
