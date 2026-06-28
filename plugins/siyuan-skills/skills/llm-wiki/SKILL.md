---
name: llm-wiki
description: >
  在思源笔记本中构建和维护 Karpathy 风格 LLM Wiki。只通过 siyuan-sisyphus
  CLI 访问思源；不支持其他笔记系统、本地 Markdown 仓库或绕过 CLI 的思源访问。
  当用户要初始化 wiki、摄取来源、基于 wiki 回答问题、处理审计反馈、
  生成报告或维护知识图谱时使用。
---

# LLM Wiki — SiYuan CLI Knowledge Engine

这个技能维护一个存在于思源笔记本中的编译型知识库。原始来源是输入，wiki 页面是蒸馏产物；所有读写都走 `siyuan-sisyphus` CLI。

## 入口

| 用户意图 | 操作 | 读取 |
|---|---|---|
| 初始化、切换、检查笔记本结构 | `setup` | `references/setup.md` |
| 摄取文件、URL、对话、研究材料 | `ingest` | `references/ingest.md` + `references/writing.md` |
| "我知道 X 吗？"、"基于 wiki 回答" | `query` | `references/query.md` |
| 处理审计反馈 | `audit` | `references/audit.md` |
| 维护检查、质量指标、归档已解决审计 | `maintain` | `references/maintain.md` |

只加载当前操作需要的 reference；不要一次性读完整个目录。

## 硬规则

1. **唯一访问层**：所有思源读写使用 `siyuan-sisyphus`。不要直接访问思源工作区文件，不要自写思源请求。
2. **配置解析**：从 `~/.siyuan-wiki/config` 读取配置。只保存 `SIYUAN_NOTEBOOK_ID`；需要 `fs` 路径时用 `notebook list --json` 按 ID 解析当前名称作为路径首段。
3. **预检**：首次操作先运行 `siyuan-sisyphus --version`、`siyuan-sisyphus config list`、`siyuan-sisyphus notebook get_permissions --notebook "$SIYUAN_NOTEBOOK_ID"`。
4. **整页写入**：多行页面用 `fs write --overwrite`；日志追加用 `block append --data-type markdown`；不要用 `block update` 写多行。
5. **元数据单写**：页面正文不包含 YAML frontmatter 和 `# 标题`行（思源自动生成 frontmatter 和标题）；元数据仅通过 `block set_attrs --attrs-json` 写 `custom-*` 属性。audit 文档也遵循此规则，所有字段通过 custom-* 属性存储。
6. **SQL 铁律**：`search query_sql` 必须包含 `box='$SIYUAN_NOTEBOOK_ID'`、身份列（`id` 或 `root_id`）和 `LIMIT`。
7. **图边格式**：页面之间用思源块引用 `((<doc-id> "display text"))`，这样 refs 表和反链才一致。
8. **危险动作**：`fs rm`、`fs mv`、`document move`、`block move`、`search find_replace`、`tag remove` 前必须复述影响并取得明确批准。
9. **矛盾检测**：ingest 时如果新来源与已有页面结论冲突，不静默覆盖旧结论。在 `contradictions/` 创建结构化记录，在两个冲突页面互相引用矛盾记录。

## 存储约定

笔记本根结构：

```text
index
log
hot
audit/
concepts/
references/
synthesis/
comparisons/
contradictions/
projects/
journal/
```

`_meta/` 目录已移除。导入跟踪由 `log` 文档 + SQL 查询 `custom-sources` / `custom-updated` 替代；标签发现由 SQL `SELECT DISTINCT value FROM attributes WHERE name='custom-tags'` 替代；doc ID 解析由运行时 `document lookup` 替代，不再缓存。

## 页面类别（5 类，静态）

| 类别 | 功能定位 | AI 角色 | 初始 status |
|---|---|---|---|
| `concepts/` | **知识单元页面**：抽象概念、模式、心智模型、具体命名对象（工具、人物、组织、技术）。回答"什么是 X？怎么工作？有什么权衡？"。知识库核心层 | 草拟全文 + 生成闪卡，status/confidence/depth 自动派生 | draft |
| `references/` | 单一来源摘要 + 原始文本/外部链接定位 | 完全写入 | verified |
| `synthesis/` | 跨来源综合分析 | 草拟全文，status/confidence 自动派生 | draft |
| `comparisons/` | 多方案对比分析 | 草拟全文，status/confidence 自动派生 | draft |
| `contradictions/` | 来源间矛盾记录 | 检测并创建，status 由 Resolution Status 决定 | draft |

**concepts/ 涵盖范围**：既包括抽象思想（attention 机制、梯度下降、知识编译），也包括具体命名对象（PyTorch、Karpathy、Google Brain、BERT）。模板中的中间段（How It Works / Tradeoffs）按主题灵活调整——抽象概念侧重原理和权衡，具体对象侧重特征和关联。被多处引用的具体对象自然成为图枢纽，无需单独类别。

## 学习辅助目录

| 目录 | 用途 |
|---|---|
| `projects/` | 学习计划与实践记录。每个学习领域一个 project 页面，列出学习目标、进度、关联概念。做练手项目时也在此记录实践经验和踩坑。对应"多学"的路径规划和"多练"的实践记录。 |
| `journal/` | 学习反思日志。学完一组概念后写"学到了什么、还有什么不清楚"，费曼式自检。对应"多想"的反思沉淀。 |

这两个目录不参与矛盾检测和质量指标计算，是学习者自用的辅助空间。project 页面通过块引用关联 `concepts/` 中的知识页面，形成"学什么→练什么"的闭环。

## 元数据 Schema（9 字段，3 个自动派生）

每个 wiki 页面通过 `block set_attrs` 写入 9 个 `custom-*` 属性。其中 `custom-status`、`custom-confidence`、`custom-depth` 三个字段由系统自动派生，**不需要人工维护**：

| 字段 | 值域 | 用途 | 维护方式 |
|---|---|---|---|
| `custom-title` | 字符串 | 页面标题 | AI 写入 |
| `custom-category` | concepts / references / synthesis / comparisons / contradictions | 页面类别 | AI 写入 |
| `custom-tags` | 逗号分隔 | 标签分类 | AI 写入 |
| `custom-sources` | 逗号分隔的 references/ 页面引用 | 来源溯源 | AI 写入 |
| `custom-summary` | 一句话摘要 | 概览检索 | AI 写入 |
| `custom-updated` | YYYY-MM-DD | 最后更新日期 | AI 写入 |
| `custom-status` | draft / verified / outdated | 页面成熟度 | **自动派生** |
| `custom-confidence` | low / medium / high | 内容置信度 | **自动派生** |
| `custom-depth` | beginner / intermediate / advanced | 学习者理解深度 | **闪卡自动派生** |

### 自动派生规则

**custom-confidence**（由来源数量决定，maintain 周期重算）：

| 类别 | 规则 |
|---|---|
| references/ | 恒定 `high`（直接来源摘要，事实性强） |
| contradictions/ | 恒定 `low`（本质不确定） |
| concepts/synthesis/comparisons/ | 统计 `custom-sources` 条目数：0-1 → `low`，2 → `medium`，3+ → `high` |

**custom-status**（由时间+来源+矛盾状态决定，maintain 周期重算）：

| 类别 | 规则 |
|---|---|
| references/ | 恒定 `verified`（事实性内容，错误易对照源发现） |
| contradictions/ | `## Resolution Status` = open → `draft`；resolved → `verified`；suspended → `outdated` |
| concepts/synthesis/comparisons/ | 创建 <7 天 或 存在关联的 open contradiction → `draft`；7+ 天 且 2+ sources 且 无 open contradiction → `verified`；180+ 天未更新 → `outdated` |

**custom-depth**（由闪卡复习表现决定，maintain 周期重算）：

每个 concept 页面包含 3 个层次的闪卡（L1 定义/L2 原理/L3 动机）。maintain 周期读取闪卡复习状态，按以下规则派生 depth：

| 条件 | depth |
|---|---|
| L1 卡片不存在或从未复习（在 new 列表中） | beginner |
| L1 已复习但 L2 不存在或未复习 | beginner |
| L1+L2 均已复习但 L3 不存在或未复习 | intermediate |
| L1+L2+L3 均已复习（在 old 列表中，reps > 0） | advanced |

闪卡复习是深度的唯一衡量方式——你不需要自己判断"我理解到什么程度"，系统通过你能否答出不同层次的问题来客观衡量。

**custom-status 语义隔离**：audit 文档使用 `custom-status=resolved/open`（审计生命周期），wiki 页面使用 `custom-status=draft/verified/outdated`（知识成熟度，自动派生）。两者通过 `custom-category` 和 `hpath` 天然隔离，SQL 查询始终在特定类别范围内执行，不会混淆。

**AI 写入边界与自动派生**：

- `references/` — AI 完全写入。`status` 恒定 `verified`，`confidence` 恒定 `high`，`depth` 不适用。
- `concepts/`、`synthesis/`、`comparisons/` — AI 草拟全文。初始 `status=draft`、`confidence=low`（0-1 sources）、`depth=beginner`。maintain 周期根据来源数量、时间和矛盾状态自动派生 `status` 和 `confidence`；根据闪卡复习表现自动派生 `depth`。无需人工升级。
- `contradictions/` — AI 检测并创建。`status` 由 `## Resolution Status` 决定，`confidence` 恒定 `low`。

## 标准写入模式

```bash
# 步骤 1：写正文（不含 frontmatter，不含 # 标题行，concept 页面包含 ## Flashcards 段）
siyuan-sisyphus fs write --path "/<resolved name>/<hpath>" \
  --markdown "<content without frontmatter or # heading>" --overwrite

# 步骤 2：写元数据（status/confidence/depth 为初始值，maintain 周期自动重算）
siyuan-sisyphus document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/<hpath>" --json
siyuan-sisyphus block set_attrs --id "<doc-id>" --attrs-json '{
  "custom-title": "...",
  "custom-category": "concepts",
  "custom-tags": "tag-a,tag-b",
  "custom-sources": "source-a",
  "custom-summary": "One-sentence summary.",
  "custom-status": "draft",
  "custom-confidence": "low",
  "custom-depth": "beginner",
  "custom-updated": "2026-06-28"
}'

# 步骤 3（仅 concepts/）：注册闪卡——找到 Flashcards 段的 3 个块并挂卡
siyuan-sisyphus search query_sql --sql "SELECT id, content FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND root_id='<doc-id>' AND type='p' AND (content LIKE 'L1（%' OR content LIKE 'L2（%' OR content LIKE 'L3（%') LIMIT 10" --json
# 对每个块设 custom-card-level 属性，然后用 flashcard create_card 挂卡
```

写入后用 `fs read` 或 `document lookup` 验证；不要用全文搜索验证刚写入的内容。

## 思源原生特性使用指引

充分利用思源原生特性管理知识库，不依赖外部工具。

### 嵌入块 — 动态视图

在 `index` 等系统页面中用嵌入块做动态查询视图，替代手工维护列表：

```markdown
{{ SELECT id, hpath, content FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' AND hpath LIKE '/concepts/%' ORDER BY updated DESC LIMIT 10 }}
```

注意：嵌入块 SQL 必须排除当前文档自身（`AND root_id != '<当前docId>'`），且 `SELECT` 列表必须包含渲染所需列。

### Callout — 视觉标注

用 GFM Callout 在页面内标注特殊状态：

```markdown
> [!WARNING]
> 此结论与 ((<contradiction-doc-id> "矛盾记录")) 记录的冲突相关，详见矛盾页面。

> [!CAUTION]
> 此页面已被标记为 outdated，结论可能已过时。参考 ((<ref-doc-id> "更新来源"))。

> [!IMPORTANT]
> 核心定义：此概念指 ...
```

Callout 写入用 `block append --data-type markdown`，`> [!TYPE]` 必须独占一行，后续行以 `>` 开头。

### 原生标签 — 标签面板导航

页面正文末尾写思源原生标签，镜像 `custom-tags` 实现标签面板导航：

```markdown
#tag-a# #tag-b#
```

标签格式为 `#tag#`（首尾各一个 `#`），层级标签用 `/` 分隔如 `#领域/机器学习#`。不是标准 Markdown 的 `#tag`。

### 动态锚文本 — 块引用跟随目标更新

所有块引用使用单引号格式，锚文本跟随目标块内容更新：

```markdown
((<doc-id> 'display text'))
```

注意：双引号 `"text"` 是静态锚文本，单引号 `'text'` 是动态锚文本。优先使用单引号，除非需要固定显示文本。
