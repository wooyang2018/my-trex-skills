# Setup

Use this when creating, checking, or switching the active SiYuan wiki notebook.

## Preflight

```bash
siyuan-sisyphus --version
siyuan-sisyphus config list
siyuan-sisyphus notebook list --json
```

## Configuration

Resolve configuration from a single source:

1. Read `~/.siyuan-wiki/config` — this is the sole configuration file.
2. If it does not exist, ask the user for the notebook id from `notebook list --json`, then create it by writing the
   template below to `~/.siyuan-wiki/config`.

### Required fields (user must provide)

- `SIYUAN_NOTEBOOK_ID` — immutable notebook id like `20241205084226-rl6jd3a`.
  Used for `--notebook`, `document lookup`, and `search query_sql ... box=`.
  Discover via `siyuan-sisyphus notebook list --json`.
For `fs` commands, resolve the current notebook name at runtime with
`siyuan-sisyphus notebook list --json` and use `/<resolved-name>/<hpath>`.
Do not persist a second notebook identity in config.

### Config template (write this file when creating from scratch)

When `~/.siyuan-wiki/config` does not exist, generate it with these contents
(filling in the required fields from user input):

```toml
# siyuan-wiki — Global Configuration (single source of truth)
SIYUAN_NOTEBOOK_ID="<fill-from-notebook-list>"

# Optional: override the active siyuan-sisyphus profile.
SIYUAN_PROFILE=
```

## Structure

Create parent documents before child documents. `fs write` does not create missing parent documents.

Seed these roots if missing:

```text
index
log
hot
audit
_meta
_meta/manifest
concepts
entities
references
synthesis
```

Use `fs write` without `--overwrite` for empty category roots so reruns do not overwrite user content. Use `--overwrite` for system documents (`index`, `hot`, `_meta/manifest`) only when intentionally refreshing them.

## Verification

- `notebook get_permissions --notebook "$SIYUAN_NOTEBOOK_ID"` returns write permission for write operations.
- `document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/index" --json` returns an id.
- `search query_sql --sql "SELECT id,hpath FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' LIMIT 20" --json` returns documents.
