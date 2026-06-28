# 搜索与查询

适用场景：全文搜索、思源 SQL 查询、反链与引用查找、资源（图片/OCR 文本）搜索、跨文档查找替换。

`search` 工具的所有动作除 `find_replace` 外都是只读。`find_replace` 会修改内容，必须取得用户明确批准。

## 全文搜索

```bash
siyuan-sisyphus search fulltext --query "关键词" --page 1 --page-size 20
siyuan-sisyphus search fulltext --query "foo NOT bar" --method-name query --json
siyuan-sisyphus search fulltext --query "正则.*模式" --method-name regex --json
siyuan-sisyphus search fulltext --query "关键词" --parent-id <docId> --json
siyuan-sisyphus search fulltext --query "关键词" --has-tags --json
```

按块类型过滤（短码自动展开为完整字段，可单独传布尔短码）：

```bash
siyuan-sisyphus search fulltext --query "关键词" --h --p --json   # 仅标题与段落
siyuan-sisyphus search fulltext --query "关键词" --c --json        # 仅代码块
```

常用块类型短码：`d`（文档）、`h`（标题）、`p`（段落）、`l`（列表）、`i`（列表项）、`b`（引述）、`c`（代码块）、`m`（数学块）、`t`（表格）、`s`（超级块）、`html`、`embed`、`av`。

排序优先用语义别名：`--method-name` 替代数字化的 `--method`，`--sort-by` 替代 `--order-by`。

## SQL 查询

只接受 `SELECT`/`WITH`，必须自带 `LIMIT`：

```bash
siyuan-sisyphus search query_sql --sql "SELECT id, hpath, content FROM blocks WHERE type='p' ORDER BY updated DESC LIMIT 10" --json
siyuan-sisyphus search query_sql --sql "SELECT root_id, content FROM spans WHERE type='tag' AND content='#项目#' LIMIT 20" --json
```

字段优先用 `--sql`（推荐）。表结构、type 取值、查询模板见 `sql-reference.md`。

## 反链与引用

```bash
siyuan-sisyphus search get_backlinks --id <blockOrDocId> --mode both --json
siyuan-sisyphus search get_backlinks --id <blockOrDocId> --keyword "过滤词" --json
siyuan-sisyphus search search_refs --id <blockId> --before-len 512 --json
siyuan-sisyphus search list_invalid_refs --page 1 --page-size 50 --json
```

移动/重写内容前先看反链，避免悬空引用。

## 资源与 OCR

```bash
siyuan-sisyphus search search_assets --query "图片关键词" --json
siyuan-sisyphus search search_assets --query "diagram" --exts png,jpg,webp --json
siyuan-sisyphus search fulltext_asset_content --query "图片中的文字" --page 1 --page-size 20 --json
```

文档级资源用 `file get_doc_assets`（详见 `file-export.md`）：

```bash
siyuan-sisyphus file get_doc_assets --id <docId> --asset-type image --json
```

## 动态嵌入块

在文档里嵌入 SQL 查询块（运行时由思源渲染）：

```bash
siyuan-sisyphus block append --parent-id <docId> --data-type markdown --data "{{SELECT id, content FROM blocks WHERE content LIKE '%TODO%' LIMIT 20}}"
```

## 查找替换（高危）

`search find_replace` 会修改正文。**执行前必须**：

1. 先用 `search fulltext` 列出候选块。
2. 用 `fs read` 或 `block get_kramdown` 读目标，向用户复述具体内容与替换文本。
3. 取得用户明确批准。
4. 执行：

```bash
siyuan-sisyphus search find_replace --k "旧文" --r "新文" --ids <docId>
siyuan-sisyphus search find_replace --k "旧文" --r "" --ids-json '["<docId-1>","<docId-2>"]'
```

5. 执行完再读一次验证。

## 易错点

- 刚写的内容索引未必更新，搜不到时短暂等待或改为按路径/ID 直接读。
- SQL 必须只读（`SELECT`/`WITH`），任何 `UPDATE`/`DELETE`/`INSERT` 会被拒绝。
- 每条 SQL 都加 `LIMIT`，否则 MCP 仍会截断并提示。
- 权限过滤会让结果变少，缺内容时先 `notebook get_permissions`。
