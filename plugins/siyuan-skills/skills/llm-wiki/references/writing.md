# Writing

Use this before writing or restructuring wiki pages.

## Page sizes

| Type | Target |
|---|---|
| concept | 400-1200 words |
| reference | 150-400 words |
| synthesis | 600-1500 words |
| comparison | 400-1000 words |
| contradiction | 150-400 words |
| project overview | 200-600 words |

Split a concept when it would exceed about 1200 words or when several sections deserve independent links. Create `concepts/<topic>` as the overview page, then focused child pages under it.

## Key rule: no body frontmatter or `# Title`

SiYuan auto-generates a frontmatter block and `# Title` heading for every document. Adding a second YAML frontmatter or `# Title` in the body causes duplicate rendering — the second frontmatter appears as raw text.

**Correct**: Start body content directly with the one-sentence definition. Audit documents also follow this rule — all metadata is stored in custom-* attrs.

## Templates

### Concept

`concepts/` 涵盖抽象概念和具体命名对象。模板中的中间段按主题灵活调整——抽象概念侧重 How It Works 和 Tradeoffs，具体对象侧重特征和关联。被多处引用的具体对象自然成为图枢纽。

```markdown
One-sentence definition or description.

## What It Is

## How It Works

## Tradeoffs

## Related

- ((<doc-id> 'Related Page')) — relation.

## Sources

#tag-a# #tag-b#
```

For concrete named objects (tools, people, organizations), adapt the middle sections:

```markdown
One-sentence description in this wiki's scope.

## Overview

## Key Characteristics

## Relationships

## Related

- ((<doc-id> 'Related Page')) — relation.

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

<!-- filled when resolved -->

#tag-a# #tag-b#
```

### Audit (body content only — no frontmatter, metadata in custom-* attrs)

```markdown
# Comment

<user feedback>

# Resolution

<!-- filled in when processed -->
```

## Metadata mirror

After writing a page, mirror all 8 fields to attributes (this is the **primary** metadata store; SQL queries rely on these):

```bash
siyuan-sisyphus block set_attrs --id "$DOC_ID" --attrs-json '{
  "custom-title": "...",
  "custom-category": "concepts",
  "custom-tags": "tag-a,tag-b",
  "custom-sources": "source-a",
  "custom-summary": "One-sentence summary.",
  "custom-status": "draft",
  "custom-confidence": "medium",
  "custom-updated": "2026-06-28"
}'
```

**Status and confidence defaults by category**:

| Category | custom-status | custom-confidence |
|---|---|---|
| concepts/ | draft | medium |
| references/ | verified | high |
| synthesis/ | draft | medium |
| comparisons/ | draft | medium |
| contradictions/ | draft | low |

Upgrade `custom-status` to `verified` only after human review. Upgrade `custom-confidence` to `high` when multiple independent sources corroborate.

## SiYuan Native Features

Use these native features to enhance the wiki without external tools.

### Embed blocks — dynamic views

In system pages like `index`, use embed blocks for dynamic query views:

```markdown
{{ SELECT id, hpath, content FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' AND hpath LIKE '/concepts/%' AND root_id != '<current-doc-id>' ORDER BY updated DESC LIMIT 10 }}
```

Common dynamic views:
- Recent updates: `ORDER BY updated DESC LIMIT 10`
- Pending drafts: `JOIN attributes a ON a.block_id = b.id WHERE a.name = 'custom-status' AND a.value = 'draft'`
- Open contradictions: `hpath LIKE '/contradictions/%'` with `custom-status` = draft

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
