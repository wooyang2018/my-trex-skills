# Book Study — 书籍系统研读

将一本书研究到面试实战深度，按核心概念拆解，逐概念生成 concept 页面（L1-L4）+ 面试追问链 + 实践方案，最终输出书籍概念地图。

## 输入识别

| 输入形式 | 获取方式 | 工具 |
|---|---|---|
| 在线文档 URL | 提取全文 markdown | `defuddle parse <url> --md`（优先）或 `web_fetch` |
| 本地文件（PDF / 文本 / markdown） | 直接读取 | `read_file` |
| 指定章节 | 读取后按章节标题定位 | `read_file` + 章节匹配 |
| 对话中粘贴的文本 | 直接处理 | 无需工具 |

PDF 若含扫描图片，`read_file` 可能提取不到文本——告知用户需 OCR 或提供文本版。

## 研读流程

### 1. 研究前查 wiki

先检索 wiki 是否已有该书或相关概念的 concept 页面：

```bash
siyuan-sisyphus search query_sql --sql "SELECT id,hpath FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' AND (hpath LIKE '/concepts/%' OR hpath LIKE '/references/%') LIMIT 200" --json
siyuan-sisyphus search fulltext --query "<书名/核心概念>" --page 1 --page-size 20 --json
```

已有相关页面则在其上深化，避免重复。

### 2. 结构拆解

通读全书（或指定章节），提炼核心概念清单：

- 识别 3-15 个值得独立成页的核心概念（太大拆分、太小合并）。
- 梳理概念间的依赖关系（前置 / 延伸），用于 `## Related` 段。
- 记录每个概念在书中的位置（章节 / 页码），用于 references 页面的 location 字段。

### 3. 逐概念 L1-L4 精读

对每个核心概念，从书中提取并补足 L1-L4：

| 层级 | 书中通常提供 | deep-study 补足 |
|---|---|---|
| L1 定义 | ✓ | 提炼一句话定义 + 核心特征（≥ 200 字） |
| L2 原理 | ✓（通常详细） | 压缩为机制要点（≥ 800 字，含 ≥ 1 处源码引用、≥ 3 个量化数据） |
| L3 动机 | 部分 | 补足替代方案和权衡（≥ 500 字，含 ≥ 2 个被放弃的替代方案） |
| L4 实战 | 常缺失 | **书籍研读的关键增量**——用 `research_subagent` 联网补足生产踩坑 / 面试热点 / 实践项目（≥ 3 条 Common Pitfalls、≥ 6 个 Interview Questions） |

L4 联网补足：对每个概念，调度 1 个 `research_subagent` 搜索"<概念> production pitfalls / interview questions / real-world usage"，T0/T1 来源优先，工具预算 15-25 次。subagent 的 task 须包含 3-5 个具体问题（见 `topic-research.md` 的细化示例）。

### 4. 生成 concept 页面

按 `../llm-wiki/references/writing.md` 的 concept 模板生成页面，**预填深入段**（见 `deliverable.md` 字段映射表）：

- 核心段：定义 / How It Works / Why This Way / Examples / Tradeoffs
- 深入段：Common Pitfalls / Interview Questions / Practice Ideas（deep-study 预填）
- Flashcards 段：L1 填空（`==mark==`）+ L2 问答超级块 + L3 单选嵌套超级块 + L4 多选嵌套超级块（构造模板见 `../SKILL.md` 闪卡题型构造章节）
- Related / Sources

### 5. 注册闪卡

复用 `../llm-wiki/references/ingest.md` 的闪卡注册流程：

```bash
# 查 L1 段落(type='p') + L2-L4 超级块(type='s')
siyuan-sisyphus search query_sql --sql "SELECT id, type FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND root_id='<concept-doc-id>' AND ((type='p' AND content LIKE '%L1（%') OR (type='s' AND (content LIKE '%L2（%' OR content LIKE '%L3（%' OR content LIKE '%L4（%'))) LIMIT 10" --json
# 设 custom-card-level 和 custom-card-type，create_card 注册到 wiki-cards 牌组
```

### 6. 创建 references 页面

为书籍本身创建一个 references 页面（`references/<书名简称>`），含 `## Source Link`（书目信息 + 章节定位）。各 concept 页面的 `## Sources` 引用此 references 页面。

### 7. 书籍概念地图

在 `synthesis/<书名简称>-概念地图` 创建综合页面：

- 列出所有核心概念及其依赖关系（用块引用 `((doc-id "概念名"))`）
- 嵌入块动态视图查询该书关联的 concept
- 书籍整体评价 + 推荐阅读顺序

### 8. 面试追问链

按 `depth-standard.md` 为每个概念生成面试追问链，写入 `## Interview Questions` 段。另可生成一份"书籍级"追问链（跨概念的综合问题）追加到 synthesis 页面。

## 输出

- 3-15 个 concept 页面（含 L1-L4 四种题型闪卡 + 预填深入段）
- 1 个 references 页面（书籍来源）
- 1 个 synthesis 页面（概念地图）
- 每概念的面试追问链（写入 Interview Questions）
- log 追加 + index 重建
