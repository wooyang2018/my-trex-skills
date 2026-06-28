# 浏览与读取

适用场景：列出笔记本，浏览文档树，按路径或 ID 读取文档/块内容，解析路径与 ID 之间的转换。优先使用 `fs`，仅在需要 ID、storage 路径、块级元数据或精确块读取时切换到 `document` 或 `block`。

## 列笔记本

```bash
siyuan-sisyphus notebook list
siyuan-sisyphus notebook list --json
siyuan-sisyphus notebook get_permissions
siyuan-sisyphus notebook get_permissions --notebook <notebookId>
```

权限取值：`rwd`、`rw`、`r`、`none`。CLI 模式下未配置的笔记本默认 `r`。看不到某个笔记本时先核对权限，再判断"内容缺失"。

## 浏览树

```bash
siyuan-sisyphus fs ls --path "/"
siyuan-sisyphus fs ls --path "/笔记本名"
siyuan-sisyphus fs tree --path "/笔记本名" --max-depth 3
siyuan-sisyphus fs tree --path "/笔记本名/目录" --max-depth 5 --json
```

需要文档 ID/层级元数据时再用 `document`：

```bash
siyuan-sisyphus document list_tree --notebook <notebookId> --path / --max-depth 3 --json
siyuan-sisyphus document get_child_docs --id <docId> --json
```

## 读文档

按路径读（首选）：

```bash
siyuan-sisyphus fs read --path "/笔记本名/目录/文档"
siyuan-sisyphus fs read --path "/笔记本名/目录/长文档" --page 2 --page-size 8000 --json
```

按 ID 读：

```bash
siyuan-sisyphus document get_doc --id <docId> --mode markdown
siyuan-sisyphus document get_child_blocks --id <docId> --json
```

## 读单个块

```bash
siyuan-sisyphus block get_kramdown --id <blockId>
siyuan-sisyphus block info --id <blockId> --json
siyuan-sisyphus block get_children --id <blockId> --page 1 --page-size 50 --json
siyuan-sisyphus block get_attrs --id <blockId> --json
```

`block get_kramdown` 返回该块的 kramdown，包含属性 IAL（如 `{: id="..." updated="..."}`），是定位块结构的首选。

## 路径与 ID 解析

`document lookup` 是路径↔ID↔storage 路径互转入口：

```bash
# 已知笔记本本地 hpath，求 ID 与 storage 路径
siyuan-sisyphus document lookup --notebook <notebookId> --hpath "/目录/文档" --include '["id","path","hpath"]' --json

# 已知 ID，求 storage 路径与 hpath
siyuan-sisyphus document lookup --id <docId> --include '["path","hpath"]' --json
```

> 注意：`document lookup --path` 接受的是 storage 路径（如 `/20240318112233-abc123.sy`），人类可读路径必须用 `--hpath`。
>
> 工作区路径 `/笔记本名/目录/文档` 不能传给 `document lookup`，要先去掉笔记本名再用 `--hpath`。

## 检索式发现

子树范围内的简单关键词查找：

```bash
siyuan-sisyphus fs search --path "/笔记本名" --query "关键词" --page 1 --page-size 20 --json
```

跨笔记本或要按块类型过滤时改用全文搜索（详见 `search-query.md`）：

```bash
siyuan-sisyphus search fulltext --query "关键词" --page-size 20 --json
siyuan-sisyphus search fulltext --query "关键词" --parent-id <docId> --json
siyuan-sisyphus search fulltext --query "关键词" --h --p --json   # 仅标题与段落
```

## 推荐顺序

1. `notebook list` 起步，确认目标笔记本权限。
2. `fs tree` 或 `fs search` 缩小目标范围。
3. `fs read` 读正文。
4. 需要 ID 或 storage 路径时再 `document lookup`。
5. 需要块级精读或后续 `block` 操作时才用 `block get_kramdown` / `document get_child_blocks`。

## 易错点

- 新建/编辑后的全文搜索可能短暂滞后；按路径或 ID 直接读最可靠。
- 自动化脚本一律加 `--json`、显式 `--page` / `--page-size`。
- 看不到目标？先 `notebook get_permissions`，权限受限时不会报错只会少结果。
