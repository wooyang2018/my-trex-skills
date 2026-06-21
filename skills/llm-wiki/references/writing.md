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

## Key rule: no body frontmatter or `# Title`

SiYuan auto-generates a frontmatter block and `# Title` heading for every document. Adding a second YAML frontmatter or `# Title` in the body causes duplicate rendering — the second frontmatter appears as raw text.

**Correct**: Start body content directly with the one-sentence definition. Audit documents also follow this rule — all metadata is stored in custom-* attrs.

## Templates

Concept:

```markdown
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
One-sentence description in this wiki's scope.

## Known For

## Related

## Sources
```

Reference:

```markdown
One-sentence source description.

## Key Takeaways

## Claims

## Concepts Mentioned
```

Synthesis:

```markdown
One-sentence thesis statement.

## Thesis

## Evidence

## Tensions

## What To Investigate Next
```

Audit (body content only — no frontmatter, metadata in custom-* attrs):

```markdown
# Comment

<user feedback>

# Resolution

<!-- filled in when processed -->
```

## Metadata mirror

After writing a page, mirror core fields to attributes (this is the **primary** metadata store; SQL queries and the web viewer rely on these):

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
