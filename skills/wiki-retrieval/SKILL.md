---
name: wiki-retrieval
description: >
  从思源 wiki 中检索知识，包含两种模式：（1）问答模式——回答用户关于知识库的问题，
  当用户说"我的 wiki 里有什么关于 X 的"、"查找与 Y 相关的一切"、"我对 Z 了解什么"
  或想获得带引用的综合性答案时使用。支持索引快速模式（"快速回答"、"只扫描"、
  "别读页面"）。（2）上下文包模式——生成 token 受限的上下文包，供下游 agent/技能使用。
  当用户说"生成上下文包"、"给我 X 的上下文切片"、"为我的 agent 打包 wiki"时触发。
  可从任何项目工作。
---

# Wiki Retrieval — 知识检索 + 上下文打包

> **链接格式**（根据 `llm-wiki/SKILL.md` §15 + §13 校准说明 7）：wiki 页面之间的所有内部链接——正文文本、`## Related` 列表、`relationships:` 镜像、`redirects_to`、仪表板、任何内容——都以思源原生块引用 `((<doc-id> "display text"))` 形式发出。思源**不**解析 `[[wikilink]]` markdown；只有块引用填充 `refs` 表、反向链接索引和全局图谱视图。通过 `SELECT id, hpath FROM blocks WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>' LIMIT 5000` 一次性解析文档 id。下文某些示例中出现的遗留 `[[...]]` 表示法是同一目标的简写——实际发出文本时，写 `((id "text"))`。

你正在从已编译的思源 wiki 中检索知识。本技能整合两种检索模式：**问答模式**（回答用户问题）和**上下文包模式**（为下游任务生成受限 token 包）。所有检索都通过 `siyuan-sisyphus` 进行。

## 开始之前

1. **解析配置 + 预检**——遵循 `llm-wiki/SKILL.md` 中的配置解析协议。从 CWD 向上查找 `.env` → `~/.siyuan-wiki/config` → 提示设置。跨项目查询时优先使用 `~/.siyuan-wiki/config`。这会得到 `SIYUAN_NOTEBOOK_ID`（用于 `--notebook` 和 `query_sql ... WHERE box=`）和 `SIYUAN_NOTEBOOK_NAME`（用于 `fs *` 路径）。然后运行 `siyuan-sisyphus --version` 和 `siyuan-sisyphus notebook get-permissions --notebook "<SIYUAN_NOTEBOOK_ID>"`；失败则停止。**这是只读类技能**——`r` / `rw` / `rwd` 任一权限均可。**不要**静默回退到文件系统读取。
2. 读取**热缓存**——提供近期活动的即时上下文。如果用户的问题关于最近摄取的内容，`/<notebook>/hot` 可能在你打开索引前就回答它：
   ```
   siyuan-sisyphus fs read --path "/<SIYUAN_NOTEBOOK_NAME>/hot"
   ```
3. 读取**索引**了解 wiki 的范围和结构：
   ```
   siyuan-sisyphus fs read --path "/<SIYUAN_NOTEBOOK_NAME>/index"
   ```

## 可见性过滤（可选）

默认返回**所有页面**，不论可见性标签。这保留现有行为——除非用户要求，否则不改变。

如果用户查询包含**"仅公开内容"**、**"面向用户"**、**"不含内部内容"**、**"用户视角"**或**"排除内部"**，激活**过滤模式**：

- 构建**屏蔽标签集**：`{visibility/internal, visibility/pii}`。
- 在索引遍历（步骤 2）中，在 SQL `WHERE` 子句中直接排除 `ial` 包含 `custom-tags=…visibility/internal…` 或 `custom-tags=…visibility/pii…` 的文档。
- 在分段/全文读取遍历中，不读取或引用任何被屏蔽的页面。
- **仅从允许的页面**合成答案——不要提及被排除页面的存在。

无 `visibility/` 标签或标记为 `visibility/public` 的页面始终包含。

在过滤模式下，在日志条目中注明：`mode=filtered`。

---

## 模式一：问答模式

回答用户关于知识库的问题。wiki 包含预合成的、交叉引用的知识。

### 步骤 1：理解问题

分类查询类型：
- **事实查询**——"X 是什么？" → 找到相关页面。
- **关系查询**——"X 如何与 Y 关联？" / "什么与 X 矛盾？" → 找到两个页面，通过 `get_backlinks` 遍历反向链接，读取其 `relationships:` frontmatter 块获取类型化边。
- **综合查询**——"关于 X 的当前想法是什么？" → 找到所有涉及 X 的页面，综合。
- **缺口查询**——"关于 X 我不知道什么？" → 找到缺失内容，检查待解问题部分。

同时决定**模式**：
- **仅索引模式**——由"快速回答"、"只扫描"、"别读页面"、"快速查找"触发。在步骤 2 停止。仅从 `custom-summary`、`custom-tags`、标题和 `index` 回答。
- **正常模式**——以下完整分层管线。

### 步骤 2：索引遍历（最廉价）

在不打开任何页面正文的情况下构建候选集。思源块索引已包含所有所需的结构化信号——直接查询：

```
siyuan-sisyphus search query_sql --stmt "
  SELECT id, hpath, name, ial
  FROM blocks
  WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>' AND hpath NOT LIKE '/_%'
  LIMIT 200
"
```

`ial` 列包含所有 `custom-*` 属性。在客户端解析。约 200 个文档的组合索引遍历是一次查询，不论笔记本大小成本相同。

按以下条件对每个候选评分：
1. 精确标题匹配（`name` 列）
2. `ial.custom-tags` 中标签匹配
3. `ial.custom-summary` 中摘要包含查询词
4. `ial.custom-aliases` 中别名匹配
5. `/<notebook>/index` 正文提及该页面

**在每个排名分桶内应用层级排序：** 当两个候选得分相同时，优先 `custom-tier=core` > `custom-tier=supporting` > `custom-tier=peripheral`。无层级的页面视为 `supporting`。

更精确的 SQL：

```
siyuan-sisyphus search query_sql --stmt "
  SELECT id, hpath, name, ial FROM blocks
  WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>' AND (
       name LIKE '%<term>%'
    OR ial  LIKE '%custom-tags=%<term>%'
    OR ial  LIKE '%custom-summary=%<term>%'
    OR ial  LIKE '%custom-aliases=%<term>%'
  )
  AND hpath NOT LIKE '/_%'
  LIMIT 50
"
```

如果处于**仅索引模式**，在此停止。仅从 `custom-summary`、标题和 `index` 文档回答。清晰标注：**"（仅索引回答——未读取页面正文；以下事实来自页面摘要，可能遗漏细节）"**。然后跳到步骤 5。

### 步骤 3：全文遍历（中等成本——仅在步骤 2 不充分时）

当查询需要标题/标签/摘要中没有的词汇时，升级到思源的 BM25 全文搜索：

```
siyuan-sisyphus search fulltext --query "<terms>" --p true --h true
```

`--p true --h true` 限制匹配段和标题块。返回排序命中及片段摘录和父文档 hpath。

**注意：** 思源全文索引是最终一致的。如果用户刚运行了摄取，给索引几秒钟再依赖 `search fulltext`——或回退到直接读取候选页面（步骤 4）。

如果全文遍历返回清晰命中且有可用片段，直接到步骤 5 引用。如果片段不够，用返回的 hpath 作为步骤 4 的种子集。

### 步骤 4：全文读取（昂贵——最后手段）

仅当步骤 2 和 3 无法回答时：

- 通过 `fs read` 完整读取前 **3** 个候选：
  ```
  siyuan-sisyphus fs read --path "/<SIYUAN_NOTEBOOK_NAME>/<candidate-hpath>"
  ```
- 应用层级排序：先读 `core` 再 `supporting`，跳过 `peripheral` 除非它是唯一匹配。
- 如果答案需要交叉引用，最多跟随 **一跳** `[[wikilinks]]`。
- **对于关系查询**（"X 如何与 Y 关联？" / "什么与 X 矛盾？"）：
  - 读取每个候选的 `relationships:` frontmatter 块。每个条目给出类型化的有向边（`extends`、`implements`、`contradicts`、`derived_from`、`uses`、`replaces`、`related_to`）。
  - 同时通过反向链接遍历：
    ```
    siyuan-sisyphus document lookup --notebook "<SIYUAN_NOTEBOOK_ID>" --hpath "/<candidate-hpath>"
    siyuan-sisyphus search get_backlinks --id <docId> --mode both
    ```
  - 在答案中明确呈现类型化边——"页面 A *矛盾* 页面 B（类型化边）"比"页面 A 链接到页面 B"更有用。
- 检查"待解问题"部分了解已知缺口。
- 如果仍不够，放宽全文查询（去掉术语约束，去掉 `--p/--h` 过滤器）重新运行步骤 3。

### 步骤 5：合成答案

从 wiki 内容合成答案：
- 使用 `[[hpath/page-name]]` 表示法引用特定 wiki 页面。
- 注明答案来源步骤（"摘要中发现" vs "全文片段" vs "全文读取"）——帮助用户理解置信度。
- 如果 wiki 有矛盾，呈现双方。
- 如果 wiki 未覆盖某内容，明确说明。
- 建议哪些来源可能填补缺口。

**页面信任标注。** 对每个引用的页面，从其 `ial` 解析 `custom-lifecycle` 和 `custom-updated`。计算 `is_stale = (today − updated) > 90 天`。内联标注有风险的页面：

| 条件 | 标注 |
|---|---|
| `lifecycle: archived` | `(已归档：被 [[target]] 取代)` — 使用后继页面 |
| `lifecycle: disputed` | `(有争议，标记于 <lifecycle_changed>：<lifecycle_reason 或 "原因未指定">)` |
| `is_stale` + `lifecycle: verified` | `(已验证但过时：最后更新 <updated>)` — 读者应在依赖前重新验证 |
| `is_stale`（其他生命周期） | `(过时：最后更新 <updated>)` |

### 步骤 6：记录查询

通过 `block append` 追加到 `/<notebook>/log`。日志文档 id 缓存在 `/_meta/manifest._meta.cached_doc_ids.log` 中。

```
siyuan-sisyphus block append \
  --parent-id <log-doc-id> \
  --data-type markdown \
  --data "- [<TIMESTAMP>] QUERY query=\"<用户问题>\" result_pages=<N> mode=<normal|index_only|filtered> escalated=<true|false>"
```

### 问答模式输出格式

> **基于 wiki：**
>
> [你的合成答案，带 [[wikilinks]] 到来源页面]
>
> **查阅的页面：** [[page-a]], [[page-b]], [[page-c]]
>
> **缺口：** [wiki 未覆盖但可能相关的内容]

---

## 模式二：上下文包模式

生成聚焦的、token 受限的上下文包。与问答模式（回答问题）不同，此模式将最相关的 wiki 知识打包成单个 markdown 块，供下游 agent、技能或用户直接使用。

### 调用形式

```
/wiki-context-pack "transformer attention mechanism" --budget 16000
/wiki-context-pack "my-project architecture decisions" --budget 8000
/wiki-context-pack --recent --budget 4000   # 从 /hot 文档获取近期活动包
/wiki-context-pack "authentication patterns"          # 默认预算：8000 tokens
```

解析用户调用提取：
- **topic**——查询字符串（除非 `--recent` 否则必需）
- **`--budget N`**——token 预算（默认：`8000`；最大：`100000`）
- **`--recent`**——打包最近更新/摄取的页面而非主题查询

### 步骤 1：相关性遍历（廉价）

不打开页面正文：

1. 扫描 `/<SIYUAN_NOTEBOOK_NAME>/index` 和 frontmatter 进行主题匹配。评分每个页面：
   - **+5** 精确标题或别名匹配
   - **+3** 标签匹配
   - **+2** `summary:` 字段包含查询词
   - **+1** `/<SIYUAN_NOTEBOOK_NAME>/index` 条目描述包含查询词

2. `--recent` 模式：按 `updated:` frontmatter 降序排列。取前 20 个作为候选。

3. 主题模式：收集按得分排名前 20 个候选。运行 `siyuan-sisyphus search fulltext --query "<topic>"` 进行 BM25 语义遍历并合并（全文命中加 **+4**）。

### 步骤 2：层级感知选择

在候选集中，按相关性得分排序，然后在每个得分分桶内应用层级排序（见 `llm-wiki/SKILL.md` 分层部分）：

1. 所有 `core` 层级匹配优先
2. 然后 `supporting`
3. 然后 `peripheral`（仅在预算允许时）

在步骤 3 填充预算时保持此排序。

### 步骤 3：压缩

对每个选中的页面（按层级/相关性顺序），计算其**压缩表示**——不是全文读取，而是结构化蒸馏：

1. **必需**：标题、`tier:`、`tags:`、`summary:`（来自 frontmatter——廉价，无需读正文）
2. **如果预算允许**：添加页面正文，但去除：
   - frontmatter 块（已在上方捕获）
   - `## Sources` 部分（改为一行来源名称）
   - 已在包含页面中提及的重复 wikilinks
   - 无内容的样板标题
3. **去重重叠内容**——如果两个选中页面共享段落（或近乎相同的论断），仅在更相关的页面中保留。标记移除：`_(内容也在 [[other-page]] 中)_`。

按 `len(text_chars) / 4` 估算每个页面表示的 token 数。

### 步骤 4：预算执行

按层级/相关性顺序贪婪填充包直到预算耗尽：

1. 始终包含每个选中页面的 frontmatter 摘要块，即使正文放不下。
2. 如果页面正文无法完整放入，包含压缩摘录：第一个非标题段落加上"关键想法"部分（如有）。
3. 修剪时首先去掉 `peripheral` 层级页面。
4. 保持运行 token 计数。下一个页面会超出预算时停止。
5. 跟踪丢弃了多少页面并在头部注明。

### 步骤 5：渲染输出

发出单个 markdown 块：

```markdown
# Context Pack: <topic>
# Generated: <ISO timestamp>
# Budget: <budget> tokens | Actual: <actual> tokens | Pages: <N included> / <M candidates>
# Methodology: 4 chars/token estimate

---

## [[<category/page-name>]] (<tier>, ~<tokens> tokens)
tags: #tag1 #tag2
summary: <summary field text>

<compressed body or excerpt>

---

## [[<next-page>]] (<tier>, ~<tokens> tokens)
...
```

`--recent` 模式时头部为：
```
# Context Pack: Recent Activity (last N pages)
```

**空结果：** 如果没有页面得分 > 0 且 `--recent` 无结果：
```
# Context Pack: <topic>
No relevant pages found. Consider running /wiki-ingest to add sources about this topic.
```

### 步骤 6：记录

追加一行到缓存的 `/log` 文档：

```
siyuan-sisyphus block append \
  --parent-id <log-doc-id> \
  --data-type markdown \
  --data "- [<ISO-8601>] CONTEXT_PACK topic=\"<topic>\" budget=<N> actual_tokens=<M> pages_included=<K> pages_dropped=<D>"
```

### 上下文包使用场景

- **传入 `/wiki-synthesis`**——作为上下文传递包以避免重新发现已知事实
- **提供给外部 agent**——受限、结构化、引用就绪
- **长任务前检查点**——了解 wiki 已知内容后再开始

---

## 注意事项

- 此技能是思源检索成本阶梯的规范演示。其他读取类技能应遵循相同的索引遍历 → 全文遍历 → 全文读取渐进。
- 如果 `fs read` 对候选 hpath 返回"文档未找到"而 `query_sql` 返回了该 hpath，索引滞后于删除。丢弃候选继续。
- 在另一个技能写入后（尤其是 `wiki-ingest`），`search fulltext` 可能尚未看到新内容。对此类问题优先使用步骤 4（`fs read` 刚写入的 hpath）。
- `4 chars/token` 启发式与 `wiki-status` 的 token 估算一致——跨技能保持一致。
- 上下文包是快照；不写入笔记本。重新运行以刷新。
- 对于非常大的预算（> 50K tokens），警告用户："此包很大。考虑缩小主题或使用问答模式获取定向答案。"
