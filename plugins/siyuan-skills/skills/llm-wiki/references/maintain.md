# Maintain

Use this for health checks, light graph cleanup, audit archiving, and periodic maintenance.

## Checks

- Missing required roots: `index`, `log`, `audit`, category roots (`concepts`, `references`, `synthesis`, `comparisons`, `contradictions`), learning roots (`projects`, `journal`).
- Pages missing any of the 9 required `custom-*` attributes: `custom-title`, `custom-category`, `custom-tags`, `custom-sources`, `custom-summary`, `custom-status`, `custom-confidence`, `custom-depth` (concepts/ only), `custom-updated`.
- Open audits older than the user's tolerance.
- Duplicate titles or near-identical hpaths.
- Important pages with no inbound refs.
- Dead block references from `search list_invalid_refs`.
- Open contradictions in `contradictions/` with `## Resolution Status` = open (auto-derived `custom-status=draft`).
- Concept pages missing `## Flashcards` section or unregistered flashcard blocks.

## Auto-derivation (run every maintain cycle)

`custom-status`, `custom-confidence`, and `custom-depth` are auto-derived — no human maintenance needed. Recalculate them during every maintain cycle.

### 1. Recalculate custom-confidence

For each page in `concepts/`, `synthesis/`, `comparisons/`, count `custom-sources` entries (comma-separated) and set:

- 0-1 sources → `low`
- 2 sources → `medium`
- 3+ sources → `high`

`references/` → always `high`. `contradictions/` → always `low`. No SQL needed for these — set directly.

```bash
# Get all pages with their source counts
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a.value as sources FROM blocks b LEFT JOIN attributes a ON a.block_id=b.id AND a.name='custom-sources' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND (b.hpath LIKE '/concepts/%' OR b.hpath LIKE '/synthesis/%' OR b.hpath LIKE '/comparisons/%') LIMIT 500" --json
```

For each row, count commas in `sources` + 1 = source count. Update `custom-confidence` accordingly via `block set_attrs`.

### 2. Recalculate custom-status

For `concepts/`, `synthesis/`, `comparisons/` pages:

- `draft`: if `custom-updated` is within 7 days of today, OR if an open contradiction page references it
- `verified`: if `custom-updated` is 7+ days old AND `custom-sources` has 2+ entries AND no open contradiction references it
- `outdated`: if `custom-updated` is 180+ days old

For `contradictions/` pages: read `## Resolution Status` from page body — `open` → `draft`, `resolved` → `verified`, `suspended` → `outdated`.

`references/` → always `verified`.

To check for open contradictions referencing a page:

```bash
siyuan-sisyphus search query_sql --sql "SELECT r.block_id, r.root_id FROM refs r JOIN blocks b ON b.id=r.root_id WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.hpath LIKE '/contradictions/%' AND r.content LIKE '%<target-doc-id>%' LIMIT 50" --json
```

### 3. Recalculate custom-depth (flashcard-based, concepts/ only)

For each concept page, check its flashcard review states. Use `scope=deck` with `SIYUAN_FLASHCARD_DECK_ID` from config to query cards in the wiki-cards deck:

1. Get all flashcard blocks with their levels:

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a.value as level FROM blocks b JOIN attributes a ON a.block_id=b.id AND a.name='custom-card-level' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type IN ('p','s') LIMIT 500" --json
```

2. Get reviewed cards (cards the user has practiced at least once):

```bash
siyuan-sisyphus flashcard list_cards --scope deck --deck-id "$SIYUAN_FLASHCARD_DECK_ID" --filter old --page 1 --page-size 1000 --json
```

3. Get new cards (never reviewed):

```bash
siyuan-sisyphus flashcard list_cards --scope deck --deck-id "$SIYUAN_FLASHCARD_DECK_ID" --filter new --page 1 --page-size 1000 --json
```

4. For each concept, match its L1/L2/L3/L4 block IDs to card states:
   - Cards in the `old` list (reps > 0) = reviewed = counts for depth
   - Cards in the `new` list (reps = 0, state = 0) = not reviewed = doesn't count
   - Cards not in either list = not registered as flashcards

5. Apply depth rules:

| Condition | depth |
|---|---|
| L1 card not found or in `new` list | beginner |
| L1 reviewed but L2 not found or in `new` list | beginner |
| L1+L2 reviewed but L3 not found or in `new` list | intermediate |
| L1+L2+L3 reviewed but L4 not found or in `new` list | intermediate |
| L1+L2+L3+L4 all reviewed | advanced |

6. Update `custom-depth` via `block set_attrs` where the value changed.

## Quality metrics

Run these 8 quantifiable health checks during maintenance:

### 1. Metadata completeness — target ≥ 95%

Pages missing any required `custom-*` field:

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath NOT LIKE '/audit/%' AND b.id NOT IN (SELECT block_id FROM attributes WHERE name LIKE 'custom-%' GROUP BY block_id HAVING COUNT(*) >= 9) LIMIT 500" --json
```

### 2. Source coverage — target ≥ 80%

`concepts/`, `synthesis/`, `comparisons/` pages missing `custom-sources`:

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND (b.hpath LIKE '/concepts/%' OR b.hpath LIKE '/synthesis/%' OR b.hpath LIKE '/comparisons/%') AND b.id NOT IN (SELECT block_id FROM attributes WHERE name='custom-sources' AND value != '') LIMIT 500" --json
```

### 3. Orphan page rate — target ≤ 5%

Pages with no inbound and no outbound block references:

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath NOT LIKE '/audit/%' AND b.id NOT IN (SELECT root_id FROM refs) AND b.root_id NOT IN (SELECT block_id FROM refs WHERE root_id != b.id) LIMIT 500" --json
```

### 4. Draft backlog rate — target ≤ 30%

Pages with their `custom-status` value — count total and drafts externally:

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a.value as status FROM blocks b LEFT JOIN attributes a ON a.block_id=b.id AND a.name='custom-status' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath NOT LIKE '/audit/%' LIMIT 500" --json
```

Count total rows and rows where `status='draft'`. Aggregate queries (COUNT/SUM) get permission-filtered by SiYuan when the identity column is not directly in the SELECT — always use row-level queries and compute externally.

### 5. Contradiction backlog — target ≤ 10 open

Open contradiction records (Resolution Status = open, auto-derived `custom-status=draft`):

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b JOIN attributes a ON a.block_id=b.id AND a.name='custom-status' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath LIKE '/contradictions/%' AND a.value='draft' LIMIT 100" --json
```

`custom-status=draft` for contradictions means `## Resolution Status` = open. When the user resolves the contradiction (changes Resolution Status to `resolved`), the maintain cycle auto-derives `custom-status=verified`. The page body's `## Resolution Status` (open/resolved/suspended) is the source of truth; `custom-status` mirrors it automatically.

### 6. Stale page rate — target ≤ 10%

Pages not updated in 90+ days AND `custom-status=draft`:

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a2.value as updated FROM blocks b JOIN attributes a ON a.block_id=b.id AND a.name='custom-status' LEFT JOIN attributes a2 ON a2.block_id=b.id AND a2.name='custom-updated' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath NOT LIKE '/audit/%' AND a.value='draft' AND a2.value < 'YYYY-MM-DD' LIMIT 500" --json
```

Replace `YYYY-MM-DD` with the date 90 days before today.

### 7. Learning depth distribution — target: healthy spread

`concepts/` pages by `custom-depth` value (auto-derived from flashcard reviews). If beginner dominates, the wiki is wide but shallow; review more flashcards to advance depth:

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a.value as depth FROM blocks b LEFT JOIN attributes a ON a.block_id=b.id AND a.name='custom-depth' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath LIKE '/concepts/%' LIMIT 500" --json
```

Count rows by depth value (beginner/intermediate/advanced). Depth is auto-derived from flashcard review performance — to advance a concept's depth, review its L2/L3 flashcards in SiYuan. If >70% are beginner, you're collecting concepts without reviewing flashcards. This metric directly reflects the "多学→多练" progression: reviewing flashcards is the practice that deepens understanding.

### 8. Flashcard coverage — target ≥ 90%

`concepts/` pages missing the `## Flashcards` section or with unregistered flashcard blocks. Without flashcards, depth cannot be assessed:

```bash
# Concepts without custom-card-level blocks (no flashcards registered)
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath LIKE '/concepts/%' AND b.id NOT IN (SELECT DISTINCT root_id FROM blocks WHERE id IN (SELECT block_id FROM attributes WHERE name='custom-card-level')) LIMIT 500" --json
```

For each concept page, also verify it has 4 flashcard blocks (L1-L4). Concepts with missing or partial flashcards need card creation — run the flashcard registration step from `ingest.md`.

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

> 准备将 `audit/` 下 `custom-status=resolved` 的审计文档移动到 `audit/resolved/`，是否继续？

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
