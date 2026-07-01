# Deliverable — 产出三件套规范

定义 deep-study 每个研究主题的必交产出：面试追问链、实践方案、wiki 摄取。三者缺一不可。

## 1. 面试追问链

5-10 个递进问题 + 答题方向，从 L1 递进到 L4。设计方法见 `depth-standard.md`。

写入 concept 页面的 `## Interview Questions` 段，格式：

    ## Interview Questions

    > [!NOTE]
    > 面试追问链（L1→L4 递进）。答题方向是切入思路，完整答案见页面正文。

    1. **[L1]** 问题？
       - 答题方向：...

    2. **[L2]** 问题？
       - 答题方向：...

    3. **[L4]** 生产环境踩过什么坑？
       - 答题方向：...

同时单独呈现给用户，便于直接用于面试准备。

## 2. 实践方案

可落地的代码示例 / 架构设计 / 踩坑预案。写入 concept 页面的 `## Common Pitfalls` 和 `## Practice Ideas` 段。

Common Pitfalls（踩坑预案）每条含现象 / 原因 / 解法，从研究素材提取真实案例。Practice Ideas 含可运行的小项目或代码示例，须能落地。

## 3. wiki 摄取

按 llm-wiki 的 ingest 流程写入。deep-study 的增量在于**预填深入段**。

### 字段映射表（writing.md 模板段 ← 研究产物）

| writing.md 模板段 | 标准 ingest | deep-study 预填来源 | 量化深度要求 |
|---|---|---|---|
| 一句话定义 | AI 草拟 | 研究综合 | ≥ 200 字，3-5 个核心特征 |
| `## How It Works` | AI 草拟 | 研究综合（须达 L2 深度） | ≥ 800 字，含 ≥ 1 处源码引用、≥ 3 个量化数据、≥ 1 个数据结构说明 |
| `## Why This Way` | AI 草拟 | 研究综合（须达 L3 深度） | ≥ 500 字，含 ≥ 2 个被放弃的替代方案及权衡 |
| `## Examples` | AI 草拟（可空） | 研究综合（必须填，代码示例） | ≥ 1 个可运行代码示例 |
| `## Common Pitfalls` | 留空给人工 | **deep-study 预填**（研究素材提取真实踩坑） | ≥ 3 条，每条 ≥ 100 字，含现象/原因/解法 |
| `## Interview Questions` | 留空给人工 | **deep-study 预填**（面试追问链 L1-L4） | ≥ 6 个问题，含 ≥ 1 个 L4 级"杀手问题" |
| `## Practice Ideas` | 留空给人工 | **deep-study 预填**（可落地实践方案） | ≥ 2 个，每个含可运行代码或具体命令 |
| `## Flashcards` L1 | AI 生成 | AI 生成（填空题，`==mark==` 挖核心术语，`custom-card-type=cloze`） | 挖 1-3 处核心术语 |
| `## Flashcards` L2 | AI 生成 | AI 生成（问答题，超级块首子块=问题、其余=答案，`custom-card-type=qa`） | 答案含量化数据 |
| `## Flashcards` L3 | AI 生成 | AI 生成（单选题，嵌套超级块，正面=题干+选项、背面=答案+解析，`custom-card-type=single-choice`） | 4 个有道理的干扰项（见 `depth-standard.md` 干扰项设计） |
| `## Flashcards` L4 | AI 生成 | AI 生成（多选题，嵌套超级块，正面=题干+任务列表、背面=答案+解析，`custom-card-type=multi-choice`） | 正确选项 2-3 个，错误选项基于常见误区 |
| `## Sources` | 来源引用 | references/ 页面块引用 | 每个 T0/T1 来源一个 |

### 摄取流程（复用 ingest.md）

1. 写正文：`fs write --overwrite`，concept 页面含 `## Flashcards` 段（L1 填空 `==mark==` + L2 问答超级块 + L3 单选嵌套超级块 + L4 多选嵌套超级块，构造模板见 `../SKILL.md` 闪卡题型构造章节）+ 预填深入段。
2. 写元数据：`block set_attrs` 9 个 `custom-*` 属性（`custom-status=draft`、`custom-confidence` 按来源数、`custom-depth=beginner`）。
3. 注册闪卡：SQL 查 L1 段落(type='p') + L2-L4 超级块(type='s')，设 `custom-card-level` 和 `custom-card-type`，`create_card` 注册到 wiki-cards 牌组。详见 `../llm-wiki/references/ingest.md`。
4. 创建 references/ 页面：每个 T0/T1 来源一个 references 页面，含 `## Source Link`（外部 URL + location）。
5. 追加 log，重建 index。

## siyuan 适配验证清单

每次 deep-study 摄取后，或在端到端验证时，检查以下适配点：

| # | 检查项 | 验证方法 | 达标标准 |
|---|---|---|---|
| 1 | L1 填空挖空合理 | `block get_kramdown` 看 L1 段落块，确认 `==mark==` 标记的是核心术语 | 挖空后能触发回想，挖在关键定义术语上，非无关词 |
| 2 | L2 问答题结构 | `block get_kramdown` 看超级块，确认 `{{{row}}}` 含首子块(问题)+其余子块(答案) | 思源识别为问答题，问题/答案分离 |
| 3 | L3 单选题结构 | `block get_kramdown` 看外层超级块，确认嵌套内层超级块(题干+选项)在首子块，答案+解析在后续子块 | 正面显示题干和 A/B/C/D 选项，翻面显示答案 |
| 4 | L4 多选题结构 | `block get_kramdown` 看外层超级块，确认嵌套内层超级块(题干+未勾选任务列表)在首子块，答案+勾选项在后续子块 | 正面显示题干和未勾选项，翻面显示正确选项和解析 |
| 5 | 闪卡注册成功 | `block get_attrs` 确认 4 块都有 `custom-riff-decks` 和 `custom-card-type`；`flashcard get_cards --deck-id $SIYUAN_FLASHCARD_DECK_ID --page 1 --page-size 200 --json` 可查到新卡 | L1 段落(type='p') + L2-L4 超级块(type='s') 各注册成功，`custom-card-type` 分别为 cloze/qa/single-choice/multi-choice |
| 6 | concept 页面结构 | `fs read` 确认深入段预填 | Interview Questions / Common Pitfalls / Practice Ideas 非空 |
| 7 | depth 派生链路 | maintain 的 SQL `type IN ('p','s')` 能匹配新卡 | 查询返回 L1(type='p') + L2-L4(type='s') |
| 8 | 复习界面交互（人工） | 在思源 UI 打开闪卡复习 | L1 填空题正确挖空显示；L2 问答题翻面正常；L3 单选题正面显示选项、翻面显示答案；L4 多选题正面显示任务列表、翻面显示勾选状态 |

第 8 项需用户在思源 UI 手动验证。前 7 项可用 CLI 自动检查。端到端验证时全部跑一遍。

## L1 填空挖空质量要点

挖空是 L1 填空题的关键。挖空不当会导致闪卡无效。要点：

- 挖**核心术语**（概念名、关键技术词），不挖虚词 / 连接词 / 形容词。
- 每张 L1 卡挖 1-3 处，挖太多变成背诵全文，挖太少没有回忆负担。
- 挖空后句子仍可读，被挖的词能从上下文推断（有回忆线索，非死记）。
- 反例：`==是== 一个用于...`（挖了系动词，无意义）。正例：`==X== 是一个用于 ==Y== 的技术`（挖概念名和用途）。
