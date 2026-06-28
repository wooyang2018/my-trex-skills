# LLM Wiki 知识库使用指南

> 基于 Karpathy LLM Wiki 模式，在思源笔记中构建编译型知识库。所有读写通过 `siyuan-sisyphus` CLI 完成。

## 目录

1. [概览](#1-概览)
2. [安装与初始化](#2-安装与初始化)
3. [核心概念](#3-核心概念)
4. [摄取知识（Ingest）](#4-摄取知识ingest)
5. [编写概念页面](#5-编写概念页面)
6. [闪卡与深度评估](#6-闪卡与深度评估)
7. [维护周期（Maintain）](#7-维护周期maintain)
8. [知识检索（Query）](#8-知识检索query)
9. [学习工作流：多学多想多问多练](#9-学习工作流多学多想多问多练)
10. [元数据 Schema 与自动派生](#10-元数据-schema-与自动派生)
11. [常见问题](#11-常见问题)

---

## 1. 概览

LLM Wiki 是一个存在于思源笔记本中的知识库系统。它的核心理念是**编译而非检索**——原始来源是输入，wiki 页面是蒸馏产物。每条知识经过提炼、结构化、交叉引用后存入知识库，形成可查询、可维护、可评估的知识网络。

### 与传统笔记的区别

| 维度 | 传统笔记 | LLM Wiki |
|---|---|---|
| 知识形态 | 原文摘抄 | 蒸馏后的结构化页面 |
| 组织方式 | 时间线/文件夹 | 类别化（concepts/references/synthesis/...） |
| 质量管理 | 无 | 9 字段元数据 + 自动派生 + 质量指标 |
| 深度评估 | 自我感觉 | 闪卡复习表现客观衡量 |
| 知识关联 | 手动链接 | 块引用自动构建知识图谱 |

### 知识库结构

```
笔记本根
├── index              # 主索引
├── log                # 活动日志
├── hot                # 会话热缓存
├── audit/             # 审计反馈
├── concepts/          # 知识单元（核心）
├── references/        # 来源摘要
├── synthesis/         # 跨来源综合分析
├── comparisons/       # 多方案对比
├── contradictions/    # 矛盾记录
├── projects/          # 学习计划与实践记录
└── journal/           # 学习反思日志
```

---

## 2. 安装与初始化

### 前置条件

- 思源笔记已安装并运行
- `siyuan-sisyphus` CLI 已安装
- 思源中已创建一个空笔记本（权限设为 `rwd`）

### 配置

首次使用，运行以下命令检查环境：

```bash
siyuan-sisyphus --version
siyuan-sisyphus config list
siyuan-sisyphus notebook list --json
```

如果配置不存在，创建 `~/.siyuan-wiki/config`：

```toml
# siyuan-wiki — Global Configuration
SIYUAN_NOTEBOOK_ID="<your-notebook-id>"
```

笔记本 ID 从 `notebook list --json` 的输出中获取，形如 `20241205084226-rl6jd3a`。

### 初始化笔记本结构

告诉 AI Agent "初始化我的 wiki" 或 "set up my wiki"，它会：

1. 创建种子根文档（`index`、`log`、`hot`、`audit/`、`concepts/`、`references/` 等）
2. 检查笔记本权限
3. 验证结构完整性

### 设置闪卡牌组

深度评估依赖思源闪卡系统。需要手动在思源 UI 中创建一个名为 `wiki-cards` 的闪卡牌组：

1. 打开思源 → 设置 → 闪卡
2. 添加牌组，命名为 `wiki-cards`
3. 验证创建成功：

```bash
siyuan-sisyphus flashcard get_decks --json
```

---

## 3. 核心概念

### 页面类别（5 类）

| 类别 | 路径 | 用途 |
|---|---|---|
| concepts | `concepts/` | 知识单元——抽象概念、具体命名对象。知识库核心 |
| references | `references/` | 单一来源摘要 + 源链接定位 |
| synthesis | `synthesis/` | 跨来源综合分析 |
| comparisons | `comparisons/` | 多方案对比分析 |
| contradictions | `contradictions/` | 来源间矛盾记录 |

### 学习辅助目录（2 类）

| 目录 | 用途 |
|---|---|
| projects | 学习计划与实践记录。每个学习领域一个 project 页面 |
| journal | 学习反思日志。费曼自检、学习复盘 |

### 元数据（9 字段，3 个自动派生）

每个页面通过 `block set_attrs` 写入 9 个 `custom-*` 属性：

| 字段 | 值域 | 维护方式 |
|---|---|---|
| `custom-title` | 字符串 | AI 写入 |
| `custom-category` | concepts / references / ... | AI 写入 |
| `custom-tags` | 逗号分隔 | AI 写入 |
| `custom-sources` | 逗号分隔的 references/ 页面引用 | AI 写入 |
| `custom-summary` | 一句话摘要 | AI 写入 |
| `custom-updated` | YYYY-MM-DD | AI 写入 |
| `custom-status` | draft / verified / outdated | **自动派生** |
| `custom-confidence` | low / medium / high | **自动派生** |
| `custom-depth` | beginner / intermediate / advanced | **闪卡自动派生** |

`custom-status`、`custom-confidence`、`custom-depth` 三个字段由 maintain 周期自动计算，**不需要人工维护**。

---

## 4. 摄取知识（Ingest）

### 摄取入口

告诉 AI Agent 以下任意指令：

- "ingest this" / "把这个加到知识库"
- "/ingest-url <URL>" — 摄取网页
- "把这个文档蒸馏到 wiki"

### 摄取流程

AI Agent 会执行以下步骤：

1. 读取来源（文件、URL、对话内容）
2. 决定创建或更新哪些页面（通常 3-8 页）
3. 使用模板写入页面
4. 写入 9 个元数据字段（初始值：status=draft, confidence=low, depth=beginner）
5. 为 concept 页面创建闪卡并注册
6. 更新 `index`、`log`、`hot`
7. 检测矛盾（如果新内容与已有结论冲突）

### 来源类型

| 来源 | 处理方式 |
|---|---|
| 本地文件 | 读取内容，蒸馏为 wiki 页面 |
| URL | 抓取网页内容，创建 `references/` 页面 |
| 对话 | 提取持久洞察，写入 `synthesis/` 或相关页面 |
| 历史导入 | 批量导入历史对话中的知识点 |

### 矛盾检测

当新来源与已有知识冲突时，AI 不会静默覆盖旧结论，而是：
- 创建 `contradictions/` 页面记录冲突
- 在两个冲突页面添加 `> [!WARNING]` callout
- 等待人工解决

---

## 5. 编写概念页面

### 模板结构

concept 页面分为三层：

**核心段**（AI 草拟）：定义、How It Works、Examples、Related、Sources

**深入段**（面试关键，人工补充为主）：
- `## In My Own Words` — 费曼复述，用自己的话解释
- `## Why This Way` — 设计动机，面试官最看重
- `## When to Use / When Not` — 适用场景判断
- `## Common Pitfalls` — 常见误区
- `## Interview Questions` — 面试追问预案
- `## Practice Ideas` — 练习方向

**闪卡段**（AI 生成，自动注册）：
- `## Flashcards` — 3 个层次的问题（L1/L2/L3）

### Related 段：学习路径

Related 段区分**前置依赖**和**延伸学习**，让学习路径可见：

```markdown
## Related

**前置依赖**（学这个之前应该先懂）：

- ((<doc-id> 'Prerequisite Page')) — 为什么需要先懂

**延伸学习**（学这个之后可以深入）：

- ((<doc-id> 'Extension Page')) — 延伸方向
```

### 人工填写段

以下两个段**必须人工填写**，AI 不代填：

- `## In My Own Words` — 费曼复述是验证理解的练习，自己写才有意义
- `## Interview Questions` — 面试追问预案需要结合自己的经验

其他深入段 AI 会预填能推断的内容，你可以修改补充。

---

## 6. 闪卡与深度评估

### 闪卡机制

每个 concept 页面自动生成 3 个层次的闪卡：

| 层次 | 问题类型 | 衡量能力 |
|---|---|---|
| L1（定义） | "什么是 X？核心特征是什么？" | 基本概念回忆 |
| L2（原理） | "X 如何工作？什么场景适合用？" | 机制理解和应用判断 |
| L3（动机） | "为什么 X 这样设计？放弃了什么？" | 设计动机和权衡分析 |

### 深度派生规则

`custom-depth` 由闪卡复习表现自动派生，不需要自我评估：

| 条件 | depth |
|---|---|
| L1 卡片未复习 | beginner |
| L1 已复习，L2 未复习 | beginner |
| L1+L2 已复习，L3 未复习 | intermediate |
| L1+L2+L3 均已复习 | advanced |

### 如何提升深度

1. 在思源 UI 中打开闪卡复习
2. 逐张复习，诚实评分
3. 下次 maintain 周期自动更新 depth

**关键**：你不需要判断"我理解到什么程度"。系统通过你能否答出不同层次的问题来客观衡量。能答出 L2 就到 intermediate，能答出 L3 就到 advanced。

### 闪卡注册流程（AI 自动执行）

1. 写入 concept 页面（包含 `## Flashcards` 段）
2. SQL 查找 L1/L2/L3 块 ID
3. 为每个块设置 `custom-card-level` 属性
4. 通过 `flashcard create_card` 注册到 `wiki-cards` 牌组

---

## 7. 维护周期（Maintain）

### 触发方式

告诉 AI Agent 以下任意指令：

- "audit" / "lint" / "日常更新"
- "状态如何" / "wiki 洞察"

### 自动派生（每次 maintain 必执行）

maintain 周期会自动重算 3 个字段：

**custom-confidence**（由来源数量决定）：

| 来源数 | confidence |
|---|---|
| 0-1 | low |
| 2 | medium |
| 3+ | high |

**custom-status**（由时间+来源+矛盾状态决定）：

| 条件 | status |
|---|---|
| 创建 <7 天 或 有未解决矛盾 | draft |
| 7+ 天 且 2+ 来源 且 无矛盾 | verified |
| 180+ 天未更新 | outdated |

**custom-depth**（由闪卡复习表现决定）：

读取 `wiki-cards` 牌组中所有卡片的复习状态，按 L1/L2/L3 层次判断深度。

### 质量指标（8 项）

| 指标 | 目标 | 说明 |
|---|---|---|
| 元数据完整性 | ≥95% | 页面是否包含全部 9 个 custom-* 字段 |
| 来源覆盖率 | ≥80% | concepts/synthesis/comparisons 是否有 sources |
| 孤立页面率 | ≤5% | 无入链也无出链的页面 |
| 草稿积压率 | ≤30% | status=draft 的页面占比 |
| 矛盾积压 | ≤10 个 | 未解决的矛盾记录 |
| 过期页面率 | ≤10% | 90+ 天未更新的 draft 页面 |
| 学习深度分布 | 健康分散 | beginner/intermediate/advanced 的比例 |
| 闪卡覆盖率 | ≥90% | 有闪卡的 concept 占比 |

### 安全默认

maintain 采用"先报告后编辑"策略。非破坏性修复（补缺属性、刷新索引、追加日志）会在摘要后执行；破坏性操作需要明确确认。

---

## 8. 知识检索（Query）

### 触发方式

告诉 AI Agent：

- "what do I know about X" / "我知道 X 吗？"
- "基于 wiki 回答：..."

### 检索层次（成本递增）

1. 读取 `index` 和 `hot`（最便宜）
2. SQL 查询 `custom-title`、`custom-tags`、hpath（便宜）
3. 全文搜索 `search fulltext`（中等）
4. 读取完整页面（最贵，最后手段）
5. 跟随一级块引用反链（中等）

### 默认写回

当回答包含持久洞察时，AI 会**默认写回** wiki：

1. 识别持久洞察
2. 向你展示写回摘要
3. 你确认后写入 `synthesis/` 或更新 `concepts/`
4. 你拒绝时记录原因到 `log`

---

## 9. 学习工作流：多学多想多问多练

### 多学（摄取+路径规划）

- **摄取来源**：用 ingest 把文章、文档、视频笔记蒸馏到 wiki
- **学习路径**：concept 的 Related 段标注前置依赖，形成可见的学习路径
- **学习计划**：在 `projects/` 创建学习计划页面，关联 concept，追踪进度

### 多想（费曼+设计动机）

- **费曼复述**：每个 concept 的 `## In My Own Words` 段——用白话解释，解释不清就是没懂
- **设计动机**：`## Why This Way` 段——追问"为什么这样设计"，这是面试官最看重的深度
- **反思日志**：在 `journal/` 写学习反思——学到了什么、什么还不清楚

### 多问（追问引导）

- **ingest 追问**：每次摄取后，AI 在 `log` 中追加 2-3 个建议追问
- **面试预案**：concept 的 `## Interview Questions` 段——面试官可能追问的问题和思考方向
- **矛盾发现**：当新来源与已有知识冲突时，AI 创建矛盾记录供你思考

### 多练（闪卡+实践）

- **闪卡复习**：在思源中复习闪卡，复习表现自动决定 `custom-depth`
- **实践记录**：在 `projects/` 记录练手项目的经验和踩坑
- **练习方向**：concept 的 `## Practice Ideas` 段给出练习建议

### 闭环

```
多学（ingest）→ 多想（In My Own Words + Why This Way）
     ↓                                          ↓
多问（Interview Questions + 追问引导）    多练（Flashcards + Practice Ideas）
     ↓                                          ↓
     └────────→ maintain 周期 ←─────────────────┘
                    ↓
           自动派生 status/confidence/depth
                    ↓
              质量指标报告
```

---

## 10. 元数据 Schema 与自动派生

### 自动派生规则详解

**custom-confidence** — 内容置信度，由来源数量决定：

| 类别 | 规则 |
|---|---|
| references/ | 恒定 `high`（直接来源摘要） |
| contradictions/ | 恒定 `low`（本质不确定） |
| concepts/synthesis/comparisons/ | 0-1 sources → `low`；2 → `medium`；3+ → `high` |

**custom-status** — 页面成熟度，由时间+来源+矛盾状态决定：

| 类别 | 规则 |
|---|---|
| references/ | 恒定 `verified` |
| contradictions/ | Resolution Status = open → `draft`；resolved → `verified`；suspended → `outdated` |
| concepts/synthesis/comparisons/ | <7天或有矛盾 → `draft`；7+天且2+来源且无矛盾 → `verified`；180+天 → `outdated` |

**custom-depth** — 学习者理解深度，由闪卡复习表现决定（仅 concepts/）：

| 条件 | depth |
|---|---|
| L1 卡片未复习或不存在 | beginner |
| L1 已复习，L2 未复习或不存在 | beginner |
| L1+L2 已复习，L3 未复习或不存在 | intermediate |
| L1+L2+L3 均已复习 | advanced |

### 初始值

ingest 时写入的初始值：

| 类别 | status | confidence | depth |
|---|---|---|---|
| concepts/ | draft | low | beginner |
| references/ | verified | high | — |
| synthesis/ | draft | low | — |
| comparisons/ | draft | low | — |
| contradictions/ | draft | low | — |

---

## 11. 常见问题

### 刚写入的内容搜不到

思源索引是最终一致的。用 `fs read` 或 `document lookup` 直接验证写入，不要用全文搜索。

### query_sql 返回空

检查 SQL 是否包含 `box='$SIYUAN_NOTEBOOK_ID'` 条件和身份列（`id` 或 `root_id`）。不含这两者的查询会被权限过滤器丢弃。

### 闪卡创建失败

确保 `wiki-cards` 牌组已在思源 UI 中创建。CLI 不能创建牌组，只能注册卡片到已有牌组。

### custom-depth 一直是 beginner

这说明你的闪卡还没有被复习过。在思源 UI 中打开闪卡复习，复习 L1 卡片后，下次 maintain 周期会自动更新 depth。

### block update 多行内容被截断

`block update` 会在首个换行处截断。多行内容用 `fs write --overwrite`（整页重写）或 `block append`（增量追加）。

### 新笔记本 fs write 权限错误

新建笔记本默认权限是 `r`。需要在思源 UI 中手动改为 `rwd`。

### document set-attr 写不进 custom-* 属性

改用 `block set_attrs --id <doc-id>`。`document set-attr` 对 custom-* 属性不可靠。

---

## 附：关键 CLI 命令速查

```bash
# 配置与预检
siyuan-sisyphus --version
siyuan-sisyphus config list
siyuan-sisyphus notebook get_permissions --notebook "$SIYUAN_NOTEBOOK_ID"

# 写入页面
siyuan-sisyphus fs write --path "/<notebook-name>/<hpath>" --markdown "..." --overwrite

# 写入元数据
siyuan-sisyphus document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/<hpath>" --json
siyuan-sisyphus block set_attrs --id "<doc-id>" --attrs-json '{...}'

# SQL 查询
siyuan-sisyphus search query_sql --sql "SELECT id,hpath FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' LIMIT 50" --json

# 全文搜索
siyuan-sisyphus search fulltext --query "terms" --page 1 --page-size 20 --json

# 闪卡
siyuan-sisyphus flashcard get_decks --json
siyuan-sisyphus flashcard create_card --deck-id "<deck-id>" --block-ids-json '["<block-id>"]'
siyuan-sisyphus flashcard list_cards --deck-id "<deck-id>" --scope deck --filter new --json

# 日志追加
siyuan-sisyphus block append --parent-id "$LOG_DOC_ID" --data-type markdown --data "..."
```
