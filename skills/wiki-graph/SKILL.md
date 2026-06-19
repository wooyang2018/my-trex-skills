---
name: wiki-graph
description: >
  维护思源 wiki 的知识图谱结构和元数据系统，包含四种模式：（1）去重——扫描页面级身份冲突，
  检测覆盖同一概念的不同名称页面并合并。当用户说"去重我的 wiki"、"查找重复页面"、"合并重复项"时使用。
  （2）交叉链接——自动发现页面间缺失的交叉引用。当用户说"链接我的页面"、"查找缺失链接"、
  "交叉引用"、"连接我的 wiki"时使用。（3）标签分类法——使用受控词汇表强制执行一致的标签。
  当用户说"修复我的标签"、"规范化标签"、"标签审计"、"标签分类法"时使用。（4）图谱着色——
  按类别、标签或可见性为文档着色。当用户说"给图谱上色"、"按标签着色"、"让图谱多彩"时使用。
  这是写入类技能——实际修改页面和文档属性。
---

# Wiki Graph — 去重合并 + 交叉链接 + 标签分类法 + 图谱着色

> **链接格式**（根据 `llm-wiki/SKILL.md` §15 + §13 校准说明 7）：wiki 页面之间的所有内部链接——正文文本、`## Related` 列表、`relationships:` 镜像、`redirects_to`、仪表板、任何内容——都以思源原生块引用 `((<doc-id> "display text"))` 形式发出。思源**不**解析 `[[wikilink]]` markdown；只有块引用填充 `refs` 表、反向链接索引和全局图谱视图。通过 `SELECT id, hpath FROM blocks WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>' LIMIT 5000` 一次性解析文档 id。下文某些示例中出现的遗留 `[[...]]` 表示法是同一目标的简写——实际发出文本时，写 `((id "text"))`。

你正在维护 wiki 的知识图谱结构和元数据系统。本技能整合四种互补的图谱维护操作：**去重**（合并覆盖同一概念的重复页面）、**交叉链接**（在应互相引用但当前没有的页面之间插入缺失的块引用）、**标签分类法**（规范化标签到受控词汇表）和**图谱着色**（为文档分配 `custom-color` 属性以在思源 UI 中视觉区分）。所有读写都通过 `siyuan-sisyphus` 进行。

## 分发

从用户措辞推断模式：

| 用户意图 | 模式 |
|---|---|
| "去重"、"查找重复页面"、"合并重复项" | 去重 |
| "链接我的页面"、"查找缺失链接"、"交叉引用" | 交叉链接 |
| "修复我的标签"、"规范化标签"、"标签审计"、"标签分类法" | 标签分类法 |
| "给图谱上色"、"按标签着色"、"按类别着色"、"让图谱多彩" | 图谱着色 |
| 未指定 | 交互式选择 |

**遵循 `llm-wiki/SKILL.md` 中的检索原语表。** 候选检测遍历仅使用 frontmatter 和标题（廉价）。只为确认的候选对打开完整页面正文。

## 开始之前

1. **解析配置 + 预检**——遵循 `llm-wiki/SKILL.md` 中的配置解析协议（从 CWD 向上查找 `.env` → `~/.siyuan-wiki/config` → 提示设置）。这会得到 `SIYUAN_NOTEBOOK_ID`（用于 `--notebook` 和 `query_sql ... WHERE box=`）和 `SIYUAN_NOTEBOOK_NAME`（用于 `fs *` 路径）。然后运行 `siyuan-sisyphus --version` 和 `siyuan-sisyphus notebook get-permissions --notebook "<SIYUAN_NOTEBOOK_ID>"`。**这是写入类技能——权限不是 `rwd` 则停止。** 不要静默回退到文件系统写入。
2. 读取 manifest：`siyuan-sisyphus fs read --path "/<SIYUAN_NOTEBOOK_NAME>/_meta/manifest"`。去除 ` ```json … ``` ` 围栏并解析。如果文档不存在，提示用户先运行 `wiki-setup`。
3. 读取 `/<SIYUAN_NOTEBOOK_NAME>/index`、`/<SIYUAN_NOTEBOOK_NAME>/hot` 和 `/<SIYUAN_NOTEBOOK_NAME>/_meta/taxonomy` 获取页面清单、近期活动上下文和标签词汇表。

---

## 模式一：去重 — 身份解析与页面级合并

查找并合并以不同名称覆盖同一概念的 wiki 页面。这是破坏性操作——页面合并不能自动撤销。谨慎工作，合并模式下操作前确认。

### 调用形式

| 模式 | 标志 | 行为 |
|---|---|---|
| **审计** | *（默认）* | 仅报告候选——不写入 |
| **合并** | `--merge` | 显示每个确认对，合并前询问确认 |
| **自动合并** | `--auto` | 非交互式合并所有高置信度对（`score ≥ 0.90`） |

如果用户未指定，在**审计**模式运行并呈现发现后询问是否继续。

### 步骤 D1：构建页面注册表

单次 SQL 查询拉取每个活跃文档及其元数据——无需读取页面正文：

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

> **注意**：根据 `llm-wiki/SKILL.md` §13 说明 8，`hpath NOT LIKE '/_%'` 会被思源权限层静默过滤。拉取完整列表后在客户端过滤 `not hpath.startswith('/_')`。

对每行，解析 `ial` 列提取：`node_id`（文档 id——作为稳定键， survives 重命名）、`hpath`（仅显示用）、`title`、`aliases`（按 `|` 分割）、`tags`（按 `,` 分割）、`category`（hpath 首段）、`summary`。

跳过 `custom-redirects-to` 非空的行——那些是已合并的重定向存根。

### 步骤 D2：检测候选对

对注册表中的每对页面，计算**相似度得分**：

**标题相似度信号：**

| 信号 | 评估方式 | 最大贡献 |
|---|---|---|
| **词元重叠** | 小写标题词元 Jaccard 相似度 | 0.65 |
| **编辑距离** | 归一化编辑距离：`1 - (edits / max(len_a, len_b))` | 0.40 |
| **子串包含** | 一个标题是另一个的子串 | 0.50 |
| **别名交叉匹配** | 页面 A 的标题出现在页面 B 的 `aliases` 中，反之亦然 | 0.65 |

**语义信号（廉价遍历）：**

| 信号 | 分值 |
|---|---|
| 同 `category` 目录 | +0.10 |
| 标签重叠 ≥ 3 个共享 | +0.15 |
| 标签重叠 ≥ 2 个共享 | +0.05 |
| 相同首标签 | +0.05 |

**阈值：** 复合得分 ≥ **0.75** 为候选，≥ **0.90** 为高置信度。

| 得分 | 标签 |
|---|---|
| ≥ 0.90 | 高——几乎确定是同一概念 |
| 0.75–0.89 | 中——可能是，需验证 |
| 0.60–0.74 | 低——可能的缩写或特化；除非用户要求否则跳过 |

**快速退出规则：** 笔记本 < 10 个页面时跳过对循环。> 500 个页面时分批 50 对处理。

### 步骤 D3：语义裁决

对每个候选对（按得分降序）：

1. 完整读取两个页面（全文读取——候选池小，合理）。
2. 判断：这些页面覆盖**同一概念**，还是不同概念？

三种裁决：

| 裁决 | 含义 |
|---|---|
| `merge` | 同一概念——不同名称、缩写、别名或意外重复。安全合并。 |
| `keep-separate` | 相关但不同——如"Server Actions"与"Server Components"是相关的 React 功能，非重复。 |
| `needs-review` | 模糊——大量重叠但也有有意义差异。标记给用户决定。 |

### 步骤 D4：审计报告

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
| 0.78 | `concepts/agents` | `concepts/autonomous-agents` | 大量重叠但"agents"可能有意更宽泛 |

### 摘要
- 扫描页面：N
- 发现候选对：M
- 建议合并：X
- 保持独立：Y
- 需审查：Z
```

### 步骤 D5：合并

对每个 `merge` 裁决对（合并或自动合并模式）：

**5a：选择规范页面**——按顺序应用决胜规则：
1. **更多入站链接**——`get_backlinks` 计数高者胜出
2. **内容更丰富**——正文更长（行数更多）胜出
3. **来源更多**——`sources:` 列表更大者胜出
4. **标题更长**——更具描述性的标题胜出
5. **字母序**——更早的标题胜出

规范页面是**幸存者**。另一页面成为**次要页面**（被合并，然后替换为重定向存根）。

**5b：合并内容到规范页面**——读取两个页面，更新规范页面：
- `aliases:`——添加次要页面的标题和所有别名（去重）
- `tags:`——合并两个标签列表（去重，上限 5 个领域标签 + 系统标签）
- `sources:`——合并两个来源列表（去重）
- `relationships:`——合并（按目标去重，优先有类型的条目）
- `base_confidence`——使用来源并集重新计算
- `updated`——设为当前时间
- `summary:`——如果次要页面带来新内容则重写
- **正文内容**——整合次要页面的独特部分和要点。不要盲目追加——整合内容。使用 `^[inferred]` 标记需要综合的地方。
- `provenance:`——合并后重新计算

**5c：写入重定向存根**——在次要页面路径：

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

**5d：重写全笔记本 wikilinks**——从反向链接索引获取需要编辑的页面列表：

```
siyuan-sisyphus search get_backlinks --id <secondary-doc-id> --mode both --json
```

对每个反向链接源页面，使用 `fs replace` 进行精确替换：

```
siyuan-sisyphus fs replace \
  --path "/<SIYUAN_NOTEBOOK_NAME>/<source-hpath>" \
  --old "[[<secondary-slug>]]" \
  --new "((<canonical-doc-id> \"<canonical title>\"))"
```

**安全规则：**
- `fs replace` 在 `--old` 字符串不唯一时大声失败——用作试运行信号。
- 切勿在重定向存根内部重写。
- 切勿使用破坏性 shell 操作——只用 `fs replace` / `fs write --overwrite`。
- 每个文件后重新运行 `get_backlinks` 确认计数递减。

**5e：更新跟踪文件**——
- `/<notebook>/index`——移除次要页面条目，更新规范页面条目。
- `/<notebook>/_meta/manifest`——对次要页面的来源条目添加 `"merged_into": "<canonical node_id>"`。
- `/<notebook>/hot`——更新近期活动。

**5f：最终检查**——运行 `get_backlinks --id <secondary-doc-id> --mode both`。仅存的反向链接应为重定向存根本身。

### 重定向存根处理

其他技能应如下处理重定向存根：
- **下游读取者**——跳过 frontmatter 中有 `redirects_to:` 的页面；它们不是内容节点。
- **`wiki-retrieval`**——如果搜索命中重定向存根，跟随 `redirects_to:` 读取规范页面。
- **`wiki-lint`**——验证每个 `redirects_to:` 解析到现有非存根页面。
- **交叉链接**——将重定向存根视为非目标；不要添加指向存根页面的新链接。

---

## 模式二：交叉链接 — 自动化交叉引用

通过在应互相引用但当前没有的页面之间插入**思源原生块引用**来收紧 wiki 的知识图谱。

**关键语法说明：** 思源**不**解析 `[[wikilink]]` markdown。唯一能产生真实图谱边的语法是块引用 `((<doc-id> "display text"))`。本技能专门发出此形式。

### 步骤 C1：构建页面注册表

拉取每个 wiki 页面的 `(id, hpath, name)` 三元组——这是你的"词汇表"：

```
siyuan-sisyphus search query_sql --stmt "
  SELECT id, hpath, name FROM blocks
  WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>'
  LIMIT 5000
"
```

> **不要**在 SQL 中添加 `AND hpath NOT LIKE '/_%'`——会被权限层静默过滤。在客户端过滤。

对每行通过 `block get-attrs --id <doc-id>` 附加 `custom-title`、`custom-aliases`、`custom-tags`、`custom-category`、`custom-tier`。缓存结果供运行期间使用。

构建查找表：`hpath → { doc_id, name, title, aliases, tags, category, tier }`。

**ALIAS_MAP——手动覆盖层：** 维护内存中的 `ALIAS_MAP`（`{phrase: hpath}`），用于需要不在 `name` 或 `aliases` 中的表面形式的链接目标。持久化有前景的条目到 `_meta/manifest._meta.cross_linker.alias_map` 供下次运行种子化。ALIAS_MAP 条目优先于名称/标题匹配。保持映射小（< 50 条目）。

### 步骤 C2：扫描缺失链接

对注册表中的每个页面（或增量模式下仅上次运行后更新的页面）：

1. **读取页面正文**——`fs read --path "/<SIYUAN_NOTEBOOK_NAME>/<hpath>"`。
2. **遮蔽非散文区域**——围栏代码块、行内代码、现有块引用、YAML frontmatter。
3. **提取现有出站引用集**——这些 doc id 不应从此页面重新链接。
4. **未链接提及的廉价测试**——对每个候选目标（跳过自身和已链接的），检查 `name`、`title`、`aliases` 中是否有任何字符串出现在遮蔽的正文中。
5. **标签/类别候选**——找到共享 ≥ 2 标签的其他页面，以及相邻类别层中的页面。

**匹配规则：**
- 大小写不敏感匹配。
- 变音符号不敏感匹配——Unicode NFKD 归一化。
- 跳过自引用。
- 跳过 < 4 字符的常见词或在停用词表中的词。
- 不要双重链接——目标已在现有块引用集中则跳过。
- 从右到左应用替换——按起始偏移降序排列。
- 每页上限 8–10 个链接。

### 步骤 C3：评分和排名建议

| 信号 | 分值 | 示例 |
|---|---|---|
| **精确名称/标题/别名匹配** | +4 | "git-ai技术全景"出现在正文中 |
| **ALIAS_MAP 覆盖命中** | +4 | "记忆系统"映射到特定页面 |
| **共享标签（2+）** | +2 | 都标记为 `ai, agent` 但无链接 |
| **同项目，无链接** | +2 | 都在 `/projects/my-project/` 下 |
| **跨类别连接** | +2 | 源在 `/concepts/`，目标在 `/entities/` |
| **外围→枢纽** | +2 | 源 ≤ 2 出站，目标 ≥ 8 入站 |
| **部分名称匹配** | +1 | "graph"出现但页面是 `knowledge-graphs` |

| 得分 | 标签 | 操作 |
|---|---|---|
| ≥ 6 | **提取** | 内联应用 |
| 3–5 | **推断** | 内联或 Related 部分应用 |
| 1–2 | **歧义** | 跳过 |

### 步骤 C4：应用链接

在内存中构建合并正文，然后每页一次 `fs write --overwrite` 写回。

**4a：内联链接（首选）**——找到术语在正文中首次自然提及并包裹块引用：

```markdown
This project uses ((20260525220651-4ptqo4v "knowledge graphs")) to connect entities.
```

**4b：Related 部分（回退）**——如果术语未被自然提及但页面语义相关，在底部添加 `## Related` 部分：

```markdown
## Related

- ((20260525220644-9rpxnqo "git-ai 技术全景")) — Also covers AI-driven development workflows
- ((20260525220651-4ptqo4v "knowledge graphs")) — Core technique used here
```

**4c：推断并写入关系类型**——对每个提取或推断的链接，从周围句子推断语义关系类型并写入 `custom-relationships`：

| 句子模式 | 推断类型 |
|---|---|
| "X extends / builds on Y" | `extends` |
| "X implements Y" | `implements` |
| "X contradicts / opposes Y" | `contradicts` |
| "X is derived from Y" | `derived_from` |
| "X uses / relies on Y" | `uses` |
| "X replaces / supersedes Y" | `replaces` |
| 共享标签或跨类别，无方向线索 | `related_to` |

```
siyuan-sisyphus block set-attrs \
  --id <doc-id> \
  --attrs '{"custom-relationships":"<compact-json>","custom-updated":"<TIMESTAMP>"}'
```

### 步骤 C5：评分 Misc 页面亲和力

对 `/misc/` 中的每个页面（或 `custom-promotion-status=misc`）：

1. 收集出站块引用和入站反向链接。
2. 按项目分组链接的页面。
3. 更新 `custom-affinity`：`{"custom-affinity":"siyuan-wiki:3,another-project:1"}`。
4. 项目得分 ≥ 3 → 标记为**提升候选**。

### 步骤 C6：报告

```markdown
## 交叉链接报告

### 已添加链接：23 个，跨 12 个页面（每页上限=10）

| 页面 | 添加链接数 | 置信度 | 放置位置 | 关系类型 |
|---|---|---|---|---|
| `/synthesis/git-ai技术全景` | 4 | 提取 | 内联 | uses ×3, related_to ×1 |
| `/references/git-svn知识全面介绍` | 3 | 提取 | 内联 | derived_from ×1, uses ×2 |

### refs 表中的边：40
### 剩余孤立页面：2
### Misc 提升候选：N
### 跳过的页面：3
```

通过 `refs` 表直接验证边计数（始终带 `box=`）：

```
siyuan-sisyphus search query_sql --stmt "
  SELECT def_block_id, block_id, root_id FROM refs
  WHERE box='<SIYUAN_NOTEBOOK_ID>'
  LIMIT 1000
"
```

`COUNT(*)` 被过滤，拉取行在客户端计数。

---

## 更新跟踪文件（两种模式共用）

所有操作完成后：

**日志**——通过 `block append` 追加一行：
```
siyuan-sisyphus block append --parent-id <log-doc-id> --data-type markdown \
  --data "- [<TIMESTAMP>] GRAPH mode=dedup|crosslink|tag-audit|tag-normalize|colorize pages_scanned=N merged=X links_added=M tags_normalized=T docs_colored=C errors=K"
```

**热缓存**——更新 `/<notebook>/hot` 的近期活动。

**Manifest**——对去重：更新来源条目的 `merged_into`；对交叉链接：持久化 `_meta.cross_linker.{last_run, alias_map}`。

**索引**——从新鲜注册表查询重建 `/<notebook>/index`。

将 manifest 写入推迟到页面、索引、日志和热缓存都成功写入之后——写入中途崩溃不会留下 manifest 声称不存在的页面。

## 页面写入模式

本技能中的每次页面写入使用 `llm-wiki/SKILL.md` §4-§5 中记录的**两次调用模式**：
1. `fs write --path … --markdown "<仅正文——无 YAML frontmatter，无前导 # H1>" --overwrite`
2. `document lookup → block set-attrs` 将 frontmatter 镜像到自定义属性

多行 markdown 正文必须通过 `fs write --overwrite`——`block update` 会截断多段内容。

## 提示

- **先审计，始终。** 即使在自动合并模式下也显示审计报告。
- **缩写是最常见的情况。** "GPT" / "GPT-4" / "GPT4"——子串包含得分高，几乎总是安全合并。
- **不同版本不是重复。** "GPT-3"和"GPT-4"相关但不同。
- **去重后运行交叉链接。** 重定向存根使图谱处于轻微不一致状态。交叉链接会收紧它。
- **每次摄取后运行交叉链接。** 新页面几乎总是连接不良。
- **保守使用内联链接。** 只链接首次自然提及。
- **不要触碰 `/_archives/`、`/_staging/`、`/_raw/`、`/_meta/`。** 在完整注册表拉取后客户端过滤。
- **实体页面是链接磁铁。** 用外围→枢纽加分积极评分。
- **索引是最终一致的。** `fs write` 后，优先用 `search get_backlinks` 和 `refs` 表而非 `fulltext` 进行边验证。

---

## 模式三：标签分类法 — 受控词汇表

使用受控词汇表强制执行一致的标签。**始终在分配标签前读取分类法文件**——它是真相来源。

### 分类法文件

规范标签词汇表位于 `/<SIYUAN_NOTEBOOK_NAME>/_meta/taxonomy.md`。它定义：
- **规范标签**——应使用的标签
- **别名**——应映射到规范形式的常见替代
- **规则**——每页最多 5 个标签，小写/连字符化，优先宽泛而非狭窄
- **迁移指南**——已知不一致的特定重命名

### 保留系统标签

`visibility/` 是具有特殊规则的保留标签组：

| 标签 | 用途 |
|---|---|
| `visibility/public` | 明确公开 |
| `visibility/internal` | 仅团队——在过滤查询/导出模式中排除 |
| `visibility/pii` | 敏感数据——在过滤查询/导出模式中排除 |

`visibility/` 标签规则：不计入 5 标签限制；每页最多一个；内容明显公开时完全省略；规范化时保持不变。

### 标签审计

1. 单次 SQL 查询拉取每个文档及其 `custom-tags`。客户端过滤 `/_` 前缀子树。
2. 构建标签频率表。标记：未知标签（不在分类法中）、别名标签（使用别名而非规范形式）、过度标记页面（>5 标签）、未标记页面。
3. 报告：摘要 + 非规范标签表 + 未知标签表 + 过度标记页面表。

### 标签规范化

1. 运行审计。
2. 对每个有非规范标签的页面：将别名替换为规范形式，如果 >5 标签则建议删除哪些，写入更新后的 frontmatter 和自定义属性。
3. 处理未知标签：2+ 页面使用 → 建议添加到分类法；1 页面使用 → 建议替换。修改前询问用户。

### 为新页面选择标签

1. 读取分类法。
2. 选择最多 5 个标签：1-2 个领域标签 + 1 个类型标签 + 0-1 个项目标签 + 0-1 个额外描述性标签。
3. 只使用规范标签。如无合适标签，检查是否值得添加到分类法。

### 添加新标签

1. 检查现有标签是否已覆盖该概念。
2. 如果确实是新的，确定属于哪个部分，添加到 `_meta/taxonomy.md`。

---

## 模式四：图谱着色 — 按标签、类别或可见性着色文档

批量写入 `custom-color`（及可选的 `custom-icon`）属性到 wiki 文档，使思源 UI 表面——图谱视图、文件树、反向链接面板——视觉区分它们。

**思源 vs Obsidian 模型：** 思源中每个文档携带自己的 `custom-color` 属性，没有中央颜色规则文件。此技能计算每个文档的颜色并通过 `block set-attrs` 写入。

**运行前重申影响。** 典型运行触及笔记本下的每个文档。

### 着色步骤

1. **选择模式**：`by-tag`（默认）、`by-category`、`by-visibility`、`combined`（可见性覆盖标签）、`custom`（用户提供映射）、`clear`（移除颜色）。

2. **构建文档注册表**——单次 SQL 查询拉取每个文档及其 `ial`。客户端过滤 `/_` 前缀和系统文档。解析 `custom-tags`、`custom-category`、`custom-redirects-to`。

3. **选择颜色**——使用 10 种色盲友好调色板：

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

   - `by-tag`：取前 10 标签，按排名分配调色板颜色。每个文档按其排名最高的标签着色。
   - `by-category`：使用固定类别→颜色映射（concepts=蓝, entities=橙, skills=红, references=青, synthesis=绿, projects=黄, journal=紫）。
   - `by-visibility`：pii→红, internal→橙, public→绿。无 visibility 标签的文档不着色。
   - `combined`：先应用 by-visibility；未匹配的回退到 by-tag。
   - `clear`：写入空字符串移除 `custom-color`。

4. **应用颜色**——对每个 `(doc_id, hex_color)` 对通过 `block set-attrs` 写入。幂等：跳过已匹配的。每 50 个一批打印进度。

5. **报告**——模式、扫描数、着色数、跳过数、错误数。
