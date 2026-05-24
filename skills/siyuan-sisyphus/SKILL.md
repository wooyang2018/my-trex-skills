---
name: siyuan-sisyphus
description: 思源笔记 CLI 操作技能。当需要通过 siyuan-sisyphus 命令行管理思源笔记本、文档、块、属性视图、资源、标签、闪卡，使用思源专有 markdown 语法（块引用、嵌入块、Mermaid/Chart/PlantUML/FlowChart/Graphviz/HTML 块、超级块、Callout 等），或在文档中嵌入可继续编辑的 Excalidraw SVG/PNG 矢量图时使用本技能。
---

# 思源笔记 siyuan-sisyphus 命令行技能

## 概述

本技能为通过 `siyuan-sisyphus` 命令行操作思源笔记提供统一规范。所有思源笔记的浏览、创建、编辑、搜索、属性视图、资源、标签、闪卡操作均通过该 CLI 完成，不直接调用 HTTP API、不写自定义脚本。

适用触发场景：用户要求"看一下我的思源笔记 / 在某个笔记本里创建文档 / 改某个块的内容 / 用 SQL 查思源 / 把图贴进笔记 / 给文档加标签"等任何与思源笔记内容、结构、元数据相关的需求。

## 启动预检

进入会话后先做三件事，确认环境就绪：

```bash
siyuan-sisyphus --version
siyuan-sisyphus config list
siyuan-sisyphus notebook list
```

若 `notebook list` 报错，按 `references/system-config.md` 配置 profile 后重试。

## 命令形式

通用形式：

```bash
siyuan-sisyphus <tool> <action> [--flag value ...]
```

字段约定：

- 字段名 kebab、camel、snake 互通：`--parent-id`、`--parentID`、`--parent_id` 等价。
- 动作名 kebab 与 snake 互通：`get-kramdown` 与 `get_kramdown` 等价。
- 布尔值：`--flag`、`--flag=false`、`--no-flag`。
- 数组：可重复 `--tag a --tag b`；对简单值也可写成 `--tag a,b`。
- 嵌套对象/数组：用 JSON 旁路参数，如 `--attrs-json '{"custom-source":"agent"}'`、`--cells-json '[...]'`。
- 脚本/解析输出：始终加 `--json`。

随时通过下列命令以 CLI 自身为准查阅最新契约：

```bash
siyuan-sisyphus list
siyuan-sisyphus list <tool>
siyuan-sisyphus help <tool>
siyuan-sisyphus help <tool> <action>
```

## 12 个工具速查

| 工具 | 用途 | 常用动作 |
| --- | --- | --- |
| `fs` | 文档级文件操作（首选） | `ls`、`tree`、`read`、`write`、`replace`、`search`、`rm`、`mv` |
| `notebook` | 笔记本管理 | `list`、`create`、`rename`、`get_conf`、`set_open_state`、`get_permissions`、`get_child_docs` |
| `document` | 文档级元数据/ID 操作 | `create`、`lookup`、`rename`、`move`、`get_doc`、`get_child_docs`、`get_child_blocks`、`set_attr`、`search_docs`、`create_daily_note` |
| `block` | 块级精细操作 | `append`、`prepend`、`insert`、`update`、`replace`、`get_kramdown`、`get_children`、`info`、`set_attrs`、`get_attrs`、`move`、`set_fold_state` |
| `av` | 属性视图（思源数据库） | `get`、`render`、`search`、`add_column`、`add_rows`、`set_cells`、`get_primary_key_values` |
| `search` | 全文与 SQL 检索 | `fulltext`、`query_sql`、`get_backlinks`、`search_refs`、`search_assets`、`fulltext_asset_content`、`find_replace` |
| `file` | 资源与导出 | `upload_asset`、`export_md`、`extract_doc`、`get_doc_assets`、`list_unused_assets`、`remove_unused_assets`、`delete_asset` |
| `tag` | 标签 | `list`、`rename`、`remove` |
| `system` | 版本/时间/配置/通知 | `get_version`、`get_current_time`、`conf`、`network`、`notify` |
| `flashcard` | 闪卡 | `get_decks`、`list_cards`、`get_cards`、`create_card`、`review_card`、`remove_card` |
| `mascot` | 桌面挂件 | `get_balance`、`shop`、`buy` |
| `feedback` | 反馈通道 | 根据 `siyuan-sisyphus list feedback` 现查 |

## 路径三种形态（最易出错）

| 形态 | 用于 | 示例 |
| --- | --- | --- |
| 工作区可读路径 | 全部 `fs` 动作 | `/笔记本名/目录/文档` |
| 笔记本本地 hpath | `document create --path`、`document lookup --hpath`、`document create --parent-path` 的 hpath 形式 | `/目录/文档` |
| 存储路径（`.sy`） | `document lookup` 返回值；`document rename/move/remove --path`、`document create --parent-path` 接受的 storage 形式 | `/20240318112233-abc123.sy` |

铁律：

- 不要把工作区路径 `/笔记本名/...` 传给 `document create --path`，它要求笔记本本地 hpath。
- 不要把存储路径 `/...sy` 传给 `document create --path`，只有 `--parent-path` 接受 storage 形式。
- 需要 ID 或 storage 路径时，先 `document lookup` 解析。

## 典型工作流

### 1. 浏览读取

```bash
siyuan-sisyphus notebook list
siyuan-sisyphus fs tree --path "/笔记本名" --max-depth 3
siyuan-sisyphus fs read --path "/笔记本名/目录/文档" --page 1 --page-size 8000
```

详见 `references/browse-read.md`。

### 2. 创建写入

```bash
# 路径式创建（首选，简洁）
siyuan-sisyphus fs write --path "/笔记本名/目录/新文档" --markdown "# 标题

正文。"

# 已存在则覆盖正文（保留文档节点与标题）
siyuan-sisyphus fs write --path "/笔记本名/目录/新文档" --markdown "# 新正文" --overwrite

# 需要返回 ID 时走 document
siyuan-sisyphus document create --notebook <notebookId> --path "/目录/新文档" --markdown "# 标题" --json
```

详见 `references/create-edit.md`。

### 3. 追加与精确编辑

```bash
# 文档末尾追加（多行/表格/代码块用 append/insert，不要用 update）
siyuan-sisyphus block append --parent-id <docId 或 blockId> --data-type markdown --data "## 新章节

段落"

# 单块全量替换（短内容）
siyuan-sisyphus block update --id <blockId> --data-type markdown --data "新段落"

# 精确字符串替换
siyuan-sisyphus fs replace --path "/笔记本名/目录/文档" --old "旧文" --new "新文"
siyuan-sisyphus block replace --id <blockId> --edit-json '{"old":"旧文","new":"新文"}'
```

`block update` 处理多行 markdown 时可能被 SiYuan 截断为首行。多行内容用 `append` / `prepend` / `insert`。

### 4. 搜索与查询

```bash
siyuan-sisyphus search fulltext --query "关键词" --page-size 20 --json
siyuan-sisyphus search query_sql --sql "SELECT id,hpath,content FROM blocks WHERE type='p' ORDER BY updated DESC LIMIT 10" --json
siyuan-sisyphus search get_backlinks --id <blockOrDocId> --mode both --json
```

详见 `references/search-query.md` 与 `references/sql-reference.md`。

### 5. 思源专有语法与图表

写块引用 `((id '锚文本'))`、嵌入块 `{{ SELECT ... }}`、`#tag#` 标签、Mermaid/Chart/PlantUML/FlowChart/Graphviz/HTML 块、超级块、Callout 等参见 `references/markup-guide.md`。

需要把 Excalidraw 矢量图嵌入文档（且保留可编辑性）参见 `references/excalidraw-embed.md`：上传含 `application/vnd.excalidraw+json` payload 的 SVG/PNG 到 `assets/`，文件名以 `excalidraw-` 开头，再用 `block append` 写 `![](assets/excalidraw-xxx.svg)`。

### 6. 危险操作（删除 / 移动 / 资源上传 / 全局替换）

CLI 把"命令本身"视为执行确认。对用户数据执行下表中任一动作前，必须用一句话向用户复述目标对象与影响，取得明确批准后再执行。

| 工具 | 标记 `confirmation required` 的动作 |
| --- | --- |
| `fs` | `rm`、`mv` |
| `document` | `move` |
| `block` | `move`（删除单个块用 `block update` 清空或文档级 `fs rm`） |
| `search` | `find_replace` |
| `file` | `upload_asset`、`remove_unused_assets`、`delete_asset` |
| `tag` | `remove` |
| `flashcard` | `remove_card` |

样板话术：「准备执行 `<命令摘要>`，将影响 `<具体目标>`，是否继续？」

## JSON 与分页

- 给脚本/链式调用消费的输出统一加 `--json`。
- 读取长文档与列表带 `--page` 和 `--page-size`，避免被截断。例如 `fs read --page 2 --page-size 8000 --json`、`search fulltext --page 1 --page-size 20`。

## 故障排查（速查）

| 现象 | 排查命令 / 对策 |
| --- | --- |
| 连不上 / 401 | `siyuan-sisyphus config list`；按 `references/system-config.md` 重新设置 profile |
| 命令字段不确定 | `siyuan-sisyphus help <tool> <action>` |
| 看不到某些笔记本/结果 | `siyuan-sisyphus notebook get_permissions`；权限可能是 `r` 或 `none` |
| `permission_denied: delete access is required` | 笔记本权限只到 `rw`，没有 `d`。`fs rm` / `document remove` 无法执行；告知用户并请其在思源端把权限调到 `rwd`，或换支持删除的笔记本 |
| 刚写入搜不到 | 思源索引最终一致；短暂等待后重试，或改为按路径/ID 直接读 |
| `block update` 多行内容丢失 | 改用 `block append` / `block insert` / `fs write` |

## 参考文档索引

按需阅读对应 references：

| 文件 | 何时打开 |
| --- | --- |
| `references/browse-read.md` | 列笔记本、看文档树、读文档/块、解析 ID 与路径 |
| `references/create-edit.md` | 创建文档、追加/插入/更新块、改图标/封面/属性、日记 |
| `references/search-query.md` | 全文搜索、SQL、反链、引用、资源搜索、`find_replace` 安全流程 |
| `references/database-av.md` | 属性视图（思源数据库）增列、增行、写单元格、渲染 |
| `references/file-export.md` | 上传资源、导出 markdown、抽取文档、未引用资源治理 |
| `references/tag-flashcard.md` | 列/改/删标签；闪卡牌组与复习 |
| `references/system-config.md` | profile 管理、权限模式、危险动作清单、故障细节 |
| `references/markup-guide.md` | 思源特有书写规范：`((id '标题'))` 引用、`{{SQL}}` 嵌入块、`#tag#` 标签、Callout、Mermaid/Chart/PlantUML/FlowChart/Graphviz、HTML 块、IFrame、超级块、自定义属性 |
| `references/excalidraw-embed.md` | 嵌入可编辑 Excalidraw 矢量图：SVG/PNG metadata 格式、`excalidraw-` 文件名识别规则、上传与引用工作流、迁移自其他平台、暗黑模式陷阱 |
| `references/sql-reference.md` | 思源 SQL 表结构、type 字段、常用查询模板 |
