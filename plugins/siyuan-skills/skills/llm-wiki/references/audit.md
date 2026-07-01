# Audit

Use this when processing audit feedback.

## Audit document shape

Audit documents live under `audit/`. All metadata is stored via `custom-*` attributes (no YAML frontmatter), following the same pattern as all wiki pages:

| Attribute | Value | Description |
|---|---|---|
| `custom-audit-target` | hpath string | Target page being audited |
| `custom-audit-target-lines` | JSON array | Target line numbers, e.g. `[10, 12]` |
| `custom-audit-anchor-before` | string | Text before the anchor |
| `custom-audit-anchor-text` | string | Selected anchor text |
| `custom-audit-anchor-after` | string | Text after the anchor |
| `custom-audit-severity` | warn / error / info | Audit severity |
| `custom-audit-author` | user / system | Who filed the audit |
| `custom-audit-source` | manual / auto | Audit source |
| `custom-audit-created` | ISO 8601 datetime | When the audit was created |
| `custom-status` | open / resolved | Audit lifecycle state |

The body contains `# Comment` and `# Resolution` sections.

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
6. Update the audit body with a dated `# Resolution`, set `custom-status: resolved` via `block set_attrs`.
7. Append a log entry.

Do not delete audit documents. Do not move them unless the user explicitly asks for physical archive movement.

## Relationship with contradictions

矛盾解决（`contradictions/` 中 `custom-status` 从 draft 升级为 verified/resolved）可能产生审计条目，反之亦然。两者通过 `hpath` 区分：audit 文档在 `/audit/` 下，矛盾记录在 `/contradictions/` 下。审计处理时如发现矛盾相关内容，交叉引用矛盾记录而非在 audit 中重复记录。
