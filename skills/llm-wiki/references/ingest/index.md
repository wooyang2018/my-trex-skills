# wiki-ingest — 统一知识蒸馏入口

> **链接格式**（根据 `references/constitution.md` §15 + §13 校准说明 7）：wiki 页面之间的所有内部链接以思源原生块引用 `((<doc-id> "display text"))` 形式发出。思源**不**解析 `[[wikilink]]` markdown；只有块引用填充 `refs` 表、反向链接索引和全局图谱视图。通过 `SELECT id, hpath FROM blocks WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>' LIMIT 5000` 一次性解析文档 id。

你正在将知识蒸馏到思源 wiki 中。本技能是所有知识获取和综合的统一入口。你的工作不是摘要——而是**蒸馏和整合**整个 wiki 的知识。每次 wiki 写入都通过 `siyuan-sisyphus` 进行。

## 分发 — 来源类型 / 操作路由

从用户措辞和来源类型推断模式：

| 用户意图 / 来源类型 | 模式 | 详情 |
|---|---|---|
| 文件/目录（PDF、Markdown、文本、图片） | **文档摄取** | → `core.md`（默认主流程） |
| URL / "添加此链接" / "摄取此 URL" | **URL 摄取** | → `modes.md` |
| 聊天导出、日志、CSV、JSON 转储、非结构化文本 | **数据摄取** | → `modes.md` |
| "保存这个对话" / "/wiki-capture" / "捕获这个" | **对话捕获** | → `modes.md` |
| "/wiki-history-ingest claude" / "导入我的 Claude 历史" | **历史导入** | → `modes.md` |
| "处理我的草稿" / "提升我的原始页面" / `/_raw/` 引用 | **原始模式** | → `core.md` §摄取模式 |
| "综合我的 wiki" / "发现连接" / "发现综合缺口" | **内部综合** | → `synthesis.md` |
| "研究 X" / "自主研究" / "深入调查 X" | **外部研究** | → `synthesis.md` |
| 未指定 | 询问用户来源类型 | — |

## 开始之前

1. **解析配置 + 预检**——遵循 `references/constitution.md` 中的配置解析协议。从 CWD 向上查找 `.env` → `~/.siyuan-wiki/config` → 提示设置。这会得到 `SIYUAN_NOTEBOOK_ID`（用于 `--notebook` 和 `query_sql ... WHERE box=`）、`SIYUAN_NOTEBOOK_NAME`（用于 `fs *` 路径）、`SIYUAN_SOURCES_DIR`、`SIYUAN_LINK_FORMAT`（仅供参考——正文链接始终是块引用；见 §15）、`SIYUAN_RAW_DIR`（默认 `_raw`）和 `WIKI_STAGED_WRITES`。然后运行 `siyuan-sisyphus --version` 和 `siyuan-sisyphus notebook get-permissions --notebook "<SIYUAN_NOTEBOOK_ID>"`；失败或权限不是 `rwd` 时停止（这是写入类技能——**不要**静默回退到文件系统写入；那会在笔记本之外创建文件）。
2. **检查 `WIKI_STAGED_WRITES`**——如果为 `true`，所有新建和更新的类别页面进入 `/<notebook>/_staging/<category>/<slug>` 而非最终 hpath。在开始时告诉用户："暂存写入模式已启用——页面将进入 `_staging/` 供你审查。准备好后运行 `/wiki-stage-commit` 提升。"
3. **读取 manifest** 以了解已摄取的内容：`siyuan-sisyphus fs read --path "/<SIYUAN_NOTEBOOK_NAME>/_meta/manifest"`，去除 ` ```json … ``` ` 围栏并解析。如果文档不存在，视为全新——但仍不要跳过 wiki-setup；告诉用户先运行 `/wiki-setup`。
4. **读取索引** 以了解当前 wiki 内容：`fs read --path "/<SIYUAN_NOTEBOOK_NAME>/index"`。
5. **读取日志** 以了解近期活动：`fs read --path "/<SIYUAN_NOTEBOOK_NAME>/log"`（只读足够部分——最后 50 行）。内部综合和外部研究模式还需读取 `/<SIYUAN_NOTEBOOK_NAME>/hot` 获取近期活动上下文。

## 模块导航

| 模块 | 内容 | 何时查阅 |
|---|---|---|
| `core.md` | 核心蒸馏引擎：内容信任边界、三种摄取模式、步骤 1-7、质量检查清单、知识提取框架 | 文档摄取、原始模式——主流程 |
| `modes.md` | 特殊摄取模式：URL 摄取、数据摄取、对话捕获、历史导入 | 路由表指向时 |
| `synthesis.md` | 综合发现 + 自主研究：内部共现分析、外部多轮研究 | 路由表指向时 |
