# Wiki Lint — 去重（身份解析与页面级合并）

> 本文件定义去重完整流程。前置步骤和安全协议见 `shared.md`，审计检查见 `audit.md`（检查 11）。
> 去重后建议运行 `crosslink.md` 收紧图谱。

## 目录

- [去重概述](#去重概述)
- [调用形式](#调用形式)
- [步骤 D1：构建页面注册表](#步骤-d1构建页面注册表)
- [步骤 D2：检测候选对](#步骤-d2检测候选对)
- [步骤 D3：语义裁决](#步骤-d3语义裁决)
- [步骤 D4：审计报告](#步骤-d4审计报告)
- [步骤 D5：合并](#步骤-d5合并)
- [重定向存根处理](#重定向存根处理)

---

## 去重概述

查找并合并以不同名称覆盖同一概念的 wiki 页面。**这是破坏性操作**——页面合并不能自动撤销。合并模式下每步前必须确认。

### 调用形式

| 模式 | 标志 | 行为 |
|---|---|---|
| **审计** | *（默认）* | 仅报告候选——不写入 |
| **合并** | `--merge` | 显示每个确认对，合并前询问确认 |
| **自动合并** | `--auto` | 非交互式合并所有高置信度对（`score ≥ 0.90`） |

未指定时在审计模式运行并呈现发现后询问是否继续。

---

## 步骤 D1：构建页面注册表

执行 `shared.md` 前置步骤和注册表构建，去重专用过滤：

```
siyuan-sisyphus search query_sql --stmt "
  SELECT id, hpath, name, ial FROM blocks
  WHERE type='d'
    AND box='<SIYUAN_NOTEBOOK_ID>'
    AND hpath NOT LIKE '%/index'
    AND hpath NOT LIKE '%/log'
    AND hpath NOT LIKE '%/hot'
    AND hpath NOT LIKE '%/_insights'
  LIMIT 1000
"
```

客户端过滤 `/_` 前缀子树。跳过 `custom-redirects-to` 非空的行——那些是已合并的重定向存根。

---

## 步骤 D2：检测候选对

对注册表中的每对页面计算**相似度得分**：

### 标题相似度信号

| 信号 | 评估方式 | 最大贡献 |
|---|---|---|
| **词元重叠** | 小写标题词元 Jaccard 相似度 | 0.65 |
| **编辑距离** | 归一化：`1 - (edits / max(len_a, len_b))` | 0.40 |
| **子串包含** | 一个标题是另一个的子串 | 0.50 |
| **别名交叉匹配** | 页面 A 的标题出现在页面 B 的 `aliases` 中，反之亦然 | 0.65 |

### 语义信号（廉价遍历）

| 信号 | 分值 |
|---|---|
| 同 `category` 目录 | +0.10 |
| 标签重叠 ≥ 3 个共享 | +0.15 |
| 标签重叠 ≥ 2 个共享 | +0.05 |
| 相同首标签 | +0.05 |

### 阈值

| 得分 | 标签 |
|---|---|
| ≥ 0.90 | 高——几乎确定是同一概念 |
| 0.75–0.89 | 中——可能是，需验证 |
| 0.60–0.74 | 低——可能的缩写或特化；跳过 |

**快速退出**：笔记本 < 10 个页面时跳过。> 500 个页面时分批 50 对处理。

---

## 步骤 D3：语义裁决

对每个候选对（按得分降序），完整读取两个页面后判断：

| 裁决 | 含义 |
|---|---|
| `merge` | 同一概念——不同名称、缩写、别名或意外重复。安全合并。 |
| `keep-separate` | 相关但不同。如"Server Actions"与"Server Components"——相关 React 功能，非重复。 |
| `needs-review` | 模糊——大量重叠但也有有意义差异。标记给用户决定。 |

---

## 步骤 D4：审计报告

始终生成此报告，即使在合并/自动合并模式下：

```markdown
## Wiki 去重报告

### 高置信度候选（得分 ≥ 0.90）：N 对
| 得分 | 页面 A | 页面 B | 裁决 | 原因 |
|---|---|---|---|---|
| 0.95 | `concepts/rsc` | `concepts/react-server-components` | merge | "RSC"是缩写；两页面覆盖相同材料 |

### 中置信度候选（得分 0.75–0.89）：N 对
| 得分 | 页面 A | 页面 B | 裁决 | 原因 |
|---|---|---|---|---|
| 0.82 | `concepts/fine-tuning` | `concepts/finetuning` | merge | 同一概念，连字符变体 |

### 需人工审查：N 对
| 得分 | 页面 A | 页面 B | 原因 |
|---|---|---|---|
| 0.78 | `concepts/agents` | `concepts/autonomous-agents` | 大量重叠但可能有意更宽泛 |

### 摘要
- 扫描页面：N / 发现候选对：M / 建议合并：X / 保持独立：Y / 需审查：Z
```

---

## 步骤 D5：合并

对每个 `merge` 裁决对（合并或自动合并模式）：

### 5a：选择规范页面

按顺序应用决胜规则：
1. **更多入站链接** — `get_backlinks` 计数高者胜出
2. **内容更丰富** — 正文更长胜出
3. **来源更多** — `sources:` 列表更大胜出
4. **标题更长** — 更具描述性胜出
5. **字母序** — 更早的标题胜出

规范页面 = **幸存者**。另一页面 → 次要页面（被合并后替换为重定向存根）。

### 5b：合并内容到规范页面

更新规范页面：
- `aliases:` — 添加次要页面的标题和所有别名（去重）
- `tags:` — 合并两个标签列表（去重，上限 5 个领域标签 + 系统标签）
- `sources:` — 合并两个来源列表（去重）
- `relationships:` — 合并（按目标去重，优先有类型的条目）
- `base_confidence` — 使用来源并集重新计算
- `updated` — 设为当前时间
- `summary:` — 如果次要页面带来新内容则重写
- **正文** — 整合次要页面的独特部分和要点。不要盲目追加——整合。用 `^[inferred]` 标记综合处
- `provenance:` — 合并后重新计算

### 5c：写入重定向存根

在次要页面路径写入：

```markdown
---
title: <次要页面标题>
redirects_to: "((<canonical-doc-id> \"<canonical title>\"))"
aliases: [<secondary aliases>]
category: <secondary category>
tags: []
created: <secondary original created>
updated: <ISO timestamp now>
---

This page has been merged into ((<canonical-doc-id> "<canonical page title>")).
```

### 5d：重写全笔记本反向链接

```bash
siyuan-sisyphus search get_backlinks --id <secondary-doc-id> --mode both --json
```

对每个反向链接源页面，`fs replace` 替换：
```bash
siyuan-sisyphus fs replace \
  --path "/<SIYUAN_NOTEBOOK_NAME>/<source-hpath>" \
  --old "[[<secondary-slug>]]" \
  --new "((<canonical-doc-id> \"<canonical title>\"))"
```

**安全规则**：
- `fs replace` 在 `--old` 不唯一时失败——用作试运行信号
- 切勿在重定向存根内部重写
- 切勿使用破坏性 shell 操作——只用 `fs replace`/`fs write --overwrite`
- 每个文件后重新运行 `get_backlinks` 确认计数递减

### 5e：更新跟踪文件

按 `shared.md` 更新：索引（移除次要页面条目，更新规范页面条目）、manifest（`"merged_into": "<canonical node_id>"`）、热缓存。

### 5f：最终检查

`get_backlinks --id <secondary-doc-id> --mode both`：仅存的反向链接应为重定向存根本身。

---

## 重定向存根处理

其他技能应如下处理重定向存根：
- **下游读取者** — 跳过 frontmatter 中有 `redirects_to:` 的页面；它们不是内容节点
- **检索** — 如果搜索命中重定向存根，跟随 `redirects_to:` 读取规范页面
- **Lint 审计** — 验证每个 `redirects_to:` 解析到现有非存根页面（`audit.md` 检查 13）
- **交叉链接** — 将重定向存根视为非目标；不要添加指向存根页面的新链接

完成后按 `shared.md` 日志格式：`LINT mode=dedup pages_scanned=N merged=X kept_separate=Y needs_review=Z`。
