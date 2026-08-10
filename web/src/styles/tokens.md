# GitBuddy Design Tokens

本文件记录 GitBuddy 设计系统中使用的 CSS 变量（tokens）。所有样式文件应优先使用这些 token，避免硬编码色值或尺寸。

## 使用方式

在组件 CSS 中通过 `var(--token-name)` 引用，例如：

```css
.my-component {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: var(--radius-md);
}
```

## Token 列表

### 背景色

| Token | 说明 |
|-------|------|
| `--bg-primary` | 页面主背景 |
| `--bg-secondary` | 卡片、输入框、面板背景 |
| `--bg-tertiary` | 次级背景、hover 背景 |
| `--bg-hover` | 悬浮状态背景 |
| `--bg-active` | 激活/按下状态背景 |

### 边框色

| Token | 说明 |
|-------|------|
| `--border-subtle` | 弱分割线、卡片边框 |
| `--border-default` | 输入框、按钮默认边框 |

### 文字色

| Token | 说明 |
|-------|------|
| `--text-primary` | 主文字、标题 |
| `--text-secondary` | 次级文字、描述 |
| `--text-tertiary` | 辅助文字、meta |
| `--text-muted` | 占位符、禁用态 |
| `--text-danger` | 危险/错误文字 |

### 语义色

| Token | 说明 |
|-------|------|
| `--accent` | 主强调色 |
| `--accent-light` | 强调色浅色变体 |
| `--accent-dark` | 强调色深色变体（hover） |
| `--accent-soft` | 强调色弱背景 |
| `--danger` / `--danger-soft` | 危险 |
| `--warning` / `--warning-soft` | 警告、待办 |
| `--info` / `--info-soft` | 信息、项目 |
| `--success` / `--success-soft` | 成功、开关开启 |

### 阴影

| Token | 说明 |
|-------|------|
| `--shadow-sm` | 小阴影（卡片） |
| `--shadow-md` | 中阴影（悬浮） |
| `--shadow-lg` | 大阴影（弹层） |

### 圆角

| Token | 值 |
|-------|-----|
| `--radius-sm` | 6px |
| `--radius-md` | 10px |
| `--radius-lg` | 14px |
| `--radius-xl` | 18px |

### 字体

| Token | 说明 |
|-------|------|
| `--font-sans` | 无衬线字体栈 |
| `--font-mono` | 等宽字体栈 |

### 动效

| Token | 说明 |
|-------|------|
| `--transition-fast` | 快速过渡（0.15s） |
| `--transition-base` | 基础过渡（0.25s） |

### 遮罩

| Token | 说明 |
|-------|------|
| `--overlay` | 弹层遮罩背景 |

## 主题

设计系统支持 `light` / `dark` 两种显式主题，通过 `data-theme` 属性切换（见 `utils/theme.ts`）。`system` 模式会根据 `prefers-color-scheme` 自动解析为 light 或 dark。

## 文件结构

```
web/src/styles/
├── index.css                 # 统一入口
├── tokens.md                 # 本文档
└── design-system/
    ├── tokens.css            # CSS 变量定义
    ├── reset.css             # 基础重置与 a11y
    ├── typography.css        # 排版与 markdown-body 基础
    ├── components/           # 原子组件样式
    ├── layouts/              # 页面布局样式
    └── features/             # 页面/功能级样式
```

## 新增 Token 规范

1. 新增 token 必须同时定义 `:root` 与 `[data-theme="dark"]` 下的值。
2. 优先使用已有语义 token（如 `--text-secondary`），避免新增一次性颜色。
3. 颜色类 token 命名遵循：`--{语义}` / `--{语义}-soft}` / `--{语义}-light}` / `--{语义}-dark}`。
