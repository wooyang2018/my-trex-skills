# AI Agent 协作守则

本文档面向与 my-trex-skills 插件协作的 AI Agent（Claude Code / CodeBuddy），定义工作约定和安全边界。

本插件包含三层能力：
1. **底层 CLI 操作** — `siyuan-sisyphus` 技能提供思源笔记 CLI 的完整参考
2. **知识库引擎** — `llm-wiki` + 8 个 wiki 技能提供基于 Karpathy LLM Wiki 模式的知识蒸馏系统
3. **网页提取** — `defuddle` 技能提取干净 Markdown

---

## 插件总览

### 基础工具

| 技能 | 触发场景 | 核心能力 |
|------|----------|----------|
| **defuddle** | 用户提供 URL 需阅读/分析/摘要网页内容 | 从 HTML 页面提取干净 Markdown |
| **siyuan-sisyphus** | 用户要求操作思源笔记的任何内容/结构/元数据 | 通过 CLI 完成笔记本/文档/块/属性视图/搜索/标签/闪卡/Excalidraw 操作 |

### 知识库引擎（Wiki Skills）

基于 [Karpathy LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)，将知识"编译"而非"检索"。四阶段流水线：Ingest → Extract → Resolve → Schema。

| 技能 | 触发场景 | 核心能力 |
|------|----------|----------|
| **llm-wiki** | 理解 wiki 模式、存储协议、页面模板 | 三层架构 + 存储原语 + 页面模板（理论基石） |
| **wiki-setup** | "set up my wiki" / "初始化" / "切换笔记本" / "列出我的 wiki" | 创建笔记本结构、特殊文档、配置；管理多笔记本配置切换 |
| **wiki-ingest** | "ingest" / "add this to wiki" / "/ingest-url" / "/wiki-capture" / "/wiki-history-ingest" | 统一摄取入口——文档蒸馏、URL 获取、数据导入、对话捕获、历史导入 |
| **wiki-retrieval** | "what do I know about X" | 从 wiki 回答问题（分层检索） |
| **wiki-lint** | "audit" / "lint" / "日常更新" / "状态如何" / "wiki 洞察" | 健康审计 + 日常维护周期 + 状态审计 + 图谱洞察分析 |
| **wiki-graph** | "dedup" / "cross-link" / "fix my tags" / "color my graph" | 去重合并 + 交叉链接 + 标签分类法 + 图谱着色 |
| **wiki-report** | "create a dashboard" / "weekly digest" / "context pack" | SQL 仪表板 + 周/月摘要 + Token 受限上下文包 |
| **wiki-synthesis** | "synthesize my wiki" / "wiki-research" | 发现并填补综合缺口 + 自主多轮网络研究 |

---

## defuddle 触发条件

以下情形使用 defuddle 技能：

- 用户提供 URL 需要阅读、分析、总结
- 需要从网页提取文本内容
- 在线文档、文章、博客、教程、新闻页面

**不适用**：
- URL 以 `.md` 或 `.txt` 结尾 → 用 WebFetch
- 需要登录的页面 → 用 WebFetch 或告知用户
- PDF / 二进制文件 → 告知用户不支持

---

## siyuan-sisyphus 触发条件

以下情形使用 siyuan-sisyphus 技能：

- "看一下我的思源笔记"
- "在某个笔记本里创建文档"
- "改某个块的内容"
- "用 SQL 查思源"
- "把图贴进笔记"
- "给文档加标签"
- 任何与思源笔记内容、结构、元数据相关的需求

### 启动预检（每次会话首次使用前执行）

```bash
siyuan-sisyphus --version
siyuan-sisyphus config list
siyuan-sisyphus notebook list
```

---

## Wiki 知识库 — 存储宪法

所有 wiki 读写均通过 `siyuan-sisyphus` CLI 完成 — 禁止通过 `Read` / `Write` / `Glob` / `Grep` 直接访问笔记本目录。思源将文档存储为块树，由内嵌 SQLite 索引支撑；绕过索引的原始文件系统访问会破坏状态一致性。

### 配置解析协议

所有 wiki 技能使用统一配置解析：

1. **读取全局配置** — 从 `~/.siyuan-wiki/config` 读取所有配置项。这是唯一的配置来源。
2. **提示初始化** — 若配置不存在，提示用户运行 `wiki-setup`。

配置提供两个笔记本变量（均为必需，不可互相推导）：

- `SIYUAN_NOTEBOOK_ID` — 用于 `--notebook` 参数、`query_sql ... WHERE box='<id>'`、`document lookup` 等
- `SIYUAN_NOTEBOOK_NAME` — 仅用于 `fs *` 工作区路径（以笔记本名作为首段）和人可读日志

### 笔记本结构

```
$SIYUAN_NOTEBOOK_NAME (notebook root)
├── index                   # 主索引 — 每个页面都列出
├── log                     # 时间线活动日志（block append）
├── hot                     # 会话热缓存 — ~500 词语义快照
├── _meta/
│   ├── manifest            # 导入跟踪账本（JSON in code fence）
│   └── taxonomy            # 受控标签词汇
├── _insights               # 图分析输出
├── _raw/                   # 暂存子树 — 放入粗略笔记
├── _staging/               # 暂存审查队列（WIKI_STAGED_WRITES=true 时）
├── _archives/              # 归档快照
├── concepts/               # 抽象概念、模式、心智模型
├── entities/               # 具体事物 — 人、工具、库、公司
├── skills/                 # How-to 知识、技术、流程
├── references/             # 事实查询 — 规范、API、配置
├── synthesis/              # 跨来源综合分析
├── journal/                # 时间条目 — 日志、会话笔记
└── projects/
    └── <project-name>      # 每个项目一个文档（wiki-update 同步）
```

### 三条硬性写入规则

1. **整页重写用 `fs write --overwrite`。** 多行内容绝不使用 `block update`（会在首个换行处静默截断）。
2. **增量日志追加用 `block append --data-type markdown`。** 首次 `document lookup` 后将父文档 ID 缓存到 `_meta/manifest` 的 `cached_doc_ids` 中。
3. **Frontmatter 双写。** 文档体顶部保留 YAML frontmatter（为迁移/人类可读），同时通过 `block set-attrs` 镜像到 `custom-*` 属性（为 SQL 索引查询）。

### 写入模式 — 两步写入法

```
# 步骤 1：写正文（不含 frontmatter，不含 # 标题行）
siyuan-sisyphus fs write --path "/$SIYUAN_NOTEBOOK_NAME/concepts/my-page" \
  --markdown "正文内容..." --overwrite

# 步骤 2：写元数据（不是 document set-attr，是 block set-attrs）
siyuan-sisyphus document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/concepts/my-page"
# → 获取 doc-id
siyuan-sisyphus block set-attrs --id <doc-id> \
  --attrs '{"custom-title":"My Page","custom-tags":"a,b","custom-summary":"..."}'
```

### 检索原语 — 分层检索（成本递增）

| 需求 | 原语 | 相对成本 |
|------|------|----------|
| 页面是否存在？标题/标签/摘要？ | `query_sql ... WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d'` | **最便宜** |
| 按标签筛选页面 | `query_sql ... WHERE ial LIKE '%custom-tags=%foo%'`（注意：需配合 `block get-attrs`） | **便宜** |
| 全文搜索 | `search fulltext --query "..."` | **中等** |
| 反链查询 | `document lookup` → `search get_backlinks --id <id> --mode both` | **中等** |
| 整页内容 | `fs read --path "/$SIYUAN_NOTEBOOK_NAME/<hpath>"` | **最贵 — 最后手段** |

**query_sql 两条铁律：**
1. **必须包含 `box='$SIYUAN_NOTEBOOK_ID'`** — 不含则权限过滤器会丢弃全部结果。
2. **必须包含 `LIMIT`** — 成熟 wiki 可能有数千行。
3. **必须包含 identity column** — `blocks` 表需 `id`，`refs` 表需 `root_id`，否则行被权限过滤丢弃。

### 内部链接格式

wiki 页面之间的所有内部链接写为思源原生块引用：

```
((<20-char-doc-id> "display text"))
```

这是唯一能产生真实图边的语法 — 填充 `refs` 表、出现在 `get_backlinks` 中、在全局关系图中画线。`[[wikilink]]` markdown **不被** 思源解析为图边。

### 索引最终一致性

`fs write` 后，`search fulltext` 可能暂时找不到新内容。验证写入成功的正确方式：
- `fs read --path "<just-written-hpath>"` 直接读取验证
- 或 `document lookup --hpath "<just-written-hpath>"` 检查返回的 id

---

## 路径三种形态（铁律）

| 形态 | 用于 | 示例 |
|------|------|------|
| 工作区可读路径 | 全部 `fs` 动作 | `/笔记本名/目录/文档` |
| 笔记本本地 hpath | `document create --path`、`document lookup --hpath` | `/目录/文档` |
| 存储路径（`.sy`） | `document lookup` 返回值；`document create --parent-path` | `/20240318112233-abc123.sy` |

**绝对禁止：**
- 不要把工作区路径 `/笔记本名/...` 传给 `document create --path`
- 不要把存储路径传给 `document create --path`，只有 `--parent-path` 接受
- 需要 ID 或 storage 路径时，先 `document lookup` 解析

---

## 危险动作清单

执行以下动作前，**必须**用一句话向用户复述目标对象与影响，取得明确批准后再执行：

| 工具 | 需确认的动作 |
|------|-------------|
| `fs` | `rm`、`mv` |
| `document` | `move` |
| `block` | `move` |
| `search` | `find_replace` |
| `file` | `upload_asset`、`remove_unused_assets`、`delete_asset` |
| `tag` | `remove` |
| `flashcard` | `remove_card` |

**确认话术模板**：「准备执行 `<命令摘要>`，将影响 `<具体目标>`，是否继续？」

写类技能需要笔记本 `rwd` 权限；读类技能（`wiki-retrieval`、`wiki-lint` 的状态审计/洞察模式）接受 `r` / `rw` / `rwd` 任一。

---

## 工作约定

1. **所有思源操作通过 CLI 完成** — 不直接调用 HTTP API，不写自定义脚本
2. **脚本/链式调用** — 输出加 `--json`
3. **长文档/列表** — 加 `--page N --page-size 8000` 避免截断
4. **多行内容写入** — 用 `block append` / `block insert` / `fs write`，不要用 `block update`（会截断）
5. **Excalidraw 嵌入** — 走 `scripts/excalidraw_compose.py`（Python ≥ 3.8），不要手拼 base64
6. **wiki 页面必须有 custom 属性** — `custom-title`、`custom-category`、`custom-tags`、`custom-sources`、`custom-created`、`custom-updated`（同时镜像为 YAML frontmatter）
7. **知识图谱边用块引用** — `((doc-id "display text"))`，不用 `[[wikilink]]`

---

## References 导引

按需查阅对应参考文档（位于 `skills/siyuan-sisyphus/references/`）：

| 文件 | 何时打开 |
|------|----------|
| `browse-read.md` | 列笔记本、看文档树、读文档/块、解析 ID 与路径 |
| `create-edit.md` | 创建文档、追加/插入/更新块、改图标/封面/属性、日记 |
| `search-query.md` | 全文搜索、SQL、反链、引用、资源搜索、全局替换 |
| `database-av.md` | 属性视图（思源数据库）增列、增行、写单元格、渲染 |
| `file-export.md` | 上传资源、导出 markdown、抽取文档、未引用资源治理 |
| `tag-flashcard.md` | 标签管理与闪卡复习 |
| `system-config.md` | profile 管理、权限模式、故障排查 |
| `markup-guide.md` | 块引用、嵌入块、超级块、图表块、Callout、自定义属性 |
| `excalidraw-embed.md` | Excalidraw 矢量图嵌入完整流程 |
| `sql-reference.md` | 思源 SQL 表结构与常用查询模板 |

wiki 理论基石详见 `skills/llm-wiki/SKILL.md`（存储协议、原语表、页面模板、校准经验）。

---

## 故障快速排查

| 现象 | 对策 |
|------|------|
| 连不上 / 401 | `siyuan-sisyphus config list`，按 `system-config.md` 重设 profile |
| 命令字段不确定 | `siyuan-sisyphus help <tool> <action>` |
| 看不到笔记本 | `siyuan-sisyphus notebook get_permissions`，检查权限 |
| 刚写入搜不到 | 思源索引最终一致，稍候重试或按路径直接读 |
| defuddle 输出为空 | 页面可能需 JS 渲染，回退到 WebFetch |
| `query_sql` 返回空 | 检查是否遗漏 `box=` 条件或 identity column（`id`/`root_id`） |
| `document set-attr` 写不进 custom-* | 改用 `block set-attrs --id <doc-id>` |
| `block update` 多行截断 | 改用 `block append` / `block insert` / `fs write --overwrite` |
| 新笔记本 `fs write` 权限错误 | 新建笔记本默认 `r`，需在思源 UI 手动改为 `rwd` |
