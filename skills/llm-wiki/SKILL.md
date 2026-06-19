---
name: llm-wiki
description: >
  知识蒸馏基础模式 + 思源存储宪法，用于在思源笔记本中构建和维护 AI 驱动的知识库（通过 siyuan-sisyphus）。
  基于 Andrej Karpathy 的 LLM Wiki 模式。当用户想理解 wiki 模式、设置新知识库、或需要关于三层架构
  （原始来源 → wiki → 模式）、存储原语或所有其他技能遵循的约定时，使用此技能。这是"理论"技能——
  其他技能负责具体操作（摄取、查询、检查）。
---

# LLM Wiki — 知识蒸馏 + 思源存储宪法

你正在维护一个持久的、不断增值的知识库。wiki 不是聊天机器人——它是一个**编译产物**，知识被蒸馏一次并保持更新，而不是每次查询时重新推导。在这个分支中，该产物存在于**思源笔记本**中，且只能通过 `siyuan-sisyphus` CLI 访问。每次读取和写入都通过下文 §4 的原语进行；禁止对笔记本目录进行原始文件系统访问，因为这会绕过思源的索引并损坏状态。

## 1. 三层架构

### 第 1 层：原始来源（不可变）

用户的原始文档——文章、论文、笔记、PDF、对话日志、书签，**以及图片**（截图、白板照片、图表、幻灯片捕获）。这些从不被系统修改。它们存放在用户在文件系统上保留的位置（通过 `.env` 中的 `SIYUAN_SOURCES_DIR` 配置）。图片是一等来源：摄取技能通过 agent 的视觉支持读取它们，并将其解释的内容视为推断内容，除非是逐字转录的文本。图片摄取需要支持视觉的模型——不支持视觉的模型应跳过图片来源并报告哪些文件被跳过。

将原始来源视为"源代码"——权威但难以直接查询。

### 第 2 层：Wiki（LLM 维护，存在于思源中）

一组按类别组织的、相互关联的思源文档。这是编译后的知识——经过综合、交叉引用，并可在思源中导航。每个文档具有：

- **正文顶部的 YAML frontmatter**（标题、类别、标签、来源、时间戳）——保持人类可读和迁移友好。
- **通过 `block set-attrs` 镜像到自定义属性的相同字段**（`custom-title`、`custom-category`、`custom-tags`、`custom-sources`、`custom-summary`、`custom-base-confidence`、`custom-lifecycle`、`custom-tier`、`custom-updated`）——供 `search query_sql` 进行分层检索，无需读取页面。
- **正文中的 `[[wikilinks]]`** 连接相关文档（思原生解析这些链接并在服务端维护反向链接索引）。
- **清晰的来源追溯**——每个论断都可追溯到某个来源。

wiki 存在于由**两个** `.env` 变量标识的思源笔记本中：

- `SIYUAN_NOTEBOOK_ID`——不可变的笔记本 ID（如 `20241205084226-rl6jd3a`）。用于 `--notebook` 参数、`query_sql ... WHERE box='<id>'`、`document lookup`、`document create` 以及任何其他"明确寻址此笔记本"的调用。两个笔记本可以共享相同的名称；只有 ID 保证唯一。
- `SIYUAN_NOTEBOOK_NAME`——人类可读的笔记本名称（如 `模型代理`）。仅用于 `fs *` 工作区路径（需要名称作为第一段，如 `/模型代理/concepts/foo`）以及面向人类的日志行和错误消息。

两者都由 `setup.sh` 在一次 `notebook list --json` 查询后写入（该查询还检测同名冲突并强制用户选择一个）。技能不得在运行时从名称推导 ID——直接从 `.env` 读取两者。两者的值都不是文件系统路径。

### 第 3 层：模式（本技能 + 配置）

管理 wiki 结构的规则——类别、约定、页面模板、下文的存储原语和操作工作流。模式告诉 LLM *如何*维护 wiki。

## 2. 笔记本组织

笔记本有两层结构：**类别**（知识类型）和**项目**（知识来源）。两者都表示为文档子树，而非磁盘上的文件夹。

### 类别

将页面组织到这些默认类别中（可在 `.env` 中通过 `SIYUAN_CATEGORIES` 自定义）：

| 类别 | 用途 | 示例 hpath |
|---|---|---|
| `concepts/` | 想法、理论、心智模型 | `/<notebook>/concepts/transformer-architecture` |
| `entities/` | 人物、组织、工具、项目 | `/<notebook>/entities/andrej-karpathy` |
| `skills/` | 操作知识、流程 | `/<notebook>/skills/fine-tuning-llms` |
| `references/` | 特定来源的摘要 | `/<notebook>/references/attention-is-all-you-need` |
| `synthesis/` | 跨来源的综合分析 | `/<notebook>/synthesis/scaling-laws-debate` |
| `journal/` | 带时间戳的观察、会话日志 | `/<notebook>/journal/2024-03-15` |

注意没有 `.md` 扩展名。思源文档是树中的块；hpath 标识文档，而非磁盘上的文件。

### 项目

知识通常属于特定项目。`projects/` 子树反映了这一点：

```
/<notebook>/
├── projects/
│   ├── my-project/
│   │   ├── my-project       ← 项目概览（以项目命名）
│   │   ├── concepts/        ← 项目级类别子树
│   │   ├── skills/
│   │   └── …
│   ├── another-project/
│   │   └── …
│   └── side-project/
│       └── …
├── concepts/                  ← 全局（跨项目）知识
├── entities/
├── skills/
└── …
```

**当知识是项目特定的**（只适用于一个代码库的调试技术），放在 `projects/<project-name>/<category>/` 下。

**当知识是通用的**（如"React Server Components"这样的概念、如"Andrej Karpathy"这样的人物、广泛适用的技能），放在全局类别子树中。

**交叉引用：** 项目页面应 `[[wikilink]]` 到全局页面，反之亦然。项目的概览页面应链接到与该项目相关的关键概念、技能和实体页面。

**命名规则：** 项目概览文档必须命名为 `<project-name>`，而非 `_project`。思源的图谱视图使用文档标题作为节点标签——`_project` 会使每个项目在图中显示为 `_project`，导致不可读。因此使用 `projects/my-project/my-project`、`projects/another-project/another-project` 等。

每个项目目录有一个概览页面，结构如下（`fs write --overwrite` 的 markdown 正文）：

```markdown
---
title: My Project
category: project
tags: [ai, web, backend]
source_path: ~/.claude/projects/-Users-name-Documents-projects-my-project
created: 2026-03-01T00:00:00Z
updated: 2026-04-06T00:00:00Z
---

# My Project

一段关于这个项目是什么的摘要。

## 关键概念
- [[concepts/some-api]] — 用于核心功能
- [[projects/my-project/concepts/main-architecture]] — 项目特定架构

## 相关
- [[entities/some-service]] — 部署平台
```

写入后，通过 `block set-attrs --attrs '{"custom-title":"My Project","custom-category":"project","custom-tags":"ai,web,backend",...}'` 将相同字段镜像到自定义属性。

## 3. 特殊文档

每个 wiki 在笔记本根目录有以下文档：

### `/<notebook>/index`

按类别组织的内容目录。每个条目有一行摘要和标签。每次摄取操作后通过 `fs write --path "/<notebook>/index" --markdown ... --overwrite` 重建。格式：

```markdown
# Wiki 索引

## 概念
- [[transformer-architecture]] — 序列建模的主导架构 ( #ml #architecture)
- [[attention-mechanism]] — Transformer 的核心构建块 ( #ml #fundamentals)

## 实体
- [[andrej-karpathy]] — AI 研究者、教育者、前 Tesla AI 总监 ( #person #ml)
```

**格式规则：** 在开头的 `(` 和标签之间添加空格。
❌ 不要：`description (#tag)` — 破坏标签解析
✅ 应该：`description ( #tag)` — 正确的间距和标签解析

### `/<notebook>/log`

按时间顺序的只追加记录。每个条目都是可解析的。**始终使用 `block append --parent-id <docId> --data-type markdown --data "..."`——切勿用 `fs write --overwrite`（会覆盖历史记录）和 `block update`（会在第一个换行符处静默截断）。**

```markdown
## 日志

- [2024-03-15T10:30:00Z] INGEST source="papers/attention.pdf" pages_updated=12 pages_created=3
- [2024-03-15T11:00:00Z] QUERY query="How do transformers handle long sequences?" result_pages=4
- [2024-03-16T09:00:00Z] LINT issues_found=2 orphans=1 contradictions=1
- [2024-03-17T10:00:00Z] ARCHIVE reason="rebuild" pages=87 destination="_archives/2024-03-17T10:00:00Z"
- [2024-03-17T10:05:00Z] REBUILD archived_to="_archives/2024-03-17T10:00:00Z" previous_pages=87
```

在首次 `document lookup` 后，将父文档 ID 缓存到 `/<notebook>/_meta/manifest` 的 `_meta.cached_doc_ids.log` 字段中，以便后续追加跳过查询。

### `/<notebook>/hot`

会话热缓存——约 500 词的近期活动语义快照。每次写入技能时通过 `fs write --overwrite` 完整重写。下一个会话在开始工作前读取此文件，以便在不停顿的情况下继续上次的工作。

### `/<notebook>/_meta/manifest`

跟踪每个已摄取的源文件——路径、时间戳、生成了哪些 wiki 页面。正文是包裹在围栏代码块中的 JSON 对象：

````markdown
# Manifest

```json
{
  "version": 1,
  "sources": { ... },
  "_meta": {
    "cached_doc_ids": { "log": "...", "index": "...", "hot": "..." }
  }
}
```
````

用 `fs read --path "/<notebook>/_meta/manifest"` 读取，用正则提取围栏之间的 JSON，解析、修改、序列化、重新包裹，然后 `fs write --overwrite`。**始终将 manifest 重写作为摄取的最后一步**，这样写入中途崩溃不会导致 manifest 声称写入了实际未写入的来源。

manifest 支持：
- **增量计算**——自上次摄取以来新增或修改的内容
- **追加模式**——只处理增量，而非全部
- **审计**——哪个来源产生了哪个 wiki 页面
- **过期检测**——来源已更改但 wiki 页面未更新

### `/<notebook>/_meta/taxonomy`

受控标签词汇表，由 `tag-taxonomy` 管理。纯 markdown 正文。

### `/<notebook>/_raw/`、`/<notebook>/_staging/`、`/<notebook>/_archives/`

文档子树，而非文件系统目录。通过 `fs write --path "/<notebook>/_raw/<slug>" ...` 按需创建。**CLI 一次创建一个文档，不会自动创建缺失的父文档**——如果 `/<notebook>/_raw` 尚不存在，写入会失败并返回 `Parent document not found at "/<notebook>/_raw"`。先种子化父文档（用空/占位正文写入父路径），再写入子文档。`wiki-setup` 对规范类别集做深度优先处理；引入新子树的临时技能必须做同样的操作。

## 4. 存储原语

每次读取/写入都通过以下原语之一。**不允许对笔记本目录进行直接文件系统访问**——思源的索引不会看到这些更改，下一次 `search query_sql` 会返回过期结果。

| 原语 | 用途 | siyuan-sisyphus 命令 |
|---|---|---|
| `read_page(path)` → markdown | 完整读取文档正文（CLI 自动分页长正文） | `fs read --path "/$SIYUAN_NOTEBOOK_NAME/<hpath>"` |
| `write_page(path, md, overwrite=true)` | 整页写入/重写。`overwrite=true` 替换现有正文但保留文档节点和标题。**不会自动创建缺失的父文档**——如果子树是新的，先写入父文档（见 §11 路径形态）。 | `fs write --path "/$SIYUAN_NOTEBOOK_NAME/<hpath>" --markdown "<md>" --overwrite` |
| `append_block(path, md)` | 向现有文档追加一个或多个 markdown 块 | 先 `document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/<hpath>"` 获取文档 ID，然后 `block append --parent-id <docId> --data-type markdown --data "<md>"` |
| `list_pages(category?)` → 行 | 枚举文档（id、hpath、name、ial）而不读取正文 | `search query_sql --stmt "SELECT id, hpath, name, ial FROM blocks WHERE type='d' AND box='$SIYUAN_NOTEBOOK_ID' AND hpath LIKE '/<category>/%' LIMIT 500"`。**每个 `query_sql` 必须包含 `box='$SIYUAN_NOTEBOOK_ID'`**——没有它，如果任何其他打开的笔记本缺少读取权限，思源的权限过滤器会剥离整个结果集。 |
| `get_page_attrs(path)` → dict | 读取文档的所有 `custom-*` 属性 | `search query_sql --stmt "SELECT id, ial FROM blocks WHERE type='d' AND box='$SIYUAN_NOTEBOOK_ID' AND hpath='/<hpath>' LIMIT 1"` 并从 `ial` 中解析 `custom-*` 键（`id` 列是必需的，见 §13 注 9——没有它，行会被权限过滤器静默丢弃） |
| `set_page_attrs(path, attrs)` | 写入 `custom-*` 属性（frontmatter 镜像） | `document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/<hpath>"` 获取文档 ID，然后 `block set-attrs --id <id> --attrs '{"custom-title":"...","custom-tags":"a,b",...}'` |
| `search_fulltext(query)` → 命中 | 跨可读笔记本的 BM25 风格全文搜索 | `search fulltext --query "<text>"`。如需限制到 wiki 笔记本，在 CLI 版本支持时传入 `--box "$SIYUAN_NOTEBOOK_ID"`；否则按 `box` 字段后过滤结果。 |
| `query_sql(sql)` → 行 | 对思源块索引的任意 SELECT。始终包含 `box='$SIYUAN_NOTEBOOK_ID'` 和 `LIMIT`。 | `search query_sql --stmt "<sql>"` |
| `get_backlinks(path)` → 文档/块 | 服务端维护的反向链接索引——包括 wikilink 引用和纯文本提及 | `document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/<hpath>"` 然后 `search get_backlinks --id <docId> --mode both` |
| `read_manifest()` → dict | 读取 `/<notebook>/_meta/manifest`，解析围栏 JSON | `fs read --path "/$SIYUAN_NOTEBOOK_NAME/_meta/manifest"` 然后去除 ` ```json ... ``` ` |
| `write_manifest(dict)` | 序列化、包裹、覆盖 manifest 文档 | 将 JSON 包裹在 ` ```json … ``` ` 中；`fs write --path "/$SIYUAN_NOTEBOOK_NAME/_meta/manifest" --markdown "<wrapped>" --overwrite` |
| `log_event(line)` | 向 `/<notebook>/log` 追加一行带时间戳的记录 | `block append --parent-id <log-doc-id> --data-type markdown --data "- [<ts>] <line>"`（在首次 `document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/log"` 后缓存 `<log-doc-id>`） |
| `update_index(md)` | 完整重写 `/<notebook>/index` | `fs write --path "/$SIYUAN_NOTEBOOK_NAME/index" --markdown "<md>" --overwrite` |
| `update_hot(md)` | 完整重写 `/<notebook>/hot` | `fs write --path "/$SIYUAN_NOTEBOOK_NAME/hot" --markdown "<md>" --overwrite` |
| `move_page(src, dst)` | 将文档移动到新 hpath（须经过危险演练） | `fs mv --src "/$SIYUAN_NOTEBOOK_NAME/<src-hpath>" --dst "/$SIYUAN_NOTEBOOK_NAME/<dst-hpath>"`（需要 CLI 确认） |
| `archive_subtree(src, dst)` | 将整个子树移动到 `/_archives/<timestamp>/` 下 | 对子树根使用 `fs mv` |
| `delete_page(path)` | 删除文档（需要确认；需要 `rwd` 权限） | `fs rm --path "/$SIYUAN_NOTEBOOK_NAME/<hpath>"` — 见下文危险演练 |
| `replace_in_page(path, old, new)` | 在一个文档正文内进行精确字符串替换，多行安全 | `fs replace --path "/$SIYUAN_NOTEBOOK_NAME/<hpath>" --old "<text>" --new "<text>"` |

如果设置了 `SIYUAN_PROFILE`，所有命令接受 `--profile <name>`。CLI 输出是结构化的人类可读响应，包含 `Data`、`Total`、`Truncated` 部分——从 `Data` 块中解析行。`fs rm` 和 `fs mv` 被 CLI 本身标记为"高级 · 需要确认"，因此它们在执行前会提示。

**路径形态说明。** `siyuan-sisyphus` 中存在两种路径风格，不可混用：

- **`fs *` 工作区路径**包含笔记本名称作为第一段：`/$SIYUAN_NOTEBOOK_NAME/<hpath>`。用于 `fs read`、`fs write`、`fs rm`、`fs mv`、`fs replace`。CLI **不接受**笔记本 ID——会报错 "No document found at /<id>"。
- **`document lookup --hpath` / `document create --path`** 使用**笔记本本地** hpath，以 `/` 开头但不包含笔记本段；笔记本通过 `--notebook "$SIYUAN_NOTEBOOK_ID"` 单独提供（始终用 ID，绝不用名称——名称可能冲突）。
- **`document lookup` 存储路径**以 `.sy` 结尾（如 `/20240318112233-abc123.sy`），用于高级场景——大多数技能不应手工构造这些路径。

有疑问时，优先使用 `fs *` 操作；它们接受人类可读的路径，隐藏笔记本 ID 和存储路径。

**为什么同时有 ID 和名称？** `fs *` 设计用于人类可读路径并使用名称；`document` / `search` / `notebook` 操作需要消歧同名笔记本并使用 ID。两者在 `siyuan-sisyphus` 本身中共存，因此 wiki 的 `.env` 镜像了这种分离。

## 5. 三条硬性规则

### 规则 1 — 整页重写使用 `fs write --overwrite`

当新内容跨越多个块时（多个段落、frontmatter 等价物 + 正文、任何列表/表格/代码块与散文并列），使用 `fs write --overwrite`。**切勿对多行内容使用 `block update`**——它会在 `--data` 参数的第一个换行符处静默截断。

### 规则 2 — 增量日志追加使用 `block append --data-type markdown`

`block append` 用于在文档下添加新块；对日志文档使用 `fs write --overwrite` 会抹除历史。在首次 `document lookup` 后将日志文档 ID 缓存到 `/<notebook>/_meta/manifest._meta.cached_doc_ids.log` 中，以便后续追加只需一次 CLI 调用。

### 规则 3 — Frontmatter 双重写入

在每个 wiki 文档正文顶部保留 YAML frontmatter（以便未来的迁移/导出/人类读者保持正常）。然后通过 `block set-attrs` 将相同字段镜像到自定义属性，使 SQL 查询（`search query_sql`）和分层检索（`wiki-query`）无需读取任何页面正文即可命中索引。

```yaml
---
title: Transformer Architecture
category: concepts
tags: [ml, architecture]
summary: Self-attention based seq2seq architecture, dominant since 2017.
base_confidence: 0.85
lifecycle: reviewed
tier: core
created: 2024-03-15T10:30:00Z
updated: 2024-03-15T10:30:00Z
---
```

→ 还需调用（在 `document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/concepts/transformer-architecture"` 获取文档 ID 后）：

```
block set-attrs --id <doc-id> \
  --attrs '{
    "custom-title": "Transformer Architecture",
    "custom-category": "concepts",
    "custom-tags": "ml,architecture",
    "custom-summary": "Self-attention based seq2seq architecture, dominant since 2017.",
    "custom-base-confidence": "0.85",
    "custom-lifecycle": "reviewed",
    "custom-tier": "core",
    "custom-updated": "2024-03-15T10:30:00Z"
  }'
```

技能应该每次页面写入批量查询一次并缓存文档 ID，使得即使在会话中写入多个属性时查询也只发生一次。CLI 同时接受 `set_attr` 和 `set-attr` 操作名。

## 6. 危险演练

在调用以下任何原语之前——`delete_page`（`fs rm`）、`move_page` / `archive_subtree`（`fs mv`）、`replace_in_page` 的笔记本级范围（`fs replace`）、跨笔记本的 `find_replace`，或 `tag remove`——技能必须：

1. **用一句话重述影响：**"我将删除 `/<notebook>/_archives/2024-01-01/` 及其 23 个子文档，释放标签引用 X、Y、Z。"
2. **等待用户明确批准后再执行。** 即使技能被看似授权的短语调用，也切勿在未经确认的情况下执行破坏性原语（"清理旧归档"不是删除授权——它是提出清理方案的请求）。
3. **如果笔记本权限模式不是 `rwd`，拒绝继续。** 运行 `notebook list` 并检查已解析笔记本的访问/权限字段；如果缺少 `d`，报错退出："笔记本 `<name>` 不授予删除权限。请在思源设置中更新权限后重试。"

`search find_replace` 需要特别说明：即使使用 `--dry-run`，agent 也应先运行 `search fulltext` 列出命中并向用户展示；`find_replace` 本身是第二步。

## 7. 索引最终一致性

思源的全文和 SQL 索引与 `fs write` 是最终一致的。**写入后，不要信任 `search fulltext` 能找到新内容。** 如果技能需要验证写入是否成功，应该：

- `fs read --path "<just-written-hpath>"` 并检查正文——这是直接的、同步的、权威的。
- 或 `document lookup --hpath "<just-written-hpath>"` 并检查是否返回了 ID。

等到下一次技能调用（通常几秒后），基于索引的查询（`search fulltext`、`search query_sql`、`search get_backlinks`）才会反映新状态。

## 8. 页面模板

创建新 wiki 页面时，使用此正文结构（并记得通过 `set_page_attrs` 镜像相同字段）：

```markdown
---
title: Page Title
category: concepts
tags: [ml, architecture]
aliases: [alternate name]
relationships:
  - target: "[[concepts/related-concept]]"
    type: extends
sources: [papers/attention.pdf]
summary: One or two sentences, ≤200 chars, so a reader (or another skill) can preview this page without opening it.
provenance:
  extracted: 0.72
  inferred: 0.25
  ambiguous: 0.03
base_confidence: 0.65
lifecycle: draft
lifecycle_changed: 2024-03-15
tier: supporting
created: 2024-03-15T10:30:00Z
updated: 2024-03-15T10:30:00Z
---

# Page Title

一段关于此页面涵盖内容的摘要。

## 关键观点

- 来源的中心论断，直接改述。
- 来源暗示但未明确陈述的概括。 ^[inferred]
- 两个来源不一致的数字。 ^[ambiguous]

使用 [[wikilinks]] 连接到相关页面。

## 待解问题

尚未解决或需要更多来源的事项。

## 来源

- [[references/attention-is-all-you-need]] — 原始论文
```

## 9. 来源标记

wiki 页面上的每个论断有三种来源状态之一。在行内标记它们，以便读者（和未来的摄取遍历）能区分信号和综合。

| 状态 | 标记 | 含义 |
|---|---|---|
| **提取** | *（无标记——默认）* | 对来源实际所述内容的改述。 |
| **推断** | `^[inferred]` 后缀 | LLM 综合的论断——来源未直接陈述的关联、概括或含义。 |
| **歧义** | `^[ambiguous]` 后缀 | 来源不一致，或来源不清晰。 |

示例：

```markdown
- Transformer 可以跨位置并行化，与 RNN 不同。
- 这就是为什么它们在现代硬件上扩展性更好的原因。 ^[inferred]
- GPT-4 大约在 13T tokens 上训练。 ^[ambiguous]
```

**为什么使用此语法：**
- `^[...]` 类似脚注——在思源中渲染干净，且不与 `[[wikilinks]]` 冲突。
- 行内（后缀）方式使单个条目保持单个条目。
- 默认 = 提取，意味着没有标记的现有页面仍然有效。

**Frontmatter 摘要：** 可选地在页面级别呈现大致比例，以便用户无需阅读即可扫描推测密集的页面：

```yaml
provenance:
  extracted: 0.72   # 无标记句子/条目的大致比例
  inferred: 0.25
  ambiguous: 0.03
```

这些是摄取技能在创建/更新时写入的尽力而为数字。`wiki-lint` 会重新计算它们并标记偏差。该块是可选的——没有它的页面按约定视为完全提取。

## 10. 类型化关系

页面正文中的普通 `[[wikilinks]]` 不携带语义权重——它们表示"相关"但不表示*如何*相关。可选的 `relationships:` frontmatter 块为知识图谱添加类型化的、有方向的边。

```yaml
relationships:
  - target: "[[concepts/transformer-architecture]]"
    type: extends
  - target: "[[concepts/lstm]]"
    type: contradicts
  - target: "[[concepts/attention-mechanism]]"
    type: implements
```

每个条目有两个必需字段：`target`（一个 wikilink）和 `type`（以下允许的语义类型之一）。

| 类型 | 含义 | 示例 |
|---|---|---|
| `extends` | 本页面建立在目标之上或对其进行概括 | GPT 扩展了 Transformer Architecture |
| `implements` | 本页面是目标概念的具体实现 | BERT 实现了 Masked Language Modelling |
| `contradicts` | 本页面的论断与目标冲突或反驳 | 证据 A 与证据 B 矛盾 |
| `derived_from` | 本页面基于目标或改编自目标 | Fine-tuning 源自 Transfer Learning |
| `uses` | 本页面依赖或使用目标 | RAG 使用 Vector Databases |
| `replaces` | 本页面取代或弃用目标 | GPT-4 取代 GPT-3 |
| `related_to` | 兜底：相关但没有更强的有向类型适用 | 概念 A 与概念 B 相关 |

规则：可选字段；不要重复行内 wikilink；方向是页面作为源 → 目标；不要捏造。有疑问时，使用 `related_to` 或省略。

读取 `relationships:` 的技能：`cross-linker`（在推断链接时写入类型化条目）、`wiki-query`（可在答案中呈现类型）、`wiki-status`（洞察模式报告关系覆盖率）。

## 11. 置信度与生命周期

每个页面携带两个正交的信任信号加一个可选的替代链接。

```yaml
base_confidence: 0.65          # [0.0, 1.0] — 时间无关的质量估计。
lifecycle: draft               # draft | reviewed | verified | disputed | archived
lifecycle_changed: 2024-03-15
# lifecycle_reason: "..."      # 可选自由文本 — 状态变更原因
# superseded_by: "[[new-page]]" # wikilink; 仅当 lifecycle=archived 时
```

这些也镜像为 `custom-base-confidence`、`custom-lifecycle`、`custom-lifecycle-changed`、`custom-superseded-by`，以便 `wiki-query` 可以用纯 SQL 按生命周期过滤。

### 置信度公式

```
base_confidence = source_count_score * 0.5 + source_quality_score * 0.5
source_count_score   = min(distinct_source_ids / 3, 1.0)
source_quality_score = avg(quality score per distinct source_id)
```

**来源质量评分**（使用最高匹配的分桶）：

| 分桶 | 分数 | 示例 |
|---|---|---|
| `paper` | 1.0 | arXiv、会议论文 |
| `official` | 0.9 | `*.gov`、厂商文档 |
| `documentation` | 0.85 | 维护良好的第三方文档 |
| `book` | 0.8 | 书籍、技术参考 |
| `repository` | 0.75 | GitHub README、代码库 |
| `blog` | 0.55 | 个人博客 |
| `session_transcript` | 0.5 | 对话历史 |
| `forum` | 0.4 | Stack Overflow、HN、Reddit |
| `unknown` | 0.4 | 兜底 |
| `llm_generated` | 0.3 | LLM 自我反思 |

**source_id** 是每个来源的稳定标识符——防止将同一博客的三份副本计为三个不同来源：

| 来源类型 | source_id 规则 |
|---|---|
| 学术论文 | DOI > arXiv ID > `<author>-<year>-<slug>` |
| GitHub 仓库 | `github.com/<owner>/<repo>` |
| 文档站点 | `<canonical-host>/<product>` |
| 博客文章 | `<host>/<author>` |
| 会话记录 | `<agent>/<session-id>` |
| 其他 | `<canonical-url>` |

**各技能默认值**（摄取技能自动计算）：

| 技能 | base_confidence | lifecycle |
|---|---|---|
| `ingest-url` | `0.17 + 0.5 × classify(url)` | `draft` |
| `wiki-ingest`（单文档） | 按来源分类器 | `draft` |
| `wiki-ingest`（多文档） | `min(N/3,1)×0.5 + avg_q×0.5` | `draft` |
| `wiki-research` | 可变，通常 0.85+ | `draft` |
| `wiki-capture` | 0.42 | `draft` |
| `*-history-ingest` | 0.42 | `draft` |
| `wiki-update` | 0.59 | `draft` |
| `wiki-synthesize` | `min(input_pages.base_confidence)` | `draft` |
| `data-ingest` | 0.37 | `draft` |

### 生命周期状态机

五个状态。**`stale` 不是状态**——它是计算叠加层：`is_stale = (today − updated) > 90 天`。

| 状态 | 进入方式 | 说明 |
|---|---|---|
| `draft` | 任何摄取技能首次写入 | 所有新页面的默认值 |
| `reviewed` | 仅人工编辑 | |
| `verified` | 仅人工编辑 | 时间本身不会降级已验证页面 |
| `disputed` | 仅人工编辑 | 在显示中覆盖除 `archived` 外的所有状态 |
| `archived` | 人工编辑，或摄取技能设置 `superseded_by` | 终态 |

只有摄取技能设置 `draft`。所有其他转换需要人工编辑。每当状态变更时更新 `lifecycle_changed`（以及对应的 `custom-lifecycle-changed` 属性）。

## 12. 重要性分层

`tier:` 字段控制每次摄取遍历更新哪些页面及其在检索中的优先级。

| 层级 | 含义 | 摄取行为 | 查询优先级 |
|---|---|---|---|
| `core` | 承重页面——许多其他页面依赖它们。始终值得更新。 | 如果来源哪怕稍微相关就更新 | 在索引和全读遍历中首先呈现 |
| `supporting` *（默认）* | 连接度中等的标准 wiki 页面 | 当来源对此页面有明确新论断时更新 | 标准优先级 |
| `peripheral` | 低连接度页面——很少被链接、范围窄 | 除非来源*主要*关于此主题，否则跳过 | 最后手段；在裁剪到上下文预算时跳过 |

### 分配规则

- **新页面：** 默认 `tier: supporting`
- **提升为 `core`：** 当页面累积 ≥5 个入站 wikilink（通过 `search get_backlinks` 计算）**或**被 `wiki-status` 洞察模式标记为桥接节点
- **降级为 `peripheral`：** 当页面有 ≤1 个入站链接且 90+ 天未更新
- **人工覆盖始终优先**——手动编辑 `tier:`（并重新运行 `set_page_attrs`）以将页面锁定在任何级别
- 没有 `tier:` 的现有页面视为 `supporting`（向后兼容）

### 谁管理 tier

- `wiki-ingest` 读取 `custom-tier` 以决定是否在当前遍历中更新页面
- `wiki-query` 使用 `custom-tier` 对索引遍历中的候选页面排序并裁剪到上下文预算
- `wiki-status` 洞察模式计算图谱指标并**建议** tier 分配——它从不自动写入
- `wiki-lint` 标记新创建页面上缺失的 `tier`

## 13. 检索原语（读取侧成本阶梯）

读取笔记本是每个读取侧技能的主要成本。使用能回答问题的最廉价原语，并**仅在较廉价原语不足时升级**。任何需要从 wiki 获取内容的技能都应遵循此表，而不是直接跳到 `read_page`。

| 需求 | 原语 | 相对成本 |
|---|---|---|
| 页面是否存在？标题/类别/标签/摘要是什么？ | `query_sql --stmt "SELECT id, hpath, name, ial FROM blocks WHERE type='d' AND box='$SIYUAN_NOTEBOOK_ID' AND hpath LIKE '/concepts/%' LIMIT 200"`（从 `ial` 列解析 `custom-*`） | **最廉价** |
| 页面摘要预览 | 同 SQL，从 `ial` 提取 `custom-summary` | **廉价** |
| 匹配某标签的所有文档 | `query_sql --stmt "SELECT id, hpath, ial FROM blocks WHERE type='d' AND box='$SIYUAN_NOTEBOOK_ID' AND ial LIKE '%custom-tags=%foo%' LIMIT 200"` | **廉价** |
| 概念级全文搜索 | `search fulltext --query "..."`（BM25 风格，服务端索引） | **中等** |
| 页面的所有反向链接 | `document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "<hpath>"` 然后 `search get_backlinks --id <id> --mode both` | **中等** |
| 页面的特定段落 | `fs read --path "/$SIYUAN_NOTEBOOK_NAME/<hpath>"` 然后定位；CLI 自动分页 | **中高** |
| 整页内容 | `fs read --path "/$SIYUAN_NOTEBOOK_NAME/<hpath>"` | **昂贵——最后手段** |
| Wikilink 图遍历 | 从已知页面遍历 `get_backlinks`；结合 `query_sql` 获取出站链接 | 视情况而定 |

**`query_sql` 的两条不可协商不变式：**

1. **始终包含 `box='$SIYUAN_NOTEBOOK_ID'`。** 没有它，如果任何*其他*打开的笔记本缺少读取权限，思源权限过滤器会剥离你的整个结果集。症状：`Filtered Out Count: N, Reason: permission_filtered, Total: 0`。修复方法从来不是"请求更多权限"——而是"将查询范围限定到 wiki 笔记本"。
2. **始终包含 `LIMIT`。** 即使廉价查询也可能在成熟 wiki 上返回数千行。索引遍历用 `LIMIT 200`，枚举用 `LIMIT 500`，单文档查询用 `LIMIT 1`。

**规则：** 仅当较廉价的原语无法回答问题时才升级。如果能仅从 `custom-summary` 回答，就不要读页面正文。如果 `search_fulltext` 返回了正确的片段，就不要读整页。

**为什么这很重要：** 思源的索引使查询成本在笔记本从 20 个文档增长到 2000 个时大致保持平坦。绕过索引的技能（例如全读后 grep 循环）会退化这一特性。上述原语是框架可扩展的方式。

消费此表的技能：`wiki-query`、`cross-linker`、`wiki-lint`、`wiki-status`（洞察模式）。任何读取 wiki 的新技能都应引用此部分而非重新发明模式。

### 校准说明 — `siyuan-sisyphus 0.1.13` 实况

上面的检索阶梯描述了*预期*的成本模型。通过在 `siyuan-sisyphus 0.1.13` 上进行端到端测试（一个包含 16 个已摄取页面加上 cross-linker 遍历的 hive-method 笔记本）发现的十种行为偏离了朴素预期，本框架中的每个技能都必须绕过它们：

1. **`document set-attr` 不会写入 `custom-*` 属性。** 尽管名称和 `siyuan-sisyphus help document set-attr` 显示的示例（`--attrs-json '{"custom-mcp":"demo"}'`），实际实现拒绝除 `icon` 和 `cover` 之外的所有属性，返回 `validation_error: Provide at least one of attrs.icon or attrs.cover`。要写入 `custom-*` 文档级属性（整个 frontmatter 镜像故事），改用 **`block set-attrs --id <doc-id> --attrs '{...}'`**。`block set-attrs` 接受任意 `custom-*` 键且无抱怨，它们在 `block get-attrs` 和 `block info` 输出中正确显示。

2. **`document lookup --json` 返回 `idPath.path`，而非 `id`。** 查询响应的形状是 `{"humanPath": {...}, "idPath": {"notebook": "<box-id>", "path": "/[parent-path/]<doc-id>.sy"}}`。文档 ID 是 `idPath.path` 的基本名去掉 `.sy` 后缀。正确提取：`jq -r '.idPath.path' | awk -F/ '{print $NF}' | sed -E 's|\.sy$||'`。没有顶层 `.id` 字段。

3. **`SELECT COUNT(*) FROM blocks WHERE box='<id>'` 触发 `permission_filtered`。** 聚合查询返回单行，权限过滤器无法将其绑定回特定笔记本，因此保守地剥离结果。**变通方法：**`SELECT id FROM blocks WHERE ... LIMIT N` 并在客户端计算 `data.length`。对于大型注册表，用 `LIMIT 1000 OFFSET <k>` 分页直到页面返回少于 1000 行。

4. **`SELECT ... ial ... WHERE ... ial LIKE '%custom-X=...%'` 即使 `block get-attrs` 确认属性存在也返回空。** `ial` SQL 列不包含 `custom-*` 块级属性；这些存在于 SQL 接口未暴露的单独 `attributes` 表中。**变通方法：**先发出结构查询（`SELECT id, hpath FROM blocks WHERE type='d' AND box='<id>' AND hpath LIKE '/<cat>/%'`），然后对每行调用 `block get-attrs --id <doc-id>` 来读取 `custom-*`。对于大型注册表，这是 `O(N)` 次额外调用——但每行成本很小，替代方案（读取每个页面正文）更糟。

5. **`fs read` 在刚写入的页面上显示两个 YAML frontmatter 块。** 思源自动在写入的 markdown 正文上方添加默认的 `--- title: ... date: ... lastmod: ... ---` frontmatter 块。如果你的正文本身以 `---` 开头，结果是两个堆叠的 frontmatter 块（思源生成的然后是用户写的）。这无害——第二个块被思源解析为内容文本，但通过 `fs read` / `fs write` 原样保留。如果你的技能只需更新用户写的 frontmatter，搜索*第二个* `---` 块，而非第一个。

6. **思源从文档名称自动生成文档标题；正文中的前导 `# Title` 行会变成重复。** 每个思源文档已有标题（文件名 / hpath 基本名），编辑器将其渲染为页面顶部的 0 级标题。如果你写入的 markdown 正文以 `# Some Title` 开头，渲染的页面会显示两个堆叠的标题——思源的自动标题和你的。在我们的端到端测试中，这导致每个摄取页面的 `# git-ai技术全景` 被重复。**写入类技能的硬性规则：**在写入前从来源正文中去除前导 `#`/`##` 标题。如果你在摄取外部 markdown，用正则去除第一个 `^#\s+.+\n` 行。如果你在创作新页面，根本不要写 `# Title` 行——让思源从文档名生成它。

   结合 bug 5：写入类技能也**不应在正文中包含 YAML frontmatter `---` 块**。Frontmatter 镜像完全通过 `block set-attrs --id <doc-id> --attrs '{"custom-title":"...","custom-tags":"...",...}'` 完成，而非在正文中。需要人类可读摘要行的页面应将其作为正文的第一段（无前导 `#` 和无前导 `---`）。

7. **思源不解析 `[[wikilink]]` markdown——只有块引用 `((doc-id "anchor text"))` 显示为边。** 尽管历史上假设思原生解析 `[[hpath/to/page]]`，端到端测试显示写入页面正文的 `[[...]]` 从不出现在 `search get_backlinks` 中，从不填充 SQL `refs` 表，也从不在全局图谱视图中绘制边。唯一产生真实边的语法是思源原生块引用：`((<20-char-doc-id> "display text"))`（括号-括号、文档 ID、双引号显示文本、括号-括号）。构建知识图谱的写入类技能（`cross-linker`、`wiki-ingest` 类型化关系部分、任何将 `relationships:` frontmatter 镜像到正文链接的技能）必须发出 `((id "text"))` 形式。显示文本是必需的——没有它编辑器会显示原始 ID。文档 ID 来自运行开始时构建的注册表（`SELECT id, hpath FROM blocks WHERE type='d' AND box='<id>'`）。

8. **`hpath NOT LIKE '/_%'` 返回空结果而非"除 `/_meta`、`/_raw` 等之外的所有文档"。** 以 `/_` 开头的模式的 SQL `NOT LIKE` 触发相同的保守权限过滤器，可能是因为思源内部标记元路径的方式。变通方法：用 `SELECT id, hpath FROM blocks WHERE type='d' AND box='<id>' LIMIT 5000` 拉取完整 `hpath` 列表并在客户端过滤 `not hpath.startswith('/_')`。与 bug 3 相同的变通原则——有疑问时，拉取并在客户端过滤。

9. **SELECT 列列表——不仅仅是 WHERE 子句——控制权限过滤器。** 每个表有一个*身份列*必须出现在投影中，结果才能通过 permission_filtered。这是套件中最令人惊讶的偏差：添加 `WHERE box='<notebook-id>'` 是必要但不充分的。权限层在返回每行之前将其绑定回笔记本，绑定通过检查投影输出中的一个特定列来完成。如果该列缺失，该行被丢弃（元数据中有 `Filtered Out Count: N`）。

   每个表的身份列：

   | 表 | 身份列 | 等效通过 |
   |---|---|---|
   | `blocks` | `id` *或* `box` | `SELECT *`、`SELECT id, ...`、`SELECT box, hpath` 等 |
   | `refs` | `root_id` | `SELECT *`、`SELECT root_id, def_block_id, block_id` 等 |
   | `spans`、`assets` | （可能是 `root_id`；尚未验证） | `SELECT *` 始终安全 |

   具体示例（在 `siyuan-sisyphus 0.1.13` 上对 hive-method 笔记本端到端验证）：

   ```
   # 失败：仅 hpath，无身份列
   SELECT hpath FROM blocks WHERE box='<id>' AND type='d' LIMIT 3
   # -> Filtered Out Count: 3, Total: 0

   # 成功：包含 id
   SELECT id FROM blocks WHERE box='<id>' AND type='d' LIMIT 3

   # 成功：id + 任意其他列
   SELECT id, hpath, name FROM blocks WHERE box='<id>' AND type='d' LIMIT 3

   # 成功：box 本身算（它是绑定列）
   SELECT box, hpath FROM blocks WHERE box='<id>' AND type='d' LIMIT 3

   # refs 上失败：无 root_id
   SELECT def_block_id, block_id FROM refs WHERE box='<id>' LIMIT 5
   # -> Filtered Out Count: 5, Total: 0

   # refs 上成功：包含 root_id
   SELECT def_block_id, block_id, root_id FROM refs WHERE box='<id>' LIMIT 5
   ```

   **经验法则：** 在 `blocks` 投影中始终包含 `id`，在 `refs` 投影中始终包含 `root_id`，`SELECT *` 始终安全（只是冗长）。`WHERE box='<id>'` 谓词仍然必需（没有它，在检查身份列之前整个结果集就被丢弃了），但列列表要求是独立的、额外的。

10. **新建思源笔记本的权限为 `r`（只读），而非 `rw` 或 `rwd`。** `notebook create` 返回成功，但 `fs write` 立即失败并报权限错误。用户必须手动打开思源桌面 UI，右键单击笔记本，授予 `rwd`（或至少 `rw`），然后任何摄取技能才能继续。这是不可协商的——没有 CLI 可提升权限。`wiki-setup` 必须在创建新笔记本后停止并提示人工执行此步骤，然后仅在 `notebook get-permissions --id <new-id>` 确认 `rwd` 后恢复。

这十种 CLI/引擎行为组合成写入类技能的三条硬性规则：**(a) 规范的"两次调用写入模式"是 `fs write --overwrite`（仅正文——无 frontmatter、无前导 H1）后跟 `block set-attrs`（而非 `document set-attr`）写入所有元数据**；**(b) 规范的"分层检索"遍历是 `query_sql ... WHERE box='<id>'` 用于 hpath 形态过滤加上 `block get-attrs` 逐文档读取属性（绝不用单个 `query_sql ... WHERE ial LIKE ...`，绝不用 `NOT LIKE '/_%'`，绝不用 `COUNT(*)`）**；**(c) wiki 页面之间的所有知识图谱边以 `((doc-id "display text"))` 块引用形式写入，绝不以 `[[wikilink]]`——只有前者产生真实的 `refs` 表行和图谱视图边**。

## 14. 核心原则

1. **编译，而非检索。** wiki 是预编译的知识。当你摄取来源时，更新每个相关页面——不要只创建来源摘要。
2. **随时间增值。** 每次摄取应使 wiki 更聪明，而非仅更大。将新信息合并到现有页面中，解决矛盾，加强交叉引用。
3. **来源很重要。** 每个论断都应追溯到来源。更新页面时，注明哪个来源促使了更新。
4. **标记推断。** 默认句子是提取的。用 `^[inferred]` 标记综合论断，用 `^[ambiguous]` 标记有争议的论断。隐藏猜测的 wiki 会静默腐烂；标记猜测的 wiki 保持可信。
5. **人类策展，LLM 维护。** 人类决定添加什么来源和提出什么问题。LLM 处理簿记工作——更新交叉引用、维护一致性、记录矛盾。
6. **思源是查看器。** 用户在思源中浏览和探索 wiki。一切都必须是有效的思源 markdown，带有可用的 `[[wikilinks]]`。Frontmatter 保留在正文中以安全迁移；`custom-*` 属性镜像它供索引查询。
7. **CLI 是唯一门户。** 每次读取和写入都通过 `siyuan-sisyphus`。禁止对笔记本进行原始文件系统访问。

## 15. 链接格式

wiki 页面之间的所有内部链接以**思源原生块引用**形式写入：

```
((<20-char-doc-id> "display text"))
```

示例：`((20260525220644-9rpxnqo "git-ai 技术全景"))`。

这是唯一产生真实边的语法：它填充 SQL `refs` 表，在 `search get_backlinks --id <id>` 中显示，并在思源全局关系图中绘制线条。普通 markdown `[[wikilink]]` *不被* 思源解析——尽管这是一个常见假设——见 §13 校准说明 7。

解析文档 ID：

1. 在任何链接写入遍历开始时，构建注册表：`siyuan-sisyphus search query_sql --sql "SELECT id, hpath FROM blocks WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>' LIMIT 5000"`。
2. 一次性映射 `hpath` → `id`。为每次替换重用此映射。
3. 显示文本是你要在正文中呈现的任何短语——通常是页面标题或链接术语在上下文中出现的表面形式。

遗留的 `SIYUAN_LINK_FORMAT` 配置旋钮（`wikilink` / `markdown`）现在仅供参考——两个值映射到相同的块引用输出。技能仍应读取该值（以便未来重新激活成本低），但绝不为正文内容分支。frontmatter 镜像中的 `relationships:` 部分也使用块引用形式：`target: ((20260525220644-9rpxnqo "git-ai 技术全景"))`。

`fs read` 原样返回 `((id "text"))` 语法，因此基于正则的扫描器（在 `cross-linker`、`wiki-lint`、`wiki-status` 中）用模式 `\(\(([0-9]{14}-[a-z0-9]{7})\s+"([^"]+)"\)\)` 提取出站链接。

当需要将链接插入现有散文时：

- 标记化正文，遮蔽围栏代码块（`\`\`\`...\`\`\``）和行内代码（`` `...` ``），使锚匹配不会在代码内替换。
- 找到锚短语（或其别名之一——见 `cross-linker` 的 `ALIAS_MAP` 机制）的第一个自然语言出现。
- 从右到左应用替换，使较早位置不被较后插入的长度差异所无效。
- 将每页链接数限制在小数量（默认：8-10）以防止视觉噪音，并按目标 ID 去重（每页每目标一个链接足够；图谱边只计一次）。

## 16. 配置解析协议

**所有技能必须使用此算法解析配置——不要直接硬编码 `.env` 或 `~/.siyuan-wiki/config`。** 这确保单笔记本、多笔记本、项目本地和远程思源设置都能正确工作。

### 解析顺序

1. **从 CWD 向上遍历**——在当前目录中查找 `.env` 文件，然后每个父目录，直到 `$HOME`。在第一个包含 `SIYUAN_NOTEBOOK_ID` 的 `.env` 处停止。
2. **全局配置**——如果未找到本地 `.env`，读取 `~/.siyuan-wiki/config`。
3. **提示设置**——如果两者都不存在，告诉用户："未找到配置。请运行 `wiki-setup` 来初始化你的 wiki。"

```
find_config() {
  dir="$PWD"
  while [[ "$dir" != "$HOME" && "$dir" != "/" ]]; do
    [[ -f "$dir/.env" ]] && grep -q "SIYUAN_NOTEBOOK_ID" "$dir/.env" && { echo "$dir/.env"; return; }
    dir="$(dirname "$dir")"
  done
  [[ -f "$HOME/.siyuan-wiki/config" ]] && { echo "$HOME/.siyuan-wiki/config"; return; }
  echo ""
}
```

加载配置后，`SIYUAN_NOTEBOOK_ID` 和 `SIYUAN_NOTEBOOK_NAME` 必须都已设置。技能不得从一个推导另一个（运行时 `notebook list` 查询会破坏在 `.env` 中固定 ID 的目的，并重新引入同名冲突风险）。

### 预检（写入类技能必需）

解析配置后，每个写入类技能（任何调用 `fs write`、`block append`、`block set-attrs`、`fs mv`、`fs rm` 的技能）必须在 `SIYUAN_PRECHECK=false` 时跳过预检之外运行预检：

```
siyuan-sisyphus --version
siyuan-sisyphus notebook get-permissions --notebook "$SIYUAN_NOTEBOOK_ID"
```

版本检查确认 CLI 可达。权限检查确认 (a) 笔记本 ID 仍然存在且 (b) 写入类技能的权限级别为 `rwd`（或只读技能如 `wiki-query` 和 `wiki-status` 为 `r`/`rw`/`rwd` 中的任意一个）。

失败时，停止并引导用户使用 `siyuan-sisyphus` CLI 的 `init` / `config` 命令（`siyuan-sisyphus init`、`siyuan-sisyphus config list`）。**不要静默回退到文件系统写入**——那会在笔记本之外创建文件。

**读取类技能**（`wiki-query`、`wiki-status` 非洞察模式、`wiki-context-pack`）可以在 `SIYUAN_PRECHECK=false` 时跳过预检并仍然执行读取——但它们必须在每个 `query_sql` 中添加 `WHERE box='$SIYUAN_NOTEBOOK_ID'`（见 §13）。

### 笔记本级状态

写入运行时状态的技能（如 `daily-update`）必须将状态限定到已解析的笔记本 ID：

```
STATE_DIR="$HOME/.siyuan-wiki/state/$SIYUAN_NOTEBOOK_ID"
```

笔记本 ID 已经是稳定的、无冲突的键——不需要 md5 派生。

### 标准"开始之前"块

每个技能的设置部分应如下：

> **解析配置 + 预检**——遵循 `llm-wiki/SKILL.md` 中的配置解析协议。从 CWD 向上查找 `.env`，回退到 `~/.siyuan-wiki/config`，否则提示设置。这会得到 `SIYUAN_NOTEBOOK_ID`（用于 `--notebook` 和 `query_sql ... WHERE box=`）、`SIYUAN_NOTEBOOK_NAME`（用于 `fs *` 路径）和任何工具特定的路径覆盖。然后运行 `siyuan-sisyphus --version` 和 `notebook get-permissions --notebook "$SIYUAN_NOTEBOOK_ID"`；失败则停止。

## 17. 环境变量

wiki 通过环境变量配置（见 `.env.example`）。两个必需变量是笔记本 ID 和名称；其他所有变量都有合理的默认值。

- `SIYUAN_NOTEBOOK_ID` — **（必需）** 笔记本 ID（如 `20241205084226-rl6jd3a`）。用于 `--notebook` 参数、`query_sql ... WHERE box='<id>'`、`document lookup`、`document create`、`notebook get-permissions`。不可变；笔记本重命名后仍然有效。
- `SIYUAN_NOTEBOOK_NAME` — **（必需）** 笔记本名称（如 `模型代理`）。用于 `fs *` 工作区路径（需要名称作为第一段，如 `/模型代理/index`）和面向人类的日志行/错误消息。如果用户在思源 UI 中重命名笔记本可能会变化；`setup.sh` 在每次运行时警告过期。
- `SIYUAN_SOURCES_DIR` — 包含待摄取文档的文件系统源目录
- `SIYUAN_CATEGORIES` — 逗号分隔的类别子树列表
- `SIYUAN_MAX_PAGES_PER_INGEST` — 每次摄取最多更新的页面数（默认 15）
- `SIYUAN_PROFILE` — 覆盖 `siyuan-sisyphus` 配置文件（多笔记本工作流）
- `SIYUAN_PRECHECK` — 在写入类技能前运行预检（默认 `true`）
- `SIYUAN_LINK_FORMAT` — 内部链接语法：`wikilink`（默认）或 `markdown`
- `SIYUAN_RAW_DIR` — 未处理捕获的子树路径（默认 `_raw`）
- `CLAUDE_HISTORY_PATH` — 查找 Claude 对话数据的位置
- `WIKI_TOKEN_WARN_THRESHOLD` — `wiki-status` 中全笔记本 token 估算的警告阈值（默认 `100000`；`0` 禁用）
- `WIKI_STAGED_WRITES` — 当为 `true` 时，所有 LLM 写入的页面进入 `/<notebook>/_staging/<category>/` 供人工审查后再提升。详见 `wiki-setup` 和 `wiki-stage-commit`。

`.env` 中不需要 API 密钥——`siyuan-sisyphus` 从其自己的配置文件（`~/.config/siyuan-sisyphus/config.toml`）读取思源 API 端点。

## 18. 操作模式

wiki 支持三种摄取模式：

| 模式 | 使用时机 | 发生什么 |
|---|---|---|
| **追加** | 小增量、增量更新 | 通过 manifest 计算增量，只摄取新增/修改的来源 |
| **重建** | 严重偏移、需要全新开始 | 将当前类别子树 `archive_subtree` 到 `/<notebook>/_archives/<timestamp>/`，清空，重新处理所有来源 |
| **恢复** | 需要回退 | 将文档从之前的归档子树 `move_page` 回根目录 |

使用 `wiki-status` 查看增量并获取建议。使用 `wiki-rebuild` 进行归档/重建/恢复操作。**三种模式都使用 `fs mv`，从不使用 `fs rm`**——不删除任何内容，只移动到 `_archives/` 下。

## 19. 参考

有关具体操作的详细信息，请参阅配套技能：

- **wiki-status** — 审计已摄取内容、计算增量、建议追加 vs 重建
- **wiki-rebuild** — 归档当前文档、从零重建或从归档恢复
- **wiki-ingest** — 将源文档蒸馏为 wiki 页面
- **wiki-query** — 使用上述成本阶梯对 wiki 进行问答
- **wiki-lint** — 审计和维护 wiki 健康
- **wiki-setup** — 初始化新笔记本
- **claude-history-ingest** — 将 Claude 对话和记忆挖掘为 wiki 页面
- **data-ingest** — 摄取任何原始文本数据
- **cross-linker** — 自动发现和插入缺失的 wikilink（使用 `query_sql` 进行候选扫描和 `get_backlinks` 进行验证）
- **tag-taxonomy** — 在页面间强制一致的标签词汇表
