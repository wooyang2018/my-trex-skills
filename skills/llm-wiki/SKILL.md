---
name: llm-wiki
description: >
  在思源笔记本中构建和维护 Karpathy 风格 LLM Wiki。只通过 siyuan-sisyphus
  CLI 访问思源；不支持其他笔记系统、本地 Markdown 仓库或绕过 CLI 的思源访问。
  当用户要初始化 wiki、摄取来源、基于 wiki 回答问题、处理 web 反馈审计、
  生成报告或维护知识图谱时使用。
---

# LLM Wiki — SiYuan CLI Knowledge Engine

这个技能维护一个存在于思源笔记本中的编译型知识库。原始来源是输入，wiki 页面是蒸馏产物；所有读写都走 `siyuan-sisyphus` CLI。

## 入口

| 用户意图 | 操作 | 读取 |
|---|---|---|
| 初始化、切换、检查笔记本结构 | `setup` | `references/setup.md` |
| 摄取文件、URL、对话、草稿、研究材料 | `ingest` | `references/ingest.md` + `references/writing.md` |
| “我知道 X 吗？”、“基于 wiki 回答” | `query` | `references/query.md` |
| 处理 web 里提交的反馈 | `audit` | `references/audit.md` |
| 周报、仪表板、上下文包、维护检查 | `report` / `maintain` | `references/report.md` / `references/maintain.md` |

只加载当前操作需要的 reference；不要一次性读完整个目录。

## 硬规则

1. **唯一访问层**：所有思源读写使用 `siyuan-sisyphus`。不要直接访问思源工作区文件，不要自写思源请求。
2. **配置解析**：从 CWD 向上找 `.env`，再读 `~/.siyuan-wiki/config`。必须得到 `SIYUAN_NOTEBOOK_ID` 和 `SIYUAN_NOTEBOOK_NAME`，二者不可互相推导。
3. **预检**：首次操作先运行 `siyuan-sisyphus --version`、`siyuan-sisyphus config list`、`siyuan-sisyphus notebook get_permissions --notebook "$SIYUAN_NOTEBOOK_ID"`。
4. **整页写入**：多行页面用 `fs write --overwrite`；日志追加用 `block append --data-type markdown`；不要用 `block update` 写多行。
5. **元数据双写**：页面正文保留 YAML frontmatter，同时用 `block set_attrs --attrs-json` 写 `custom-*` 属性。
6. **SQL 铁律**：`search query_sql` 必须包含 `box='$SIYUAN_NOTEBOOK_ID'`、身份列（`id` 或 `root_id`）和 `LIMIT`。
7. **图边格式**：页面之间用思源块引用 `((<doc-id> "display text"))`，这样 refs 表、反链和 web 图谱才一致。
8. **危险动作**：`fs rm`、`fs mv`、`document move`、`block move`、`search find_replace`、`tag remove` 前必须复述影响并取得明确批准。

## 存储约定

笔记本根结构：

```text
index
log
hot
audit/
audit/resolved/
_meta/manifest
_meta/taxonomy
concepts/
entities/
skills/
references/
synthesis/
journal/
projects/
```

页面类别：

- `concepts/`：概念、模式、心智模型。
- `entities/`：人物、工具、组织、论文、项目。
- `skills/`：操作知识和流程。
- `references/`：单一来源摘要、规范、API、配置。
- `synthesis/`：跨来源综合。
- `journal/`：时间条目和会话记录。
- `projects/`：项目专属知识。

## 标准写入模式

```bash
siyuan-sisyphus fs write --path "/$SIYUAN_NOTEBOOK_NAME/<hpath>" \
  --markdown "<full markdown with YAML frontmatter>" --overwrite

siyuan-sisyphus document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/<hpath>" --json
siyuan-sisyphus block set_attrs --id "<doc-id>" --attrs-json '{"custom-title":"...","custom-category":"concepts","custom-tags":"...","custom-updated":"..."}'
```

写入后用 `fs read` 或 `document lookup` 验证；不要用全文搜索验证刚写入的内容。
