# Report

Use this for dashboards, weekly digests, and compact context packs.

## Dashboard

Run `search query_sql`, render the rows as Markdown, and write the result under `_meta/` or `synthesis/`.

Useful queries:

```bash
siyuan-sisyphus search query_sql --sql "SELECT id,hpath,updated FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' ORDER BY updated DESC LIMIT 50" --json
siyuan-sisyphus search query_sql --sql "SELECT id,hpath,ial FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' AND ial LIKE '%custom-status=\"open\"%' LIMIT 100" --json
```

## Digest

Read `log`, recent pages, and open audits. Summarize:

- new or changed pages;
- unresolved contradictions;
- high-value next reads;
- suggested maintenance actions.

## Context pack

For a token-limited handoff, include:

- the current question or goal;
- the 5-12 most relevant pages with one-line summaries;
- open audits or uncertainties;
- exact hpaths the next agent should read.
