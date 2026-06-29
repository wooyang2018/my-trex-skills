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

### Required fields

- `SIYUAN_NOTEBOOK_ID` — immutable notebook id like `20241205084226-rl6jd3a`.
  Used for `--notebook`, `document lookup`, and `search query_sql ... box=`.
  Discover via `siyuan-sisyphus notebook list --json`.
- `SIYUAN_FLASHCARD_DECK_ID` — the `wiki-cards` flashcard deck id.
  All flashcard CLI commands (`create_card`, `list_cards`, `review_card`, `remove_card`) read this from config.
  Discover or create via the Flashcard setup flow below.
For `fs` commands, resolve the current notebook name at runtime with
`siyuan-sisyphus notebook list --json` and use `/<resolved-name>/<hpath>`.
Do not persist a second notebook identity in config.

### Config template (write this file when creating from scratch)

When `~/.siyuan-wiki/config` does not exist, generate it with these contents
(filling in the required fields from user input):

```toml
# siyuan-wiki — Global Configuration (single source of truth)
SIYUAN_NOTEBOOK_ID="<fill-from-notebook-list>"

# Flashcard deck ID — wiki-cards deck (created during setup)
SIYUAN_FLASHCARD_DECK_ID="<fill-from-flashcard-setup>"

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
concepts
references
synthesis
comparisons
contradictions
projects
journal
```

Use `fs write` without `--overwrite` for empty category roots so reruns do not overwrite user content. Use `--overwrite` for system documents (`index`, `hot`) only when intentionally refreshing them.

## Flashcard setup

Flashcards use a dedicated `wiki-cards` deck. The deck ID is stored in config as `SIYUAN_FLASHCARD_DECK_ID` and used by all flashcard CLI commands.

Run the setup script — it is idempotent and handles everything: checks if the deck exists (via CLI `get_decks`), creates it via SiYuan API if missing (CLI cannot create decks), and writes the deck ID to config.

```bash
python3 plugins/siyuan-skills/skills/llm-wiki/scripts/setup_flashcard_deck.py
# → prints deck ID to stdout; status messages go to stderr
# → updates ~/.siyuan-wiki/config with SIYUAN_FLASHCARD_DECK_ID="<deck-id>"
```

After setup, all flashcard operations read `SIYUAN_FLASHCARD_DECK_ID` from config — no runtime deck discovery needed. See `ingest.md` for the card registration flow.

## Verification

- `notebook get_permissions --notebook "$SIYUAN_NOTEBOOK_ID"` returns write permission for write operations.
- `document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/index" --json` returns an id.
- `search query_sql --sql "SELECT id,hpath FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' LIMIT 20" --json` returns documents.
