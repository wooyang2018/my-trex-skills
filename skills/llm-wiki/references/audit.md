# Audit

Use this when processing feedback submitted from the web viewer.

## Audit document shape

The web viewer writes audit documents under `audit/`. Each document has YAML frontmatter and mirrored `custom-*` attributes:

```yaml
id: 20260620-120102-a1b2
target: wiki/concepts/example
target_lines: [10, 12]
anchor_before: "..."
anchor_text: "selected text"
anchor_after: "..."
severity: warn
author: user
source: web-viewer
created: 2026-06-20T12:01:02.000Z
status: open
```

The body contains `# Comment` and `# Resolution`.

## Processing

1. List open audits:

   ```bash
   siyuan-sisyphus search query_sql --sql "SELECT id,hpath,ial FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' AND hpath LIKE '/audit/%' LIMIT 500" --json
   ```

2. Read each open audit and its target page with `fs read`.
3. Locate the target text:
   - first try `target_lines`;
   - then unique `anchor_text`;
   - then `anchor_before + anchor_text + anchor_after`.
4. Decide `accepted`, `partial`, `rejected`, or `deferred`.
5. Apply accepted edits with `fs write --overwrite` after reading the whole page.
6. Update the audit body with a dated `# Resolution`, set `status: resolved`, and mirror `custom-status: resolved`.
7. Append a log entry.

Do not delete audit documents. Do not move them unless the user explicitly asks for physical archive movement.
