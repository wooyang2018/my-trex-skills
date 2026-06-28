# Audit

Use this when processing audit feedback.

## Audit document shape

Audit documents live under `audit/`. Each document has YAML frontmatter and mirrored `custom-*` attributes:

```yaml
id: 20260620-120102-a1b2
target: wiki/concepts/example
target_lines: [10, 12]
anchor_before: "..."
anchor_text: "selected text"
anchor_after: "..."
severity: warn
author: user
source: manual
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

## Relationship with contradictions

矛盾解决（`contradictions/` 中 `custom-status` 从 draft 升级为 verified/resolved）可能产生审计条目，反之亦然。两者通过 `hpath` 区分：audit 文档在 `/audit/` 下，矛盾记录在 `/contradictions/` 下。审计处理时如发现矛盾相关内容，交叉引用矛盾记录而非在 audit 中重复记录。
