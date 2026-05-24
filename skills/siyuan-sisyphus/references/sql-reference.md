# 思源 SQL 速查

适用场景：写 `siyuan-sisyphus search query_sql --sql "..."`、构造嵌入块 `{{ SELECT ... }}`、做内容批量分析。

铁律：

- 仅 `SELECT` / `WITH` 只读；`UPDATE` / `DELETE` / `INSERT` 一律被拒。
- 每条查询都要带 `LIMIT`，否则 MCP 仍会截断并提示。
- 结果会按笔记本权限做事后过滤，列出来"少了"先核对 `notebook get_permissions`。

## 主要表

| 表 | 用途 |
| --- | --- |
| `blocks` | 内容块（最常用） |
| `blocks_fts` / `blocks_fts_case_insensitive` | 全文索引（`MATCH` 语法） |
| `attributes` | 块属性（`name="key"`、`value="..."`） |
| `refs` | 引用关系（`def_block_id`、`block_id`、`def_block_path`） |
| `spans` | 行内元素（标签、链接、行内代码、加粗等） |
| `assets` | 资源引用 |

## blocks 常用列

| 列 | 说明 |
| --- | --- |
| `id` | 块 ID |
| `parent_id` | 父块 ID（文档块为空） |
| `root_id` | 所在文档 ID |
| `box` | 笔记本 ID |
| `path` | 存储路径（`.sy`） |
| `hpath` | 人类可读路径（`/目录/文档`） |
| `name` | 命名 |
| `alias` | 别名（逗号分隔） |
| `memo` | 备注 |
| `tag` | 标签字符串（`#x##y#` 拼接） |
| `content` | 纯文本 |
| `fcontent` | 首段文本（容器块用） |
| `markdown` | kramdown 源码 |
| `length` | 内容长度 |
| `type` | 块类型（见下） |
| `subtype` | 子类型（如 `t` 任务列表） |
| `ial` | 内联属性字符串 `{: ...}` |
| `sort` | 同级排序 |
| `created` | 创建时间（`YYYYMMDDHHMMSS`） |
| `updated` | 更新时间（`YYYYMMDDHHMMSS`） |

## type 取值

`d`=文档、`h`=标题、`p`=段落、`l`=列表、`i`=列表项、`b`=引述、`c`=代码块、`m`=数学块、`t`=表格、`s`=超级块、`html`=HTML 块、`embed`=嵌入块、`av`=属性视图、`video`、`audio`、`widget`。

`subtype` 在标题用 `h1`~`h6`，在列表项用 `t`（任务）、`o`（有序）、`u`（无序）。

## 常用模板

最近更新的 5 个文档：

```sql
SELECT id, hpath, content FROM blocks WHERE type='d' ORDER BY updated DESC LIMIT 5
```

包含关键词的段落：

```sql
SELECT id, root_id, content FROM blocks WHERE content LIKE '%关键词%' AND type='p' LIMIT 50
```

含某标签的所有块：

```sql
SELECT id, type, content FROM blocks WHERE tag LIKE '%#项目A#%' LIMIT 50
```

未完成任务列表：

```sql
SELECT id, content FROM blocks WHERE markdown LIKE '%[ ]%' AND subtype='t' AND type='i' LIMIT 100
```

某笔记本下所有文档：

```sql
SELECT id, hpath FROM blocks WHERE box='<notebookId>' AND type='d' ORDER BY hpath LIMIT 200
```

随机 3 个段落：

```sql
SELECT id, content FROM blocks WHERE type='p' ORDER BY random() LIMIT 3
```

按反链找谁引用了某文档：

```sql
SELECT b.id, b.hpath, b.content
FROM refs r JOIN blocks b ON b.id = r.block_id
WHERE r.def_block_id = '<targetDocOrBlockId>'
LIMIT 50
```

## 全文索引（FTS）

```sql
SELECT id, content FROM blocks_fts WHERE blocks_fts MATCH 'content:关键词' LIMIT 20
SELECT id, content FROM blocks_fts_case_insensitive WHERE blocks_fts_case_insensitive MATCH 'content:Foo*' LIMIT 20
```

`MATCH` 支持 `*` 前缀通配、`AND`/`OR`/`NOT`、`"短语"`。

## CLI 调用

```bash
siyuan-sisyphus search query_sql --sql "SELECT id, hpath FROM blocks WHERE box='<notebookId>' AND type='d' LIMIT 50" --json
```

字段优先用 `--sql`（推荐），CLI 也接受 `--stmt` 兼容旧调用。

## 嵌入块

把 SQL 写成嵌入块由思源运行时渲染：

```bash
siyuan-sisyphus block append --parent-id <docId> --data-type markdown --data "{{ SELECT id, content FROM blocks WHERE content LIKE '%TODO%' LIMIT 20 }}"
```

嵌入块只能渲染 `blocks` 表内容，但 SQL 内部可以 JOIN 其它表。
