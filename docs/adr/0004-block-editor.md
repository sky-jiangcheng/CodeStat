# ADR-0004: 块编辑器（Block Editor）

- 状态：Accepted
- 日期：2026-08-10（补录，实现于 1.5.7 / issue #19）
- 关联：[ADR-0002](0002-c-end-repositioning.md)

## 背景

知识笔记需要超越纯 textarea 的编辑体验（对标 GitBook 的结构化块），但**存储格式必须仍是纯 Markdown**——数据属于用户，不能被编辑器锁定。

## 决策

在 React 侧实现轻量块编辑器（`web/src/components/BlockEditor.tsx`），而非引入重型富文本框架：

1. 内容按空行切分为块，`detectType()` 依据首行语法识别块类型（标题/代码/callout/列表/表格/公式/分隔线…）
2. 每块独立行内编辑；`joinBlocks()` 以 `\n\n` 重组——**产物与手写 Markdown 完全等价**
3. 输入 `/` 呼起块面板，插入 callout / tabs / details / 代码 / Mermaid / 公式 / 表格等模板
4. 块级拖拽排序与上下移；Markdown 源码 ↔ 块双轨随时切换
5. 预览走 `renderMarkdownAsync`（Mermaid/KaTeX 异步渲染）

## 后果

- 正面：零新增运行时依赖；数据可随时被任何 Markdown 工具读写；与版本历史 diff 天然兼容
- 负面：块识别是启发式的，极端嵌套 Markdown 可能合并为单块（退化为普通编辑，无损）
- 1.7.0：块面板标签/描述/插入模板已 i18n 化（`buildPaletteItems(t)`）
