# Query

Use this when answering questions from the wiki.

## Retrieval order

1. Read `index` and `hot`.
2. Use SQL over `custom-title`, `custom-tags`, and hpath for cheap narrowing.
3. Use `search fulltext` for content search.
4. Read full pages only after narrowing.
5. Follow one level of block-reference backlinks when useful.

Examples:

```bash
siyuan-sisyphus search query_sql --sql "SELECT id,hpath,ial FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' AND (hpath LIKE '/concepts/%' OR hpath LIKE '/synthesis/%') LIMIT 200" --json
siyuan-sisyphus search fulltext --query "<terms>" --page 1 --page-size 20 --json
```

## Answering

- Ground the answer in pages read from the wiki.
- State when the wiki is thin or missing a source.
- Cite pages by title or hpath; use block references only when writing back into the wiki.
- When citing `custom-status=draft` pages, note "(未验证)" to signal unverified content.

## Default writeback

After generating a durable answer, **default to writing back** to the wiki. This is not optional — good answers should be archived back into the wiki per the Karpathy LLM Wiki paradigm.

### Writeback flow

1. **Identify durable insight**: Does the answer contain a reusable synthesis, comparison, or new concept that future queries would benefit from?

2. **Show summary to user**: Present what will be written back:
   > 准备将以下洞察写回 wiki：
   > - 创建/更新 `synthesis/<topic>` 页面
   > - 摘要：...
   > 是否确认写回？

3. **User confirms**:
   - Write to `synthesis/` for cross-source analysis, or
   - Update an existing `concepts/` or `comparisons/` page with new information
   - Set `custom-status=draft`, `custom-confidence=low` (0-1 sources), `custom-depth=beginner` as initial values. These three fields are auto-derived by maintain cycles — no manual upgrades.
   - Mirror all 9 `custom-*` attributes
   - Append log entry: `- YYYY-MM-DD query writeback — <topic>，写回 <n> 页面`

4. **User declines**: Record the reason in `log` to avoid repeating the suggestion:
   ```bash
   siyuan-sisyphus block append --parent-id "$LOG_DOC_ID" --data-type markdown --data "- YYYY-MM-DD query — <topic>，用户拒绝写回（<reason>）"
   ```

### When not to write back

- The answer is a simple fact lookup already well-covered by existing pages
- The answer is specific to the user's current context (e.g., "how do I configure my specific setup")
- The user explicitly asks for a quick answer without wiki updates

### Writeback tracking

Track writeback rate as a knowledge base health indicator. A healthy wiki has a writeback rate of ≥30% for substantive queries (i.e., queries that produce durable insights). The maintain.md quality metrics include this as an activity indicator.
