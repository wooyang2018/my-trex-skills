# Writing

Use this before writing or restructuring wiki pages.

## Page sizes

| Type | Target |
|---|---|
| concept | 400-1200 words |
| entity | 200-500 words |
| reference | 150-400 words |
| synthesis | 600-1500 words |
| project overview | 200-600 words |

Split a concept when it would exceed about 1200 words or when several sections deserve independent links. Create `concepts/<topic>` as the overview page, then focused child pages under it.

## Templates

Concept:

```markdown
---
title: <Title>
category: concepts
tags: [tag]
sources: [source-id]
created: <ISO>
updated: <ISO>
---

# <Title>

One-sentence definition.

## What It Is

## How It Works

## Tradeoffs

## Related

- ((<doc-id> "Related Page")) — relation.

## Sources
```

Entity:

```markdown
---
title: <Name>
category: entities
tags: [person|tool|paper|organization]
sources: [source-id]
created: <ISO>
updated: <ISO>
---

# <Name>

One-sentence description in this wiki's scope.

## Known For

## Related

## Sources
```

Reference:

```markdown
---
title: <Source Title>
category: references
source_url: <url-or-path>
tags: [tag]
created: <ISO>
updated: <ISO>
---

# <Source Title>

## Key Takeaways

## Claims

## Concepts Mentioned
```

Synthesis:

```markdown
---
title: <Question or Theme>
category: synthesis
tags: [tag]
sources: [source-a, source-b]
created: <ISO>
updated: <ISO>
---

# <Question or Theme>

## Thesis

## Evidence

## Tensions

## What To Investigate Next
```

## Metadata mirror

After writing a page, mirror core fields to attributes:

```bash
siyuan-sisyphus block set_attrs --id "$DOC_ID" --attrs-json '{
  "custom-title": "...",
  "custom-category": "concepts",
  "custom-tags": "tag-a,tag-b",
  "custom-sources": "source-a",
  "custom-summary": "...",
  "custom-updated": "..."
}'
```

## Links

Resolve target page ids first:

```bash
siyuan-sisyphus search query_sql --sql "SELECT id,hpath FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' AND hpath IN ('/concepts/foo','/entities/bar') LIMIT 50" --json
```

Then write links as `((<doc-id> "Display Text"))`.
