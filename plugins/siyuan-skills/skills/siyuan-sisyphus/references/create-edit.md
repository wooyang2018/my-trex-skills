# 创建与编辑

适用场景：新建文档、追加内容、插入到指定位置、单块更新、精确字符串替换、设置文档/块属性、日记。路径写入优先用 `fs`，需要返回 ID 时用 `document create`，块级精改用 `block`。

## 创建文档

路径式创建（首选）：

```bash
siyuan-sisyphus fs write --path "/笔记本名/目录/新文档" --markdown "# 标题

正文。"
```

已存在时覆盖正文（保留文档节点与标题，不丢 ID/属性/引用）：

```bash
siyuan-sisyphus fs write --path "/笔记本名/目录/新文档" --markdown "# 新正文" --overwrite
```

需要返回 ID 走 `document create`（注意 `--path` 是笔记本本地 hpath，不带笔记本名、不带 `.sy`）：

```bash
siyuan-sisyphus document create --notebook <notebookId> --path "/目录/新文档" --markdown "# 标题" --json
```

父路径 + 标题分开传也支持：

```bash
# 父路径用人类可读 hpath
siyuan-sisyphus document create --notebook <notebookId> --parent-path "/目录/父" --title "新子" --markdown "# 新子" --json

# 父路径用 lookup 返回的 storage 路径
siyuan-sisyphus document create --notebook <notebookId> --parent-path "/20240318112233-abc123.sy" --title "新子" --json
```

`document create` 报重名错误时核对实际子文档：

```bash
siyuan-sisyphus document lookup --notebook <notebookId> --hpath "/目录/父/新子" --include '["id","path","hpath"]' --json
siyuan-sisyphus document get_child_docs --id <parentDocId> --json
```

> 路径形态对照：
>
> - `fs write --path` ⇒ 工作区路径 `/笔记本名/目录/文档`
> - `document create --path` ⇒ 笔记本本地 hpath `/目录/文档`
> - `document create --parent-path` ⇒ 笔记本本地 hpath 或 storage `.sy`
> - `document lookup --path` ⇒ storage 路径；可读路径用 `--hpath`

## 追加与前置

```bash
# 末尾追加（parentId 为文档 ID 时追加到文档末尾，为块 ID 时追加到该块的子列表末尾）
siyuan-sisyphus block append --parent-id <docOrBlockId> --data-type markdown --data "## 新章节

段落。"

# 头部前置
siyuan-sisyphus block prepend --parent-id <docId> --data-type markdown --data "# 前言"
```

## 插入到指定位置

```bash
# 插入到某块之前
siyuan-sisyphus block insert --next-id <blockId> --data-type markdown --data "插在该块前"

# 插入到某块之后
siyuan-sisyphus block insert --previous-id <blockId> --data-type markdown --data "插在该块后"
```

记忆：`nextID` = 我即将到来，下一个就是它 ⇒ 我在它之前；`previousID` = 上一个是它 ⇒ 我在它之后。

批量插入用 JSON：

```bash
siyuan-sisyphus block insert --blocks-json '[{"previousID":"<blockId>","dataType":"markdown","data":"先"},{"previousID":"<blockId>","dataType":"markdown","data":"后"}]'
```

## 更新与替换

短单块全量替换：

```bash
siyuan-sisyphus block update --id <blockId> --data-type markdown --data "新段落"
```

> 多行 markdown 用 `block update` 可能被截断为首行。多行/表格/代码块改用 `append`、`prepend`、`insert` 或 `fs write --overwrite`。

精确字符串替换（不依赖行号，可跨多行片段）：

```bash
# 文档级
siyuan-sisyphus fs replace --path "/笔记本名/目录/文档" --old "旧文" --new "新文"

# 单块级
siyuan-sisyphus block replace --id <blockId> --edit-json '{"old":"旧文","new":"新文"}'
siyuan-sisyphus block replace --id <blockId> --edit-json '{"old":"foo","new":"bar","replace_all":true}'
```

## 设置元数据

文档图标/封面：

```bash
siyuan-sisyphus document set_attr --id <docId> --attrs-json '{"icon":"1f4d4","cover":"https://example.com/x.png"}'
siyuan-sisyphus document set_attr --id <docId> --attrs-json '{"cover":null}'
```

块属性（`custom-` 前缀为自定义属性，可任意命名）：

```bash
siyuan-sisyphus block set_attrs --id <blockId> --attrs-json '{"custom-source":"agent","custom-status":"draft"}'
siyuan-sisyphus block get_attrs --id <blockId> --json
```

## 日记 / 每日笔记

```bash
siyuan-sisyphus document create_daily_note --notebook <notebookId> --json
siyuan-sisyphus block add_to_daily_note --notebook <notebookId> --position append --data-type markdown --data "今天的条目"
```

## 重命名 / 移动 / 删除

按 ID 重命名：

```bash
siyuan-sisyphus document rename --id <docId> --title "新标题"
```

按路径重命名/移动通常需要 storage 路径，先 lookup：

```bash
siyuan-sisyphus document lookup --id <docId> --include '["path"]' --json
siyuan-sisyphus document rename --notebook <notebookId> --path "/20240318112233-abc123.sy" --title "新标题"
```

文档移动 / 块移动 / 文档删除均为 `confirmation required`，执行前必须向用户确认目标：

```bash
siyuan-sisyphus document move --from-ids <docId> --to-id <targetDocId>
siyuan-sisyphus block move --id <blockId> --parent-id <newParentId>
siyuan-sisyphus fs rm --path "/笔记本名/目录/废弃文档"
siyuan-sisyphus fs mv --from "/笔记本名/旧" --to "/笔记本名/新"
```

## 编辑后验证

写入后立刻读回，避免依赖搜索索引的延迟：

```bash
siyuan-sisyphus fs read --path "/笔记本名/目录/文档"
siyuan-sisyphus block get_kramdown --id <blockId>
siyuan-sisyphus document get_doc --id <docId> --mode markdown
```

## 编辑核对清单

1. 写之前先读（`fs read` / `block get_kramdown`）。
2. 多行内容用 `append` / `prepend` / `insert` / `fs write --overwrite`，少用 `block update`。
3. 嵌套字段用 `--xxx-json` JSON 旁路。
4. 写完读回验证。
5. `fs rm` / `fs mv` / `document move` / `block move` 等危险动作必须先取得用户明确批准。
