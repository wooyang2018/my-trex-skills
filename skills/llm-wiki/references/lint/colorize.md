# Wiki Lint — 图谱着色（视觉区分文档）

> 本文件定义按标签、类别或可见性批量着色 wiki 文档的流程。
> 前置步骤见 `shared.md`；标签分类法见 `taxonomy.md`。

## 目录

- [着色概述](#着色概述)
- [着色步骤](#着色步骤)

---

## 着色概述

批量写入 `custom-color`（及可选的 `custom-icon`）属性到 wiki 文档，使思源 UI 表面 — 图谱视图、文件树、反向链接面板 — 视觉区分它们。

**写入类** — 需要 `rwd` 权限。典型运行触及笔记本下的每个文档。

**思源 vs Obsidian 模型**：思源中每个文档携带自己的 `custom-color` 属性，没有中央颜色规则文件。此技能计算每个文档的颜色并通过 `block set-attrs` 写入。

**运行前重申影响。**

---

## 着色步骤

### 1. 选择模式

| 模式 | 说明 |
|---|---|
| `by-tag` *(默认)* | 按排名最高的标签着色 |
| `by-category` | 固定类别→颜色映射 |
| `by-visibility` | 按 visibility 标签着色 |
| `combined` | 可见性覆盖标签 |
| `custom` | 用户提供映射 |
| `clear` | 移除所有颜色 |

### 2. 构建文档注册表

执行 `shared.md` 前置步骤和注册表构建。客户端过滤 `/_` 前缀和系统文档。解析 `custom-tags`、`custom-category`、`custom-redirects-to`。

### 3. 选择颜色

使用 10 种色盲友好调色板：

| # | Hex | 角色 |
|---|---|---|
| 0 | `#4E79A7` | 蓝色 |
| 1 | `#F28E2B` | 橙色 |
| 2 | `#E15759` | 红色 |
| 3 | `#76B7B2` | 青色 |
| 4 | `#59A14F` | 绿色 |
| 5 | `#EDC948` | 黄色 |
| 6 | `#B07AA1` | 紫色 |
| 7 | `#FF9DA7` | 粉色 |
| 8 | `#9C755F` | 棕色 |
| 9 | `#BAB0AC` | 灰色 |

**模式映射**：
- `by-tag`：取前 10 标签，每个文档按其排名最高的标签着色
- `by-category`：concepts=蓝, entities=橙, skills=红, references=青, synthesis=绿, projects=黄, journal=紫
- `by-visibility`：pii→红, internal→橙, public→绿。无 visibility 标签的文档不着色
- `combined`：先 by-visibility；未匹配的回退到 by-tag
- `clear`：写入空字符串移除 `custom-color`

### 4. 应用颜色

对每个 `(doc_id, hex_color)` 对通过 `block set-attrs` 写入。幂等：跳过已匹配的。每 50 个一批打印进度。

### 5. 报告

模式、扫描数、着色数、跳过数、错误数。

完成后按 `shared.md` 日志格式：`LINT mode=colorize pages_scanned=N colored=C skipped=S errors=E method=<mode>`。
