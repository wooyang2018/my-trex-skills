# Maintain

Use this for health checks, light graph cleanup, audit archiving, and periodic maintenance.

## Checks

- Missing required roots: `index`, `log`, `hot`, `audit`, `_meta/manifest`, category roots (`concepts`, `references`, `synthesis`, `comparisons`, `contradictions`).
- Pages missing any of the 8 required `custom-*` attributes: `custom-title`, `custom-category`, `custom-tags`, `custom-sources`, `custom-summary`, `custom-status`, `custom-confidence`, `custom-updated`.
- Open audits older than the user's tolerance.
- Duplicate titles or near-identical hpaths.
- Important pages with no inbound refs.
- Dead block references from `search list_invalid_refs`.
- Unreviewed contradictions in `contradictions/` with `custom-status=draft` (AI proposed, not yet human-confirmed).

## Quality metrics

Run these 6 quantifiable health checks during maintenance:

### 1. Metadata completeness — target ≥ 95%

Pages missing any required `custom-*` field:

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath NOT LIKE '/audit/%' AND b.hpath NOT LIKE '/_meta/%' AND b.id NOT IN (SELECT block_id FROM attributes WHERE name LIKE 'custom-%' GROUP BY block_id HAVING COUNT(*) >= 8) LIMIT 500" --json
```

### 2. Source coverage — target ≥ 80%

`concepts/`, `synthesis/`, `comparisons/` pages missing `custom-sources`:

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND (b.hpath LIKE '/concepts/%' OR b.hpath LIKE '/synthesis/%' OR b.hpath LIKE '/comparisons/%') AND b.id NOT IN (SELECT block_id FROM attributes WHERE name='custom-sources' AND value != '') LIMIT 500" --json
```

### 3. Orphan page rate — target ≤ 5%

Pages with no inbound and no outbound block references:

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath NOT LIKE '/audit/%' AND b.hpath NOT LIKE '/_meta/%' AND b.id NOT IN (SELECT root_id FROM refs) AND b.root_id NOT IN (SELECT block_id FROM refs WHERE root_id != b.id) LIMIT 500" --json
```

### 4. Draft backlog rate — target ≤ 30%

Pages with their `custom-status` value — count total and drafts externally:

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a.value as status FROM blocks b LEFT JOIN attributes a ON a.block_id=b.id AND a.name='custom-status' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath NOT LIKE '/audit/%' AND b.hpath NOT LIKE '/_meta/%' LIMIT 500" --json
```

Count total rows and rows where `status='draft'`. Aggregate queries (COUNT/SUM) get permission-filtered by SiYuan when the identity column is not directly in the SELECT — always use row-level queries and compute externally.

### 5. Contradiction backlog — target ≤ 10 unreviewed

Unreviewed contradiction records (AI proposed, not yet human-confirmed):

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b JOIN attributes a ON a.block_id=b.id AND a.name='custom-status' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath LIKE '/contradictions/%' AND a.value='draft' LIMIT 100" --json
```

`custom-status=draft` means AI detected the contradiction but human hasn't confirmed it. Once confirmed, upgrade to `verified`. The page body's `## Resolution Status` (open/resolved/suspended) tracks resolution progress separately.

### 6. Stale page rate — target ≤ 10%

Pages not updated in 90+ days AND `custom-status=draft`:

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a2.value as updated FROM blocks b JOIN attributes a ON a.block_id=b.id AND a.name='custom-status' LEFT JOIN attributes a2 ON a2.block_id=b.id AND a2.name='custom-updated' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath NOT LIKE '/audit/%' AND a.value='draft' AND a2.value < 'YYYY-MM-DD' LIMIT 500" --json
```

Replace `YYYY-MM-DD` with the date 90 days before today.

## Safe defaults

Report first, edit second. For any destructive action, get explicit confirmation.

Non-destructive fixes may be applied after summarizing:

- add missing `custom-*` attrs;
- refresh `index`;
- append log entries;
- add obvious block references when both pages are already known.

Use `search get_backlinks --id <doc-id> --mode both --json` for backlink checks.

## Archive Resolved Audits

Use this when the user asks to archive resolved audit documents. This is a destructive move operation, so confirm first:

> 准备将 `audit/` 下 `custom-status=resolved` 或 frontmatter `status: resolved` 的审计文档移动到 `audit/resolved/`，是否继续？

After explicit approval:

1. Resolve config and notebook name from `SIYUAN_NOTEBOOK_ID`.
2. Ensure `audit/resolved` exists:

   ```bash
   siyuan-sisyphus fs write --path "/<resolved name>/audit/resolved" --markdown "# Resolved Audits"
   ```

   If it already exists, treat that as success.

3. List audit docs:

   ```bash
   siyuan-sisyphus search query_sql --sql "SELECT id,hpath,ial FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' AND hpath LIKE '/audit/%' LIMIT 1000" --json
   ```

4. For each direct child of `/audit/`, read it with `fs read`; archive only if attrs include `custom-status=resolved`.
5. For each selected doc, move it with human-readable paths:

   ```bash
   siyuan-sisyphus fs mv --from "/<resolved name>/audit/<doc>" --to "/<resolved name>/audit/resolved/<doc>"
   ```

6. Append one log entry with count and moved hpaths.
