# ADR-0003: FTS5 trigram 全文搜索

- 状态：Accepted
- 日期：2026-08-10（补录，实现于 1.6.x / issue #18）
- 关联：[ADR-0002](0002-c-end-repositioning.md)

## 背景

知识库需要对笔记标题 / 内容 / 标签、待办标题做全文搜索，且必须支持中文（无空格分词）。此前使用 `LIKE %q%` 扫描：无相关性排序、无 snippet、全表扫描。

## 决策

采用 SQLite **FTS5 + trigram tokenizer**：

1. `project_notes_fts` / `project_todos_fts` 虚拟表 + 同步触发器，写入自动更新索引
2. 查询词逐项包裹为短语（双引号转义），组合为隐式 AND，规避 FTS 查询语法注入
3. `bm25()` 排序取前 20，snippet 窗口截取并以 `<mark>` 高亮
4. trigram 最小 3 字符：任一查询词 < 3 字符（如 2 字中文词）自动降级 `LIKE` 扫描（已转义 `%`/`_`）
5. FTS 索引缺失或查询报错时回退 LIKE，搜索永不失效

## 后果

- 正面：O(索引) 查询、相关性排序、高亮 snippet；2 字 CJK 查询不丢结果
- 负面：索引体积与触发器维护成本；trigram 对 <3 字符查询无能为力（由 LIKE 兜底）
- 实现位置：`internal/db/search.go`（1.7.0 从 queries.go 拆出）
