# Query

Use this when answering questions from the wiki or exploring what the wiki knows about a topic.

## Retrieval Strategy — Stratified, Cost-Aware

Wiki retrieval follows a strict cost-ascending order. Start cheap, narrow fast, then go deep only when necessary.

### Layer 1: Index Scan (cheapest)

Read `index` first. The index lists every wiki page by title and hpath, giving a bird's-eye view of available knowledge. If the topic appears in the index, you get its exact hpath immediately.

```bash
siyuan-sisyphus fs read --path "/$SIYUAN_NOTEBOOK_NAME/index"
```

### Layer 2: Attribute Filtering (cheap)

Use SQL on `custom-*` attributes to narrow by category, tags, status, or confidence. Attribute queries hit the SQLite index and are extremely fast.

**By category and tags:**

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a_title.value as title, a_tags.value as tags, a_summary.value as summary FROM blocks b LEFT JOIN attributes a_title ON a_title.block_id=b.id AND a_title.name='custom-title' LEFT JOIN attributes a_tags ON a_tags.block_id=b.id AND a_tags.name='custom-tags' LEFT JOIN attributes a_summary ON a_summary.block_id=b.id AND a_summary.name='custom-summary' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath LIKE '/concepts/%' AND a_tags.value LIKE '%machine-learning%' LIMIT 50" --json
```

**By status or confidence:**

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a.value as confidence FROM blocks b JOIN attributes a ON a.block_id=b.id AND a.name='custom-confidence' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND a.value='high' AND b.hpath LIKE '/concepts/%' LIMIT 100" --json
```

**By depth (concepts/ only):**

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a.value as depth FROM blocks b LEFT JOIN attributes a ON a.block_id=b.id AND a.name='custom-depth' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath LIKE '/concepts/%' ORDER BY a.value LIMIT 200" --json
```

**Recently updated pages:**

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a.value as updated FROM blocks b JOIN attributes a ON a.block_id=b.id AND a.name='custom-updated' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND a.value >= 'YYYY-MM-DD' LIMIT 50" --json
```

**Broad category scan (all pages in a category):**

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a_title.value as title, a_summary.value as summary FROM blocks b LEFT JOIN attributes a_title ON a_title.block_id=b.id AND a_title.name='custom-title' LEFT JOIN attributes a_summary ON a_summary.block_id=b.id AND a_summary.name='custom-summary' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath LIKE '/concepts/%' LIMIT 200" --json
```

### Layer 3: Fulltext Search (medium cost)

Fulltext search scans block content. Use it when attribute filtering isn't specific enough. Combine with category scoping by examining results' hpaths.

```bash
siyuan-sisyphus search fulltext --query "<key terms>" --page 1 --page-size 20 --json
```

**Multi-keyword combination strategy:**

For complex queries, run multiple fulltext searches with different keyword combinations, then intersect results:

1. Primary concepts: search the core topic name
2. Related mechanisms: search mechanism/principle keywords
3. Tradeoffs: search alternative/comparison keywords
4. Pitfalls: search error/issue/mistake keywords

Each search returns a ranked list. Pages appearing in multiple result sets are higher-confidence matches. When multiple search results point to the same page, prioritize that page for full reading.

### Layer 4: Backlink Traversal (medium cost)

Follow block references to discover related pages. Given a concept page, find everything that references it:

```bash
siyuan-sisyphus document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/concepts/target-concept" --json
siyuan-sisyphus search get_backlinks --id "<doc-id>" --mode both --json
```

Backlinks reveal relationships invisible to keyword search: synthesis pages that cite this concept, comparison pages that contrast it, contradiction pages that dispute it.

### Layer 5: Full Page Read (most expensive — last resort)

Only read full pages after narrowing to a handful of candidates. Never start with full page reads.

```bash
siyuan-sisyphus fs read --path "/$SIYUAN_NOTEBOOK_NAME/concepts/target-concept"
```

## Cross-Category Associative Lookup

Knowledge in the wiki is interconnected across categories. A concept may have synthesis pages, comparison entries, and contradiction records all referencing it. Follow these association chains for complete answers.

### Concept → Synthesis → Comparison → Contradiction

Starting from a concept page, traverse outward:

1. **Concept → Synthesis**: Backlinks from `synthesis/` pages typically aggregate multiple concepts into a broader thesis. Check if any synthesis page references your concept.
2. **Synthesis → Comparison**: Synthesis pages often link to `comparisons/` for structured alternatives analysis.
3. **Concept → Contradiction**: Backlinks from `contradictions/` pages indicate disputed claims. Always check for open contradictions before citing a concept as settled knowledge.
4. **Comparison → Concepts**: Each comparison row links to individual concept pages — follow both sides for balanced understanding.

**Traversal SQL for cross-category discovery:**

```bash
# Find all pages that reference a given concept, grouped by category
siyuan-sisyphus search query_sql --sql "SELECT DISTINCT b.hpath, b.id FROM blocks b JOIN refs r ON r.root_id=b.id WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND r.block_id='<target-block-id>' AND (b.hpath LIKE '/synthesis/%' OR b.hpath LIKE '/comparisons/%' OR b.hpath LIKE '/contradictions/%') LIMIT 50" --json
```

### Source Tracing

Concept pages have `custom-sources` listing referenced `references/` pages. To verify a claim:

1. Read the concept page to get its source list from `custom-sources`
2. Look up each source page by hpath
3. Check the source's `## Source Link` for the original URL or document location

```bash
siyuan-sisyphus search query_sql --sql "SELECT id, hpath FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' AND hpath IN ('/references/source-a','/references/source-b') LIMIT 50" --json
```

### Tag-Based Association

Concepts sharing tags are thematically related. Given a concept page's tags, find other pages with the same tags:

```bash
# Find pages sharing at least one tag with the target
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b JOIN attributes a ON a.block_id=b.id AND a.name='custom-tags' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.id != '<target-doc-id>' AND (a.value LIKE '%<tag-1>%' OR a.value LIKE '%<tag-2>%') LIMIT 50" --json
```

## Exploratory Queries — Discovering What You Don't Know You Know

Sometimes the question is not "what does the wiki say about X" but "what does the wiki know that I haven't reviewed lately." These exploratory queries surface hidden knowledge.

### Recent additions

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a.value as updated FROM blocks b JOIN attributes a ON a.block_id=b.id AND a.name='custom-updated' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND a.value >= 'YYYY-MM-DD' ORDER BY a.value DESC LIMIT 30" --json
```

### Least-reviewed concepts (beginner depth, ready for flashcard review)

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b JOIN attributes a ON a.block_id=b.id AND a.name='custom-depth' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath LIKE '/concepts/%' AND a.value='beginner' LIMIT 50" --json
```

### High-confidence but stale pages (may need refresh)

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath, a_conf.value as confidence, a_upd.value as updated FROM blocks b JOIN attributes a_conf ON a_conf.block_id=b.id AND a_conf.name='custom-confidence' JOIN attributes a_upd ON a_upd.block_id=b.id AND a_upd.name='custom-updated' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND a_conf.value='high' AND a_upd.value < 'YYYY-MM-DD' LIMIT 30" --json
```

### Orphan pages (no connections discovered yet)

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath NOT LIKE '/audit/%' AND b.id NOT IN (SELECT root_id FROM refs) AND b.root_id NOT IN (SELECT block_id FROM refs WHERE root_id != b.id) LIMIT 50" --json
```

### Tag-based topic landscape

Discover all tags in the wiki to understand knowledge domains, then explore by tag:

```bash
# List all distinct tags
siyuan-sisyphus search query_sql --sql "SELECT DISTINCT value FROM attributes WHERE name='custom-tags' AND value != '' LIMIT 200" --json

# Explore by specific tag
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b JOIN attributes a ON a.block_id=b.id AND a.name='custom-tags' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND a.value LIKE '%<tag>%' LIMIT 50" --json
```

### Contradiction status check

```bash
siyuan-sisyphus search query_sql --sql "SELECT b.id, b.hpath FROM blocks b JOIN attributes a ON a.block_id=b.id AND a.name='custom-status' WHERE b.box='$SIYUAN_NOTEBOOK_ID' AND b.type='d' AND b.hpath LIKE '/contradictions/%' AND a.value='draft' LIMIT 50" --json
```

## Result Processing

### Deduplication

After collecting results from multiple search layers, deduplicate by document ID. A page may appear in both attribute queries and fulltext search results — keep the entry with the most complete metadata.

### Relevance Ranking

Prioritize results by:

1. Category match: concepts/ first for "what is X", synthesis/ first for "how does X relate to Y"
2. Confidence: high > medium > low
3. Depth: advanced > intermediate > beginner for deep questions
4. Recency: newer `custom-updated` > older

### Draft Page Annotation

When citing `custom-status=draft` pages, always note "(draft — 未验证)" to signal unverified content. Draft pages may contain AI-generated content that hasn't been reviewed or corroborated by multiple sources.

When citing pages with open contradictions, note "(有未解决矛盾)" and reference the contradiction page by hpath.

## Answering

- Ground the answer in pages read from the wiki. Every claim should be traceable to a specific page.
- State when the wiki is thin or missing a source. This helps identify gaps for future ingest.
- Cite pages by title (from `custom-title`) or hpath. Use block references `((<doc-id> 'title'))` only when writing back into the wiki.
- When synthesizing from multiple pages, note which page contributes which fact.
- For contradictory information, present both sides and reference the contradiction page rather than picking a winner.

## Default Writeback

After generating a durable answer, default to writing back to the wiki. Good answers should be archived per the Karpathy LLM Wiki paradigm.

### Writeback flow

1. Identify durable insight: Does the answer contain a reusable synthesis, comparison, or new concept?
2. Show summary to user:
   > 准备将以下洞察写回 wiki：
   > - 创建/更新 `synthesis/<topic>` 页面
   > - 摘要：...
   > 是否确认写回？
3. On confirm: Write to appropriate category, set initial `custom-status=draft`, `custom-confidence=low`, mirror all 9 custom-* attributes, append log entry.
4. On decline: Record reason in log to avoid repeating suggestion.

### When not to write back

- Simple fact lookup already well-covered by existing pages
- Context-specific answers (e.g., "how do I configure my specific setup")
- User explicitly asks for quick answer without wiki updates

### Writeback tracking

Track writeback rate as a knowledge base health indicator. A healthy wiki has a writeback rate of >=30% for substantive queries.
