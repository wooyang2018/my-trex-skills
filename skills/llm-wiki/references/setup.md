# Setup

Use this when creating, checking, or switching the active SiYuan wiki notebook.

## Preflight

```bash
siyuan-sisyphus --version
siyuan-sisyphus config list
siyuan-sisyphus notebook list --json
```

Resolve configuration in this order:

1. Walk upward from CWD looking for `.env`.
2. Fall back to `~/.siyuan-wiki/config`.
3. If neither exists, ask the user which notebook should hold the wiki.

Required values:

- `SIYUAN_NOTEBOOK_ID` for `--notebook`, `document lookup`, and `search query_sql ... box=`.
- `SIYUAN_NOTEBOOK_NAME` for `fs` workspace paths such as `/知识库/index`.

## Structure

Create parent documents before child documents. `fs write` does not create missing parent documents.

Seed these roots if missing:

```text
index
log
hot
audit
audit/resolved
_meta
_meta/manifest
_meta/taxonomy
concepts
entities
skills
references
synthesis
journal
projects
```

Use `fs write` without `--overwrite` for empty category roots so reruns do not overwrite user content. Use `--overwrite` for system documents (`index`, `hot`, `_meta/manifest`) only when intentionally refreshing them.

## Web command

After setup, the web viewer should be started with the same notebook identity:

```bash
cd web
npm start -- --notebook-id "$SIYUAN_NOTEBOOK_ID" --notebook-name "$SIYUAN_NOTEBOOK_NAME"
```

Add `--profile <name>` only when the user has selected a non-default `siyuan-sisyphus` profile.

## Verification

- `notebook get_permissions --notebook "$SIYUAN_NOTEBOOK_ID"` returns write permission for write operations.
- `document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/index" --json` returns an id.
- `search query_sql --sql "SELECT id,hpath FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' LIMIT 20" --json` returns documents.
