---
name: wiki-synthesis
description: >
  在思源 wiki 中生成综合性知识，包含两种模式：（1）内部综合——系统发现跨页面频繁
  共现但无综合页面连接的概念对/簇，创建新的 synthesis/ 页面来连接它们。当用户说
  "综合我的 wiki"、"发现连接"、"哪些概念总是一起出现"、"/wiki-synthesize"，或
  在大规模摄取后笔记本显著增长时使用。（2）外部研究——通过多轮网络搜索自主研究一个
  主题，综合发现，并将结构化结果归档到 wiki 中。当用户说"研究 X"、"查找关于 Y 的
  一切"、"深入 Z"、"自主研究 X"，或想要全面的、有网络来源的知识直接归档到 wiki 时使用。
---

# Wiki Synthesis — 内部综合发现 + 自主研究

> **链接格式**（根据 `llm-wiki/SKILL.md` §15 + §13 校准说明 7）：wiki 页面之间的所有内部链接——正文文本、`## Related` 列表、`relationships:` 镜像、`redirects_to`、仪表板、任何内容——都以思源原生块引用 `((<doc-id> "display text"))` 形式发出。思源**不**解析 `[[wikilink]]` markdown；只有块引用填充 `refs` 表、反向链接索引和全局图谱视图。通过 `SELECT id, hpath FROM blocks WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>' LIMIT 5000` 一次性解析文档 id。下文某些示例中出现的遗留 `[[...]]` 表示法是同一目标的简写——实际发出文本时，写 `((id "text"))`。

你正在为 wiki 生成综合性知识。本技能整合两种互补的综合功能：**内部综合**（发现并填充 wiki 内部概念间的综合缺口）和**外部研究**（通过多轮网络搜索研究新主题并归档到 wiki）。所有读写都通过 `siyuan-sisyphus` 进行。

## 开始之前

1. **解析配置 + 预检**——遵循 `llm-wiki/SKILL.md` 中的配置解析协议（从 CWD 向上查找 `.env` → `~/.siyuan-wiki/config` → 提示设置）。这会得到 `SIYUAN_NOTEBOOK_ID`（用于 `--notebook` 和 `query_sql ... WHERE box=`）和 `SIYUAN_NOTEBOOK_NAME`（用于 `fs *` 路径）。
2. 运行 `siyuan-sisyphus --version` 和 `siyuan-sisyphus notebook get-permissions --notebook "<SIYUAN_NOTEBOOK_ID>"`。**这是写入类技能——权限不是 `rwd` 则停止。** 不要静默回退到文件系统写入。
3. 读取 manifest：`siyuan-sisyphus fs read --path "/<SIYUAN_NOTEBOOK_NAME>/_meta/manifest"`。去除 ` ```json … ``` ` 围栏并解析。如果文档不存在，提示用户先运行 `wiki-setup`。
4. 读取 `/<SIYUAN_NOTEBOOK_NAME>/index` 和 `/<SIYUAN_NOTEBOOK_NAME>/hot` 获取页面清单和近期活动上下文。

---

## 模式一：内部综合 — 发现综合机会

扫描 wiki 中频繁共现但无专门综合页面连接的概念。你的工作是浮现这些缺口并用跨切面综合页面填充最有价值的那些。

### 步骤 S1：构建共现图

扫描笔记本中的每个非特殊页面（跳过 `index`、`log`、`hot`、`_insights`、`_meta/*`、`_archives/*`、`_raw/*`）。对每个页面，收集所有出站链接、`tags`、`category`。

构建共现矩阵：对每对概念/实体页面 (A, B)，计数有多少其他页面同时链接到 A 和 B。这是它们的共现得分。

使用服务器维护的反向链接索引而非正文 grep：

```
# 对每个候选概念页面，获取所有链接到它的页面
DOC_ID=$(siyuan-sisyphus document lookup --notebook "<SIYUAN_NOTEBOOK_ID>" --hpath "/concepts/<concept-slug>" --json | jq -r '.idPath.path' | awk -F/ '{print $NF}' | sed -E 's|\.sy$||')
siyuan-sisyphus search get_backlinks --id "$DOC_ID" --mode both --json
```

对结果页面 id 集取交集，找到同时链接到候选对中两个概念的页面。这是每个概念 `O(deg)` 而非全笔记本扫描。

### 步骤 S2：过滤已综合的对

检查 `synthesis/` 目录中的现有页面。对每个现有综合页面，读取其 `sources` frontmatter 或正文中的链接，标记已覆盖的概念对。从候选列表中移除已覆盖的对。

### 步骤 S3：评分和排名候选

对每个剩余候选对（或 3+ 簇），分配综合价值得分：

| 信号 | 分值 |
|---|---|
| 共现计数 ≥ 5 | +3 |
| 共现计数 3-4 | +2 |
| 共现计数 1-2 | +1 |
| 概念在不同类别中（跨领域） | +2 |
| 概念共享标签但在不同文件夹 | +1 |
| 一个或两个概念在 `_insights.md` 中标记为枢纽 | +1 |
| 综合将解决标记的矛盾 | +2 |

取前 5 个候选。如果用户要求特定主题，先过滤候选到该领域。

### 步骤 S4：起草综合页面

对每个顶级候选，使用以下模板在 `synthesis/` 中创建页面：

```markdown
---
title: <概念 A> × <概念 B>
category: synthesis
tags: [<共享标签>, <领域标签>]
sources: [<所有同时链接到两者的页面>]
created: TIMESTAMP
updated: TIMESTAMP
summary: "关于 <A> 和 <B> 如何交互的跨切面综合，对 <领域> 的影响。"
provenance:
  extracted: 0.2
  inferred: 0.7
  ambiguous: 0.1
base_confidence: <min(所有输入页面的 base_confidence)>
lifecycle: draft
lifecycle_changed: TIMESTAMP_DATE
---

# <概念 A> × <概念 B>

## 连接

*什么使这两个概念值得一起综合——非显而易见的关系。*

## 共现场景

*两者同时出现的页面和上下文。什么情况把它们带到一起。*

## 跨切面洞察

*只有同时看两者才能看到的结论。这是页面的核心——从任一概念页面单独看不到的东西。*

## 张力与权衡

*两个概念拉向相反方向的地方。未解决的矛盾。应用一个削弱另一个的情况。*

## 待解问题

*综合浮现出 wiki 尚未有答案的问题。未来研究的良好候选。*

## Related

- ((<doc-id> "<概念 A>"))
- ((<doc-id> "<概念 B>"))
```

**综合页面主要是 `^[inferred]`。** 你在跨来源绘制连接——这本身就是综合。对跨切面结论应用 `^[inferred]`，对来源不一致处应用 `^[ambiguous]`。

**标题格式为 `A × B`**——向读者表明这是综合页面，而非任一概念单独的页面。

### 步骤 S5：从源页面反向链接

对每个创建的综合页面，从其综合的概念页面添加指向它的链接。在概念页面的 `## Related` 部分添加。如果无 `## Related` 部分，在底部添加一个。

### 步骤 S6：报告未采取的综合机会

创建前 5 个页面后，在输出中列出接下来的 10 个候选——得分良好但未写页面的对。

```
跳过（下次考虑）：
- [[缓存]] × [[一致性]] — 在 4 个页面中共现，跨领域
- [[测试]] × [[可观测性]] — 在 3 个页面中共现，共享标签
```

---

## 模式二：外部研究 — 自主多轮研究

对一个主题运行自主研究循环，综合发现，并将结果归档到 wiki 中作为永久知识。

### 研究配置（可选）

如果笔记本中存在 `references/research-config.md`，读取并应用其定义的规则（来源偏好、跳过域名、置信度评分调整、主题特定约束）。不存在则使用默认值。

### 第一轮 — 广泛调查

**目标：** 获取主题的广泛地图。

1. 将主题分解为 **3-5 个不同角度**（如"向量数据库"：是什么、何时使用、主要实现、权衡、生产陷阱）
2. 对每个角度，用不同措辞运行 **2-3 次网络搜索**
3. 对每个角度的前 2-3 个结果，获取内容
4. 从每个获取的页面提取：
   - **关键论断**——来源明确陈述的内容
   - **概念**——引入的想法、术语、框架
   - **实体**——提到的工具、人物、组织
   - **矛盾**——来源相互不一致的地方

### 第二轮 — 缺口填补

**目标：** 补上第一轮留下的缺口。

审查第一轮的产出：哪些问题来源提出但未回答？哪里来源相互矛盾？哪些角度覆盖薄弱？

运行 **最多 5 次定向搜索** 专门针对这些缺口。优先原始来源、官方文档和权威分析而非链接聚合器。

### 第三轮 — 综合检查

**目标：** 解决矛盾；确认深度足够。

如果主要矛盾仍未解决，运行最后一次定向搜索（2-3 次）寻找权威解决方案。如果无法解决，在综合页面中明确标记矛盾。

**停止条件：** 深度已达到或完成 3 轮时停止——不要无限循环。

### 归档 — 写入 Wiki 页面

将所有发现组织到四个输出区域的 wiki 页面中：

**1. sources/ — 每个主要引用一个页面**

```yaml
---
title: >-
  <来源标题>
category: references
tags: [<2-4 个领域标签>]
sources:
  - "<URL>"
source_url: "<URL>"
created: <ISO-8601>
updated: <ISO-8601>
summary: >-
  <1-2 句描述此来源覆盖内容>
provenance:
  extracted: 0.X
  inferred: 0.X
  ambiguous: 0.X
base_confidence: <0.17 + 0.5 × classify(url) 对于单个来源>
lifecycle: draft
lifecycle_changed: <ISO date today>
---
```

正文：标题、URL、覆盖内容、关键论断（带 provenance 标记）、局限性。

**2. concepts/ — 每个实质概念一个页面**

对跨来源发现的每个重要概念，创建标准概念页面。概念之间互相链接，并链接到来源页面。

**3. entities/ — 工具、组织、人物**

对遇到的每个重要实体，创建标准实体页面。链接回使用该实体的概念和出现的来源。

**4. synthesis/Research: [Topic] — 主综合**

```yaml
---
title: >-
  Research: <主题>
category: synthesis
tags: [<3-5 个领域标签>, research]
sources: [<来源 URL 或页面路径列表>]
created: <ISO-8601>
updated: <ISO-8601>
summary: >-
  对 <主题> 的 N 轮研究综合。覆盖 <核心发现>。
provenance:
  extracted: 0.X
  inferred: 0.X
  ambiguous: 0.X
base_confidence: <min(N_unique_sources/3,1.0)×0.5 + avg_source_quality×0.5>
lifecycle: draft
lifecycle_changed: <ISO date today>
---

# Research: <主题>

## 概述
<2-4 句执行摘要>

## 关键发现
<带 [[来源页面]] 引用的最重要论断列表>

## 核心概念
<到已创建概念页面的链接，附一行描述>

## 实体与工具
<到实体页面的链接，附一行描述>

## 矛盾与待解问题
<来源不一致或研究触及极限的地方>

## 参考来源
<所有来源页面的链接列表>
```

### 交叉链接

归档所有页面后：
- 每个概念页面应链接到至少 2 个来源页面
- 每个来源页面应链接到它提供的概念页面
- 综合页面应链接到所有已产出的概念、实体和来源页面

检查 `/<notebook>/index` 是否已有同主题页面——合并到现有页面而非创建重复。

---

## 页面写入模式

本技能中的每次页面写入使用 `llm-wiki/SKILL.md` §4-§5 中记录的**两次调用模式**：

```
# 1. 整页写入（父文档必须存在；fs write 不自动创建缺失的父文档）
siyuan-sisyphus fs write \
  --path "/<SIYUAN_NOTEBOOK_NAME>/<category>/<slug>" \
  --markdown "<仅正文——无 YAML frontmatter，无前导 # H1>" \
  --overwrite

# 2. 查找 doc id，将 frontmatter 镜像到 custom-* 属性
DOC_ID=$(siyuan-sisyphus document lookup \
  --notebook "<SIYUAN_NOTEBOOK_ID>" \
  --hpath "/<category>/<slug>" \
  --json | jq -r '.idPath.path' | awk -F/ '{print $NF}' | sed -E 's|\.sy$||')
siyuan-sisyphus block set-attrs \
  --id "$DOC_ID" \
  --attrs '{"custom-title":"…","custom-category":"…","custom-tags":"a,b,c","custom-summary":"…","custom-base-confidence":"0.42","custom-lifecycle":"draft","custom-tier":"supporting","custom-updated":"…"}'
```

多行 markdown 正文必须通过 `fs write --overwrite`——`block update` 会截断多段内容。

## 更新跟踪文件

将 manifest 写入推迟到页面、索引、日志和热缓存都成功写入之后。

**Manifest**：
- 内部综合：更新来源条目和页面创建/更新列表
- 外部研究：添加 `research` 条目：
```json
{
  "type": "research",
  "topic": "<主题>",
  "researched_at": "TIMESTAMP",
  "rounds_completed": 3,
  "sources_fetched": N,
  "pages_created": ["..."],
  "pages_updated": ["..."]
}
```

**日志**：
```
# 内部综合
- [TIMESTAMP] WIKI_SYNTHESIZE pages_scanned=N synthesis_created=M candidates_skipped=K

# 外部研究
- [TIMESTAMP] WIKI_RESEARCH topic="<主题>" rounds=N sources_fetched=N pages_created=M
```

**索引**——添加所有新页面到各自部分。

**热缓存**——更新近期活动。内部综合：记录综合了什么；外部研究：记录研究主题和核心发现。更新待解线索。

## 质量检查清单

- [ ] 每个综合页面有 `summary:` 字段（≤200 字符）
- [ ] 每个综合页面链接回其源概念
- [ ] 源概念页面正向链接到综合页面
- [ ] 综合页面不只是重述源页面内容——必须添加跨切面洞察
- [ ] 外部研究：3 轮完成（或在足够深度时停止）
- [ ] 外部研究：矛盾在综合页面中标记
- [ ] 所有页面交叉链接
- [ ] `index`、`log`、`hot`、`manifest` 更新

## 提示

- **只总结来源的综合页面是无用的。** 价值在于连接——任一源页面都未明确说的东西。
- **不要为综合而综合。** 如果两个概念只是碰巧经常一起出现而无真正的概念联系，跳过它们。
- **三方综合强大但罕见。** 只有当三个概念形成真正的相互影响三角时才创建。
- **先检查 `_insights.md`。** `wiki-maintenance` 技能可能已经标记了综合候选——先从那些开始再从头运行共现扫描。
