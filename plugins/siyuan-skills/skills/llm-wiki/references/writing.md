# Writing

Use this before writing or restructuring wiki pages.

## Page sizes

| Type | Target |
|---|---|
| concept | 600-2000 words (core 400-800, depth 200-1200) |
| reference | 150-400 words |
| synthesis | 600-1500 words |
| comparison | 400-1000 words |
| contradiction | 150-400 words |
| project overview | 200-600 words |

Split a concept when it would exceed about 2000 words or when several sections deserve independent links. Create `concepts/<topic>` as the overview page, then focused child pages under it.

## Key rule: no body frontmatter or `# Title`

SiYuan auto-generates a frontmatter block and `# Title` heading for every document. Adding a second YAML frontmatter or `# Title` in the body causes duplicate rendering — the second frontmatter appears as raw text.

**Correct**: Start body content directly with the one-sentence definition. Audit documents also follow this rule — all metadata is stored in custom-* attrs.

## Templates

### Concept

`concepts/` 涵盖抽象概念和具体命名对象。模板分为**核心段**（AI 草拟时自动生成）和**深入段**（人工补充为主，面试关键）。模板中的中间段按主题灵活调整——抽象概念侧重 How It Works 和 Why This Way，具体对象侧重 Overview 和 Key Characteristics。被多处引用的具体对象自然成为图枢纽。

**核心段**（必填，AI 草拟）：定义、How It Works、Examples、Related、Sources
**深入段**（面试关键，人工补充为主）：In My Own Words、Why This Way、When to Use / When Not、Common Pitfalls、Interview Questions、Practice Ideas
**闪卡段**（AI 生成，自动注册）：Flashcards — 4 种题型的闪卡（L1 填空/L2 问答/L3 单选/L4 多选），注册到思源闪卡系统，复习表现自动派生 `custom-depth`

深入段是面试加分的关键。AI 草拟时可以预填能推断的内容（如从来源提取的 Examples、Common Pitfalls），但 `## In My Own Words` 和 `## Interview Questions` 必须人工填写——前者是费曼复述验证理解，后者是面试追问的预案。深入段留空不影响页面创建，但 lint 会报告"深入段缺失"提醒你回头补充。`## Flashcards` 段由 AI 生成，不需要人工填写——它是深度衡量的客观依据。

抽象概念模板：

```markdown
One-sentence definition.

## In My Own Words

> [!NOTE]
> 费曼复述：不背定义，用自己的话解释。如果解释不清楚，说明还没真正理解。必须人工填写。

## How It Works

> [!NOTE]
> 原理和机制。底层是怎么实现的。

## Why This Way

> [!NOTE]
> 设计动机：为什么是这样设计而不是另一种方式。历史背景、解决什么问题、放弃了哪些替代方案。面试官最看重这一段。

## Examples

> [!NOTE]
> 最小可运行代码示例或具体场景。

## When to Use / When Not

> [!NOTE]
> 适用场景和不适用场景。

## Tradeoffs

> [!NOTE]
> 优缺点。选择这个的代价是什么。

## Common Pitfalls

> [!NOTE]
> 常见误区、陷阱、踩坑经验。

## Interview Questions

> [!NOTE]
> 面试官可能追问的问题，以及你的思考方向。不需要完整答案，但要知道怎么切入。必须人工填写。

## Practice Ideas

> [!NOTE]
> 如何练习这个知识点。小项目、练习题、实际应用方向。

## Flashcards

> [!NOTE]
> AI 生成 4 种题型的闪卡，注册到思源闪卡系统。L1 填空题（段落 `==mark==` 挖空核心术语，custom-card-type=cloze）；L2 问答题（超级块 `{{{row}}}`，首子块=问题、其余=答案，custom-card-type=qa）；L3 单选题（嵌套超级块，正面=题干+选项、背面=答案+解析，custom-card-type=single-choice）；L4 多选题（嵌套超级块，正面=题干+任务列表、背面=答案+解析，custom-card-type=multi-choice）。复习表现自动决定 custom-depth，不需要自己判断理解深度。

L1（定义，custom-card-type=cloze）==X== 是 <一句话定义>，核心特征包括 ==特征1==、==特征2==。

{{{row
L2（原理，custom-card-type=qa）X 是如何工作的？什么场景适合用，什么场景不适合？

<简明原理与适用/不适用场景，1-2 句>
}}}

{{{row
{{{row
L3（动机，custom-card-type=single-choice）关于 X 的设计动机，以下哪项是正确的？

- A. <正确选项>
- B. <干扰项>
- C. <干扰项>
- D. <干扰项>
}}}

答案：A。<解析：关键设计动机与被放弃的替代方案，1-2 句>
}}}

{{{row
{{{row
L4（实战，custom-card-type=multi-choice）以下哪些是使用 X 时的常见陷阱？

- [ ] <陷阱 1>
- [ ] <非陷阱干扰项>
- [ ] <陷阱 2>
- [ ] <陷阱 3>
}}}

答案：<正确选项>。

解析：<每条陷阱的简要说明，1-3 句>
}}}

## Related

**前置依赖**（学这个之前应该先懂）：

- ((<doc-id> 'Prerequisite Page')) — 为什么需要先懂

**延伸学习**（学这个之后可以深入）：

- ((<doc-id> 'Extension Page')) — 延伸方向

## Sources

#tag-a# #tag-b#
```

具体命名对象模板（工具、人物、组织、技术）：

```markdown
One-sentence description in this wiki's scope.

## In My Own Words

> [!NOTE]
> 费曼复述：用自己的话描述这个东西是什么、为什么重要。必须人工填写。

## Overview

## Key Characteristics

## Why It Matters

> [!NOTE]
> 为什么这个东西重要，它解决了什么问题。

## Common Use Cases

## Alternatives

> [!NOTE]
> 替代方案和对比。

## Common Pitfalls

## Interview Questions

> [!NOTE]
> 面试可能问到的问题。必须人工填写。

## Practice Ideas

> [!NOTE]
> 如何通过实践加深理解。

## Flashcards

> [!NOTE]
> AI 生成 4 种题型的闪卡，注册到思源闪卡系统。L1 填空题（段落 `==mark==` 挖空核心术语，custom-card-type=cloze）；L2 问答题（超级块 `{{{row}}}`，首子块=问题、其余=答案，custom-card-type=qa）；L3 单选题（嵌套超级块，正面=题干+选项、背面=答案+解析，custom-card-type=single-choice）；L4 多选题（嵌套超级块，正面=题干+任务列表、背面=答案+解析，custom-card-type=multi-choice）。复习表现自动决定 custom-depth。

L1（定义，custom-card-type=cloze）==X== 是 <一句话描述>，核心特征包括 ==特征1==、==特征2==。

{{{row
L2（原理，custom-card-type=qa）X 如何解决它解决的问题？常见的使用场景有哪些？

<简明解决方式与使用场景，1-2 句>
}}}

{{{row
{{{row
L3（动机，custom-card-type=single-choice）关于选择 X 而非替代方案，以下哪项是正确的？

- A. <正确选项>
- B. <干扰项>
- C. <干扰项>
- D. <干扰项>
}}}

答案：A。<解析：关键权衡与选择动机，1-2 句>
}}}

{{{row
{{{row
L4（实战，custom-card-type=multi-choice）使用 X 时，以下哪些是正确的做法？

- [ ] <正确做法 1>
- [ ] <错误做法干扰项>
- [ ] <正确做法 2>
- [ ] <正确做法 3>
}}}

答案：<正确选项>。

解析：<每条选项的简要说明，1-3 句>
}}}

## Related

**前置依赖**（学这个之前应该先懂）：

- ((<doc-id> 'Prerequisite Page')) — 为什么需要先懂

**延伸学习**（学这个之后可以深入）：

- ((<doc-id> 'Extension Page')) — 延伸方向

## Sources

#tag-a# #tag-b#
```

### Reference

```markdown
One-sentence source description.

## Key Takeaways

## Claims

## Source Link

- URL: https://...
- Internal: ((<doc-id> 'Original Document'))
- Location: Section 3.2, ¶4

## Concepts Mentioned

#tag-a# #tag-b#
```

The `## Source Link` section supports three forms:
- **External URL**: direct link to the original source
- **Internal block reference**: `((<doc-id> 'Original Document'))` for sources already in the notebook
- **Location**: section/paragraph reference (e.g., "Section 3.2, ¶4") for precise positioning

### Synthesis

```markdown
One-sentence thesis statement.

## Thesis

## Evidence

## Tensions

## What To Investigate Next

#tag-a# #tag-b#
```

### Comparison

```markdown
One-sentence comparison scope.

## Alternatives

- ((<doc-id> 'Option A')) — brief description
- ((<doc-id> 'Option B')) — brief description
- ((<doc-id> 'Option C')) — brief description

## Dimensions

| Dimension | Option A | Option B | Option C |
|---|---|---|---|
| Criterion 1 | ... | ... | ... |
| Criterion 2 | ... | ... | ... |
| Criterion 3 | ... | ... | ... |

## Analysis

## Recommendation

## Sources

#tag-a# #tag-b#
```

### Contradiction

```markdown
One-sentence conflict description.

## Conflicting Claims

- ((<doc-id> 'Claim A from Page A')) — Source: ((<ref-doc-id> 'Source A'))
- ((<doc-id> 'Claim B from Page B')) — Source: ((<ref-doc-id> 'Source B'))

## Conflict Type

[explicit | implicit | partial]

## Possible Cause

[date difference | scope difference | definition difference | measurement difference]

## Resolution Status

[open | resolved | suspended]

## Resolution

> [!NOTE]
> 矛盾解决后在此填写结论。

#tag-a# #tag-b#
```

### Audit (body content only — no frontmatter, metadata in custom-* attrs)

```markdown
# Comment

<user feedback>

# Resolution

> [!NOTE]
> 审计处理后在此填写结论。
```

### Project (learning plan + practice record)

`projects/` 用于学习计划和实践记录。每个学习领域或练手项目一个页面，通过块引用关联 `concepts/` 中的知识页面，形成"学什么→练什么"的闭环。

```markdown
One-sentence project/learning goal description.

## Goal

> [!NOTE]
> 这个学习/实践项目的目标是什么。

## Scope

> [!NOTE]
> 涵盖哪些概念和技能。

## Plan

> [!NOTE]
> 学习/实践计划，按顺序列出里程碑。用块引用关联 concepts/ 页面。

1. [ ] Milestone 1 — ((<doc-id> 'Related Concept'))
2. [ ] Milestone 2 — ((<doc-id> 'Related Concept'))
3. [ ] Milestone 3

## Progress

> [!NOTE]
> 当前进度，完成后打勾。记录哪些 concept 的 custom-depth 升级了。

## Practice Notes

> [!NOTE]
> 实践中的发现、踩坑、经验。对应"多练"的沉淀。

## Related Concepts

- ((<doc-id> 'Concept Page')) — 在这个项目中学到/用到的

## Sources

#tag-a# #tag-b#
```

### Journal (learning reflection)

`journal/` 用于学习反思日志。学完一组概念后写"学到了什么、还有什么不清楚"，费曼式自检。对应"多想"的反思沉淀。

```markdown
One-sentence session summary.

## What I Learned

> [!NOTE]
> 这次学习/复习的核心收获。

## What Confused Me

> [!NOTE]
> 还不清楚的地方，需要后续深挖。

## Feynman Check

> [!NOTE]
> 用自己的话复述今天学的核心概念。如果卡住了，那就是要回去补的。

## Next Steps

> [!NOTE]
> 下一步该学什么、练什么。

#tag-a# #tag-b#
```

## Metadata mirror

After writing a page, mirror all 9 fields to attributes (this is the **primary** metadata store; SQL queries rely on these):

```bash
siyuan-sisyphus block set_attrs --id "$DOC_ID" --attrs-json '{
  "custom-title": "...",
  "custom-category": "concepts",
  "custom-tags": "tag-a,tag-b",
  "custom-sources": "source-a",
  "custom-summary": "One-sentence summary.",
  "custom-status": "draft",
  "custom-confidence": "low",
  "custom-depth": "beginner",
  "custom-updated": "2026-06-28"
}'
```

**初始值（ingest 时写入），maintain 周期自动重算**：

| Category | custom-status (初始) | custom-confidence (初始) | custom-depth (初始) |
|---|---|---|---|
| concepts/ | draft | low (0-1 sources) | beginner |
| references/ | verified | high | — (不适用) |
| synthesis/ | draft | low (0-1 sources) | — (不适用) |
| comparisons/ | draft | low (0-1 sources) | — (不适用) |
| contradictions/ | draft | low | — (不适用) |

`custom-status`、`custom-confidence`、`custom-depth` 三个字段由 maintain 周期自动派生，**不需要人工维护**。派生规则见 `SKILL.md` 的「自动派生规则」段。

`custom-depth` 仅对 `concepts/` 页面有意义，由闪卡复习表现决定。ingest 时创建 concept 页面的 `## Flashcards` 段并注册闪卡后，用户在思源中复习闪卡，maintain 周期根据复习状态自动更新 depth。

## SiYuan Native Features

Use these native features to enhance the wiki without external tools.

### Embed blocks — dynamic views

Embed blocks run SQL at render time in `index` etc. SiYuan 3.6.5 constraint: **must `SELECT *`** (any column list renders empty), and `SELECT *` + `type='d'` expands full page body — drowns the index.

**Choose**: compact list → static `((doc-id 'title'))` block refs (index main use, update after each ingest); dynamic monitoring → embed block querying `type='h'` heading blocks (renders section names, not full pages).

**Rules**:
- `SELECT *`, must exclude current doc `AND root_id != '<current-doc-id>'`
- `{{ }}` must be on its own line with blank lines around it (text prefix turns it into a paragraph)
- `type='d'` renders full page body; concept docs have no h1 heading block (h1 is frontmatter metadata)

See `siyuan-sisyphus/references/markup-guide.md` embed block section for details.

### Callouts — visual annotations

```markdown
> [!WARNING]
> This conclusion conflicts with ((<contradiction-doc-id> 'contradiction record')). See the contradiction page for details.

> [!CAUTION]
> This page is marked outdated. See ((<ref-doc-id> 'updated source')) for current information.

> [!IMPORTANT]
> Core definition: This concept refers to ...
```

Write callouts with `block append --data-type markdown`. The `> [!TYPE]` must be on its own line, followed by lines starting with `>`.

### Native tags — tag panel navigation

Mirror `custom-tags` as SiYuan native tags at the end of page body for tag panel navigation:

```markdown
#tag-a# #tag-b#
```

Tag format is `#tag#` (hash on both ends), not standard Markdown `#tag`. Hierarchical tags use `/` separator: `#domain/machine-learning#`.

### Dynamic anchor text — block references that follow target

Use single-quote format for block references so anchor text follows the target block:

```markdown
((<doc-id> 'display text'))
```

Double quotes `"text"` produce static anchor text. Prefer single quotes unless you need fixed display text.

## Links

Resolve target page ids first:

```bash
siyuan-sisyphus search query_sql --sql "SELECT id,hpath FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' AND hpath IN ('/concepts/foo','/references/bar') LIMIT 50" --json
```

Then write links as `((<doc-id> 'Display Text'))`.
