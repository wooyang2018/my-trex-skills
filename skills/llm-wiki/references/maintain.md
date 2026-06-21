# Maintain

Use this for health checks, light graph cleanup, audit archiving, and periodic maintenance.

## Checks

- Missing required roots: `index`, `log`, `hot`, `audit`, `_meta/manifest`, category roots.
- Pages missing `custom-title`, `custom-category`, `custom-tags`, or `custom-updated`.
- Open audits older than the user's tolerance.
- Duplicate titles or near-identical hpaths.
- Important pages with no inbound refs.
- Dead block references from `search list_invalid_refs`.

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

4. For each direct child of `/audit/`, read it with `fs read`; archive only if the body frontmatter says `status: resolved` or attrs include `custom-status=resolved`.
5. For each selected doc, move it with human-readable paths:

   ```bash
   siyuan-sisyphus fs mv --from "/<resolved name>/audit/<doc>" --to "/<resolved name>/audit/resolved/<doc>"
   ```

6. Append one log entry with count and moved hpaths.
