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
- If the answer is durable, offer to promote it to `synthesis/` or update an existing page.
