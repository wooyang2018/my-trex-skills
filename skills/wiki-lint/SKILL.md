---
name: wiki-lint
description: >
  审计和维护思源 wiki 的健康和日常运行，包含三种模式：（1）Lint 审计——查找孤立页面、
  检测矛盾、识别过时内容、修复断链或对知识库进行一般维护。当用户说"审计"、"清理 wiki"、
  "什么需要修复"、"wiki 健康检查"时使用。添加 --consolidate 切换到执行-并-报告模式。
  （2）日常更新——运行维护周期：检查来源新鲜度、更新索引、重新生成 hot 页。当用户说
  "日常更新"、"更新一切"、"晨间同步"、"刷新 wiki 索引"时使用。（3）状态审计——显示
  wiki 当前状态和增量。当用户问"状态如何"、"摄取了多少"、"还剩什么要处理"时使用。
  也在"wiki 洞察"、"什么是中心的"、"显示枢纽"、"wiki 结构"时触发洞察分析。
---

# Wiki Lint — 健康审计 + 日常维护 + 状态报告

> **链接格式**（根据 `llm-wiki/SKILL.md` §15 + §13 校准说明 7）：wiki 页面之间的所有内部链接——正文文本、`## Related` 列表、`relationships:` 镜像、`redirects_to`、仪表板、任何内容——都以思源原生块引用 `((<doc-id> "display text"))` 形式发出。思源**不**解析 `[[wikilink]]` markdown；只有块引用填充 `refs` 表、反向链接索引和全局图谱视图。通过 `SELECT id, hpath FROM blocks WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>' LIMIT 5000` 一次性解析文档 id。下文某些示例中出现的遗留 `[[...]]` 表示法是同一目标的简写——实际发出文本时，写 `((id "text"))`。

你正在对思源 wiki 执行健康检查和维护。本技能整合三种模式：**Lint 审计**（查找和修复结构性问题）、**日常更新**（维护周期）和**状态审计**（增量报告和洞察分析）。

## 分发

从用户措辞推断模式：

| 用户意图 | 模式 |
|---|---|
| "审计"、"清理 wiki"、"什么需要修复"、"wiki 健康检查" | Lint 审计 |
| "日常更新"、"更新一切"、"晨间同步"、"刷新索引" | 日常更新 |
| "状态如何"、"摄取了多少"、"还剩什么"、"显示增量" | 状态审计 |
| "wiki 洞察"、"什么是中心的"、"显示枢纽"、"wiki 结构" | 洞察分析 |
| 未指定 | Lint 审计（默认） |

**在扫描任何内容之前：** 遵循 `llm-wiki/SKILL.md` 中的检索原语表。这里的 lint 遍历旨在依赖对 `ial` 列的 `query_sql` 和 `search get_backlinks`，而非整页读取。在大型笔记本上，盲目读取每个页面来 lint 正是此框架旨在避免的。

## 开始之前

1. **解析配置 + 预检**——遵循 `llm-wiki/SKILL.md` 中的配置解析协议（从 CWD 向上查找 `.env` → `~/.siyuan-wiki/config` → 提示设置）。这会得到 `SIYUAN_NOTEBOOK_ID`（用于 `--notebook` 和 `query_sql ... WHERE box=`）和 `SIYUAN_NOTEBOOK_NAME`（用于 `fs *` 路径）。
2. 运行 `siyuan-sisyphus --version` 和 `siyuan-sisyphus notebook get-permissions --notebook "<SIYUAN_NOTEBOOK_ID>"`。
   - **默认 `--check` 模式**是只读类：`r` / `rw` / `rwd` 任一均可。
   - **`--consolidate` 模式**是写入类：需要 `rwd`。
3. 拉取注册表一次。几乎下面的每个检查都从这个单一查询读取，而非重新打开页面：

   ```
   siyuan-sisyphus search query_sql --stmt "
     SELECT id, hpath, name, ial, length, updated FROM blocks
     WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>'
       -- (filter '/_*' prefixes client-side per llm-wiki §13 note 8)
     LIMIT 1000
   "
   ```

   解析 `ial` 获取 `custom-title`、`custom-aliases`、`custom-tags`、`custom-category`、`custom-summary`、`custom-sources`、`custom-base-confidence`、`custom-lifecycle`、`custom-lifecycle-changed`、`custom-tier`、`custom-relationships`、`custom-superseded-by`、`custom-promotion-status`、`custom-affinity`。缓存 `length` 和 `updated` 用于过时度/token 计算。
4. 读取 `/<SIYUAN_NOTEBOOK_NAME>/log` 获取近期活动上下文（使用 manifest 的 `_meta.cached_doc_ids` 中缓存的日志文档 id 将读取限制在最后约 50 条——`block append` 写入很短）。

> **校准警告**（根据 `llm-wiki/SKILL.md` §13 说明 3、4、8、9）：此技能中的 SQL 查询避免 `COUNT(*)`、`ial LIKE '%custom-...%'` 和 `hpath NOT LIKE '/_%'`，因为这三者都被思源权限层静默过滤。对 `refs` / `spans` / `assets` 的读取必须包含 `WHERE box='<SIYUAN_NOTEBOOK_ID>'`，即使看起来冗余——没有它行数返回为零。

## Lint 检查

按顺序对注册表运行这些检查。随时报告发现。

### 1. 孤立页面

查找零入站链接的页面。这些是没有任何连接的知识孤岛。

**如何检查：**

对注册表中的每个页面（跳过 `/index`、`/log`、`/hot`、`/_` 子树下的任何内容），调用：

```
siyuan-sisyphus search get_backlinks --id <doc-id> --mode both
```

反向链接响应为空（无文档引用、无纯文本提及）的页面是孤立的。这是入站链接计数的单一权威来源——切勿通过在笔记本中 grep `[[<name>]]` 来复制它，思源反向链接索引已经完成了那项工作并与写入保持同步。

**如何修复：**

- 识别哪些现有页面应该链接到孤立页面（用 `search fulltext --query "<orphan title or alias>"` 查找正文文本中尚未 wikilink 的提及）。
- 通过 `fs write --overwrite` 合并正文在那些页面的适当部分添加链接。

### 2. 断链

查找指向不存在文档的 `[[wikilinks]]`。

**如何检查：**

对注册表中的每个页面，`fs read` 其正文并提取每个 `[[...]]` 引用。然后对每个链接目标：

- 规范化：小写、去空格、去掉任何前导 `/`。
- 对照注册表的 `name` 和 `hpath` 列查找。别名也算。

如果没有匹配，标记链接为断链，附上源页面 hpath 和目标字符串。

（`get_backlinks` API 返回已解析和已存在的边；断链正是正文文本 `[[...]]` 引用中未解析的那些。因此这里需要正文读取——没有更廉价的方法。）

**如何修复：**

- 如果目标被重命名，更新链接到新路径。
- 如果目标应该存在，创建它（考虑它属于 concepts/entities/skills 中的哪个）。
- 如果链接错误，移除或更正它。

### 3. 缺失 Frontmatter

每个页面应在 `ial` 中有这些自定义属性：`custom-title`、`custom-category`、`custom-tags`、`custom-sources`、`custom-created`、`custom-updated`。

**如何检查：**

遍历注册表行。对每个，检查所有六个 `custom-*` 键是否存在于解析的 `ial` 中。**不要读正文**——`ial` 列是索引，任何格式良好的页面在写入正文后通过 `block set-attrs` 设置了自定义属性。

如果页面正文有 YAML frontmatter 但没有匹配的 `custom-*` 属性（即写入者忘了第二次调用），标记为"frontmatter 未镜像"。这是常见的摄取 bug，可通过重新运行 `block set-attrs` 修复。

**如何修复：**

- 通过 `block set-attrs --id <doc-id> --attrs '{...}'` 添加缺失字段和合理默认值。
- 对于"frontmatter 未镜像"，解析正文的 YAML 并镜像它。

### 3a. 缺失摘要（软警告）

每个页面*应该*有 `custom-summary` 属性（`summary:` frontmatter 的镜像）——1-2 句话，≤200 字符。这是廉价检索（如 `wiki-query` 的仅索引模式）读取以避免打开页面正文的内容。

**如何检查：**

注册表遍历：标记任何没有 `custom-summary` 的页面，**但作为软警告，而非错误**——早于此字段的旧页面没问题；此检查存在是为了推动摄取技能在新写入时填充它。同时标记摘要超过 200 字符的页面。

**如何修复：**

- 重新摄取页面，或手动写一段短摘要（1-2 句话的页面内容）并通过 `block set-attrs` 镜像。

### 4. 过时内容

页面 `updated` 时间戳相对于其来源过旧。

**如何检查：**

对注册表中每个有 `custom-sources` 的页面，查找每个来源的文件系统 mtime（来源仍在磁盘上）。与页面的 `blocks.updated`（已在注册表中）比较。标记任何来源 mtime > 页面 updated 的页面。

对于 `custom-sources` 指向其他 wiki 页面（非文件）的页面，与链接页面的 `updated` 比较。

### 5. 矛盾

跨页面冲突的论断。

**如何检查：**

这需要阅读相关页面并比较论断——本质上是昂贵的。限定范围：

- 遍历 `custom-relationships` 包含 `type: contradicts` 条目的页面——这些是明确标记的矛盾；验证两个目标都存在且关系在适当处互惠。
- 对于未标记的矛盾，运行 `search fulltext --query "however"`、`--query "in contrast"`、`--query "despite"` 并手动审查命中项的跨页面张力。
- 关注共享标签或在同一枢纽概念的 `get_backlinks` 中一起出现的页面。

**如何修复：**

- 添加"待解问题"部分注明矛盾。
- 通过 `[[wikilink]]` 引用两个来源及其论断。
- 如果矛盾是非对称的（页面 A 承认页面 B 的论断，但 B 不互惠），在两个页面上添加 `relationships: contradicts`。

### 6. 索引一致性

验证 `/<SIYUAN_NOTEBOOK_NAME>/index` 与实际页面清单匹配。

**如何检查：**

- `fs read --path "/<SIYUAN_NOTEBOOK_NAME>/index"` 并解析出列表/链接列表。
- 与注册表 hpath 比较。
- 标记在磁盘上但不在索引中的页面，以及索引中不解析到注册表 hpath 的链接。
- 同时检查索引中显示的摘要是否仍与每个页面的 `custom-summary` 匹配（漂移）。

**如何修复（consolidate 模式）：**

- 从注册表重写 `/index`——`fs write --path "/<SIYUAN_NOTEBOOK_NAME>/index" --overwrite --markdown "<rebuilt-body>"`。这比拼接更改更廉价；索引很小，重建是 O(N)。

### 7. 来源漂移

检查页面是否诚实对待其内容有多少是推断的 vs 提取的。见 `llm-wiki/SKILL.md` 中的来源标记部分了解约定。

**如何检查：**

对每个有 `custom-provenance`（镜像 YAML `provenance:` 块的紧凑 JSON blob）或正文中任何 `^[inferred]`/`^[ambiguous]` 标记的页面：

- `fs read` 每个此类页面的正文一次（不要读完全没有来源信号的页面）。
- 计算句子/要点并统计每个标记的数量。
- 计算大致比例（`extracted`、`inferred`、`ambiguous`）。
- 应用这些阈值：
  - **AMBIGUOUS > 15%**：标记为"推测过重"——即使 1/7 的论断确实不确定，这也是页面需要更严格来源或应移至 `/synthesis/` 的信号。
  - **INFERRED > 40% 且无 `custom-sources`**：标记为"无来源综合"——页面在做连接但无可引用。
  - **枢纽页面**（此检查开始时一次性计算的 `get_backlinks` 计数前 10），INFERRED > 20%：标记为"高流量页面来源可疑"——枢纽页面上的错误传播到每个链接它的页面。
  - **漂移**：当存储的 `custom-provenance` 和重新计算的值在任何字段上差异超过 0.20 时，标记。
- **跳过**既无存储来源也无标记的页面——按约定视为完全提取。

**如何修复：**

- 推测过重：从来源重新摄取、解决不确定论断，或将推测内容拆分到 `/synthesis/` 页面。
- 无来源综合：在正文 YAML frontmatter 中添加 `sources:`，通过 `block set-attrs` 镜像，或重新标记为综合。
- INFERRED > 20% 的枢纽页面：优先重新摄取——这里的错误影响面最广。
- 漂移：重写 `custom-provenance` 属性以匹配重新计算的值（仅 consolidate 模式）。

### 8. 碎片化标签集群

标签暗示主题集群。如果共享标签的页面不互相引用，集群是碎片化的。

**如何检查：**

从注册表的 `custom-tags` 构建标签 → 页面映射。对每个有 ≥ 5 个页面的标签：

- `n` = 此标签的页面数。
- `actual_links` = 标签组中任意两个页面之间的 `get_backlinks` 总和（已从检查 1 缓存）。
- `cohesion = actual_links / (n × (n-1) / 2)`。
- 标记 cohesion < 0.15 且 n ≥ 5 的标签组。

**如何修复：**

- 运行 `cross-linker` 技能针对碎片化标签——它发现并插入缺失的链接。
- 如果标签组很大（n > 15）且仍然碎片化，考虑通过 `tag-taxonomy` 拆分为更具体的子标签。

### 9. 可见性标签一致性

检查 `visibility/` 标签是否被正确应用，以及是否在重要的地方静默缺失。

**如何检查：**

- **未标记的 PII 模式：** `search fulltext --query "password"`、`--query "api_key"`、`--query "ssn"`、`--query "secret token"` 等。对每个命中，检查页面的 `custom-tags` 是否包含 `visibility/pii` 或 `visibility/internal`。如果都不包含，标记为可能的错误分类。（使用 fulltext 返回的页面级命中而非重新读取正文——足以分类。）
- **`visibility/pii` 无 `sources:`：** 注册表遍历——标记任何 `custom-tags` 包含 `visibility/pii` 但 `custom-sources` 为空的页面。
- **分类法中的可见性标签：** `fs read --path "/<SIYUAN_NOTEBOOK_NAME>/_meta/taxonomy"` 并在正文中搜索 `visibility/`。如果找到，标记——这些是系统标签，不得出现在面向用户的分类法文档中。

**如何修复：**

- 对于未标记的 PII 模式：添加 `visibility/pii`（如果是团队上下文而非个人数据则用 `visibility/internal`）并通过 `block set-attrs` 镜像。
- 对于缺失 `sources:`：添加来源或升级给用户——不要自动填充。
- 对于分类法污染：从 `/_meta/taxonomy` 移除 `visibility/` 条目（仅 consolidate 模式）。

### 10. 杂项提升候选

查找 `/misc/` 中积累了足够项目亲和力可以被提升的页面。

**如何检查：**

将注册表过滤到 hpath 以 `/misc/` 开头或 `custom-promotion-status` 为 `misc` 的页面。对每个，读取 `custom-affinity`（由 `cross-linker` 写入的紧凑 `project:score,project:score` 字符串）。标记任何单个项目得分 ≥ 3 的页面。

**如何修复：**

- 如果亲和力得分看起来过时（如 `get_backlinks` 很多但 `custom-affinity` 为空），先运行 `cross-linker`。
- 提升方式：`fs mv --src "/<SIYUAN_NOTEBOOK_NAME>/misc/<slug>" --dst "/<SIYUAN_NOTEBOOK_NAME>/projects/<project>/references/<slug>"`。然后 `block set-attrs` 清除 `custom-promotion-status` 并更新 `custom-category`。反向链接自动解析——思源针对文档 id 而非路径重写 `[[]]` 引用。

### 11. 综合缺口

识别 wiki 缺失的高价值综合机会——在许多页面中共同出现但没有 `/synthesis/` 页面连接的概念对。

**如何检查：**

- 注册表遍历：列出 `/synthesis/` 下的页面，解析其 `[[wikilinks]]`（或标题）获取它们涵盖的概念对。
- 从 `/concepts/` 和 `/entities/` 中挑选 10-15 个频繁链接的概念（按 `get_backlinks` 计数排名）。
- 对每对（A, B），通过两次 SQL 查询计算共现：
  ```
  siyuan-sisyphus search query_sql --stmt "
    -- 'SELECT COUNT(DISTINCT root_id) AS n FROM refs' triggers permission_filtered (§13 note 3); pull root_ids and count client-side
    SELECT DISTINCT root_id FROM refs
    WHERE def_block_id = '<A-doc-id>'
  "
  ```
  和类似的 B，然后在客户端使用每个的 `get_backlinks` 取交集。`refs` 表是思源的权威引用索引——对于此用途比 `fulltext` 便宜得多。
- 标记共现 ≥ 3 且没有现有综合页面的对。

**如何修复：**

- 运行 `/wiki-synthesize` 自动发现和填充前几个缺口。

### 12. 置信度和生命周期模式

强制执行置信度 + 生命周期 frontmatter 模式（见 `llm-wiki/SKILL.md`，置信度和生命周期部分）。

两种模式：
- **`--check`**（默认，只读）——报告错误和警告。
- **`--fix`**（在 `--consolidate` 内）——仅在检测到漂移时重写 `custom-base-confidence`（规则 12e）；从不重写 `custom-lifecycle`。

#### 规则 12a — `lifecycle` 枚举验证

**如何检查：** 注册表遍历——标记任何不在 `{draft, reviewed, verified, disputed, archived}` 中的 `custom-lifecycle` 值。如果字段缺失，那是单独的阶段门控警告（见下文迁移时间线）。

**如何修复：** 不适用（只有人工应该设置生命周期状态）。

#### 规则 12b — `base_confidence` 范围

**如何检查：** 注册表遍历——标记任何在 `[0.0, 1.0]` 之外的 `custom-base-confidence` 或完全缺失该字段的页面。

**如何修复：** 不适用（错误值意味着写入技能计算错了——呈现供人工更正）。

#### 规则 12c — 过时页面报告（计算覆盖层）

过时度从不存储——在读取时计算：`is_stale = (today − updated) > 90 天`。

**如何检查：** 注册表遍历——对每个页面，从 `blocks.updated` 计算 `is_stale`。如果过时，同时检查 `custom-lifecycle`：

- 过时页面 lifecycle 为 `verified` 的得到更响亮的标注（这些是最危险的——可能错误的高信任页面）。
- 所有其他过时页面报告为标准警告。

**如何修复：** `--fix` **不**重写 `lifecycle`。过时度在重新摄取提升 `updated` 时自动清除。

#### 规则 12d — 超接完整性

**如何检查：** 对每个设置了 `custom-superseded-by` 的页面：

- 验证目标页面存在于注册表中。
- 验证目标本身不是 `archived`（无链式超接）。
- 验证没有循环（A → B → A）。
- 警告 `custom-lifecycle != archived` 而设置了 `custom-superseded-by`（不一致状态）。

**如何修复：** 不适用——标记供人工解决。

#### 规则 12e — 置信度漂移

**如何检查：** 对同时有 `custom-base-confidence` 和 `custom-sources` 的页面，使用 `llm-wiki/SKILL.md` 中的公式重新计算 `base_confidence`。漂移为 `|stored − recomputed| > 0.05`。

**如何修复（仅 `--fix`）：** 通过 `block set-attrs` 重写 `custom-base-confidence` 属性。**同时更新正文的 YAML**——如果它包含 `base_confidence:` 行，否则正文和索引在下一次读取时漂移。使用 `fs replace` 进行有针对性的 YAML 行编辑，如果多个 frontmatter 行更改则通过 `fs write --overwrite` 重写整个正文。

#### 迁移时间线

| 阶段 | 时间 | 缺失字段时的行为 |
|---|---|---|
| 阶段 1：软启动 | 初始发布 | 仅警告——任何页面缺失 `custom-base-confidence` 或 `custom-lifecycle` |
| 阶段 2：新页面强制 | +2 周 | 新创建页面缺失字段时报错；现有页面仍警告 |
| 阶段 3：完全强制 | +6 周，门控于回填脚本 | 所有页面报错 |

#### 输出附加

添加到 Wiki 健康报告：

```markdown
### 置信度/生命周期问题（发现 N 个）
- `/concepts/foo` — 缺失 `custom-lifecycle`（警告：阶段 1）
- `/entities/bar` — `custom-lifecycle: stalestate` 不是有效的枚举值
- `/concepts/scaling` — `custom-base-confidence: 1.4` 超出范围 [0.0, 1.0]
- `/synthesis/old-analysis` — 过时（最后更新 2025-10-01，182 天前）lifecycle=verified ⚠️ 高优先级
- `/concepts/outdated` — 过时（最后更新 2025-11-15，137 天前）lifecycle=draft
- `/entities/tool-v1` — `custom-superseded-by: [[entities/tool-v2]]` 但 lifecycle=draft（预期 archived）
- `/concepts/drift-example` — base_confidence 漂移：存储=0.80，重算=0.59（delta=0.21）
```

追加到 `LINT` 日志条目：`... lifecycle_issues=N`。

### 13. 类型化关系有效性

验证 `custom-relationships` JSON。跳过没有此字段的页面——该字段是可选的。

**允许的类型：** `extends`、`implements`、`contradicts`、`derived_from`、`uses`、`replaces`、`related_to`。

**如何检查：**

注册表遍历——对每个有 `custom-relationships` 的页面，解析 JSON。对每个条目：

1. **类型验证**——标记任何不在上述允许集合中的 `type`。
2. **断链目标**——从 `target` 中去除 `[[` 和 `]]`，规范化，并检查它是否对照注册表解析。标记未解析的目标。
3. **自引用**——标记解析目标等于页面自身文档 id 的条目。

**如何修复（仅 `--consolidate`）：**

- 无效类型：将值更正为最接近的允许类型，或在模糊时使用 `related_to`。
- 断链目标：更新或移除条目；如果目标页面应该存在，先创建它。
- 自引用：移除条目。

通过 `block set-attrs` 应用（重写 `custom-relationships`）**以及**在正文 YAML 中（使用 `fs write --overwrite`，因为多行 YAML 编辑需要整页重写——`block update` 会截断）。

**输出附加：**

```markdown
### 类型化关系问题（发现 N 个）
- `/concepts/foo` — relationships[1]：type "contradication" 不是允许的类型（你是说 "contradicts"？）
- `/concepts/bar` — relationships[0]：target "[[skills/nonexistent-skill]]" 无法解析到任何页面
- `/entities/baz` — relationships[2]：自引用（target 解析为此页面自身的 id）
```

追加到 `LINT` 日志条目：`... relationship_issues=N`。

## 输出格式

以结构化列表报告发现：

```markdown
## Wiki 健康报告

### 孤立页面（发现 N 个）
- `/concepts/foo` — 无入站链接

### 断链（发现 N 个）
- `/entities/bar` 正文第 15 行 — 链接到 [[nonexistent-page]]

### 缺失 Frontmatter（发现 N 个）
- `/skills/baz` — 缺失 custom-tags, custom-sources

### 过时内容（发现 N 个）
- `/references/paper-x` — 来源修改于 2024-03-10，页面最后更新 2024-01-05

### 矛盾（发现 N 个）
- `/concepts/scaling` 声称 "X" 但 `/synthesis/efficiency` 声称 "非 X"

### 索引问题（发现 N 个）
- `/concepts/new-page` 存在于笔记本但不在 /index 中

### 缺失摘要（发现 N 个 — 软警告）
- `/concepts/foo` — 无 custom-summary
- `/entities/bar` — 摘要超过 200 字符

### 来源问题（发现 N 个）
- `/concepts/scaling` — AMBIGUOUS > 15%：22% 的论断是歧义的（重新来源或移至 /synthesis）
- `/entities/some-tool` — 漂移：存储 inferred=0.10，重算=0.45
- `/concepts/transformers` — 枢纽页面（31 个入站）INFERRED=28%：这里的错误广泛传播
- `/synthesis/speculation` — 无来源综合：无 custom-sources，55% 推断

### 碎片化标签集群（发现 N 个）
- **systems** — 7 个页面，cohesion=0.06 ⚠️ — 在此标签上运行 cross-linker
- **databases** — 5 个页面，cohesion=0.10 ⚠️

### 可见性问题（发现 N 个）
- `/entities/user-records` — 正文匹配 PII 模式但无 visibility/pii 标签
- `/concepts/auth-flow` — 标记为 visibility/pii 但缺失 custom-sources
- `/_meta/taxonomy` — 包含 visibility/internal 条目（系统标签不得在分类法中）

### 杂项提升候选（发现 N 个）
| 页面 | 顶级项目 | 亲和力得分 |
|---|---|---|
| `/misc/web-martinfowler-articles-microservices` | siyuan-wiki | 4 |

### 类型化关系问题（发现 N 个）
- `/concepts/foo` — relationships[1]：type "contradication" 不是允许的类型
- `/concepts/bar` — relationships[0]：target "[[skills/nonexistent]]" 无法解析到任何页面

### 综合缺口（发现 N 个）
| 对 | 共现 | 建议操作 |
|---|---|---|
| [[Caching]] × [[Consistency]] | 5 个页面 | 运行 /wiki-synthesize |
| [[Testing]] × [[Observability]] | 3 个页面 | 运行 /wiki-synthesize |
```

## Lint 之后

通过 `block append` 追加到 `/<SIYUAN_NOTEBOOK_NAME>/log`：

```
- [<TIMESTAMP>] LINT issues_found=N orphans=X broken_links=Y stale=Z contradictions=W prov_issues=P missing_summary=S fragmented_clusters=F visibility_issues=V promotion_candidates=C synthesis_gaps=G relationship_issues=R lifecycle_issues=L
```

提议自动修复问题（即切换到 `--consolidate`）或让用户决定要处理哪些。

---

## Consolidate 模式（`--consolidate`）

由 `wiki-lint --consolidate` 触发。从仅报告切换到**执行-并-报告**——定期运行的"梦想周期"使 wiki 自愈。**需要 `rwd` 权限**；否则停止。

### 安全协议

**始终先试运行。** 在写入任何内容之前：

1. 运行所有 lint 检查（上面的步骤 1-13）。
2. 以结构化列表打印计划的合并操作（见下文试运行输出）。
3. 询问用户：`"应用这 N 个更改？[yes / no / select by number]"`。
4. 仅在明确确认后执行写入。如果用户选择个别操作，只应用那些。
5. 切勿合并页面——使用 `wiki-dedup` 处理那个。只链接、提升、降级和标注。

### 合并操作（确认后按顺序执行）

#### 操作 1：修复断链

对检查 2 中发现的每个断 `[[Target]]`：

- 在注册表的 `name`、`custom-title` 和 `custom-aliases` 中搜索模糊匹配（Levenshtein ≤ 2 或共享词根）。
- 如果存在唯一最佳匹配：通过 `fs replace --path "/<SIYUAN_NOTEBOOK_NAME>/<source-hpath>" --old "[[<old-target>]]" --new "[[<correct-path>]]"` 重写正文中的链接。`fs replace` 是这里正确的工具——它编辑一个文档正文而不重写无关内容。运行前确认（CLI 提示）。
- 如果没有匹配或模糊：使用相同的 `fs replace` 流程将链接转为纯文本 `--new "<Target>"` 并通过 `block append` 添加注释行。
- 切勿仅为满足断链而创建新页面。

#### 操作 2：为孤立页面添加缺失的交叉引用

对检查 1 中发现的每个孤立页面：

- 运行 `search fulltext --query "<orphan title>"` 和 `--query "<each alias>"`。
- 对每个以纯文本提及孤立页面但没有 wikilink 的命中页面，使用 `fs replace` 将第一个自然提及包裹在 `[[orphan-path]]` 中。
- 限制每个孤立页面最多 3 次插入——不要用链接淹没页面。

#### 操作 3：纠正生命周期状态

自动应用这些规则（它们强制执行文档化的状态机——无需人工判断）：

- **提升 `draft` → `reviewed`：** `custom-lifecycle: draft` 且 `custom-created` > 30 天前 且 `custom-base-confidence > 0.7` 的页面。同时更新正文的 YAML（合并后 `fs write --overwrite`）和自定义属性：
  ```
  block set-attrs --id <doc-id> --attrs '{"custom-lifecycle":"reviewed","custom-lifecycle-changed":"<today>","custom-lifecycle-reason":"auto-promoted by wiki-lint --consolidate: age>30d, confidence>0.7"}'
  ```
- **降级 `verified` → `stale`：** 不是状态转换——`stale` 是计算覆盖层，不是生命周期值。相反，对于过时度 > 180 天的 verified 页面，在正文前部添加标注块：
  ```
  > ⚠️ **过时**：此页面最后更新于 <date>。依赖前请验证。
  ```
  使用 `fs replace --path "..." --old "<first-line-of-body>" --new "<callout>\n\n<first-line-of-body>"`。仅在标注尚不存在时添加。
- **不要更改 `reviewed` → `verified` 或任何其他转换**——那些仅限人工。

#### 操作 4：层级降级

对于 `custom-tier: supporting`（或未设置）且有 0 个入站链接且 90+ 天未更新的页面：

- `block set-attrs --id <doc-id> --attrs '{"custom-tier":"peripheral"}'`。
- 如果正文有 `tier:` 行则镜像到正文 YAML。
- 输出降级列表供用户审查。
- 不要自动降级 `custom-tier: core` 页面。

#### 操作 5：标签规范化

`fs read /<SIYUAN_NOTEBOOK_NAME>/_meta/taxonomy` 获取别名映射（如 `ml → machine-learning`）。对每个注册表页面，在 `custom-tags`（和正文的 `tags:` YAML，如果存在）中将别名标签替换为其规范形式。这是 `tag-taxonomy` 工作的子集——仅别名修复，无全面审计。

#### 操作 6：矛盾标注

对每对标记为互相矛盾的页面（通过 `custom-relationships` `type: contradicts` 或在检查 5 中标记）：

- 读取正文并检查相关论断附近是否已存在 `> ⚠️ 与 [[Other Page]] 的矛盾标注`。
- 如果不存在，在"关键想法"部分末尾（或"待解问题"之前，如果没有"关键想法"部分）插入。使用 `fs replace` 配合 section-anchor 模式，或如果每个页面有多个更改则用 `fs write --overwrite`。
- 不要解决矛盾；只标注。

### 操作 7：写入合并报告

所有操作完成后，将报告写入 `/<SIYUAN_NOTEBOOK_NAME>/synthesis/consolidation-<YYYY-MM-DD>`：

```
siyuan-sisyphus fs write \
  --path "/<SIYUAN_NOTEBOOK_NAME>/synthesis/consolidation-<YYYY-MM-DD>" \
  --overwrite \
  --markdown "<rendered-body>"

siyuan-sisyphus document lookup --notebook "<SIYUAN_NOTEBOOK_ID>" --hpath "/synthesis/consolidation-<YYYY-MM-DD>"
siyuan-sisyphus block set-attrs --id <doc-id> --attrs '{
  "custom-title":"Consolidation Report <YYYY-MM-DD>",
  "custom-category":"synthesis",
  "custom-tags":"maintenance,consolidation",
  "custom-summary":"Auto-generated consolidation report from wiki-lint --consolidate run on <date>.",
  "custom-lifecycle":"draft",
  "custom-tier":"peripheral",
  "custom-created":"<TIMESTAMP>",
  "custom-updated":"<TIMESTAMP>"
}'
```

正文形状：

```markdown
---
title: Consolidation Report <YYYY-MM-DD>
category: synthesis
tags: [maintenance, consolidation]
summary: >-
    Auto-generated consolidation report from wiki-lint --consolidate run on <date>.
lifecycle: draft
tier: peripheral
created: <ISO timestamp>
updated: <ISO timestamp>
---

# 合并报告 — <YYYY-MM-DD>

## 摘要
- 修复的断链：N
- 添加的交叉引用：M
- 更新的生命周期状态：K
- 层级降级：D
- 规范化的标签：T
- 添加的矛盾标注：C

## 断链修复
- `/concepts/foo` 第 12 行 — [[OldTarget]] → [[correct-target]]
- `/entities/bar` 第 8 行 — [[Missing]] → "Missing"（未找到匹配）

## 添加的交叉引用（孤立页面救援）
- `/concepts/baz` — 现在链接自：[[concepts/alpha]]、[[skills/beta]]

## 生命周期更新
- `/concepts/old-draft` — draft → reviewed（年龄 45 天，置信度 0.74）
- `/synthesis/stale-verified` — 添加过时标注（最后更新 2025-10-01）

## 层级降级
- `/concepts/unused-concept` — supporting → peripheral（0 链接，120 天过时）

## 标签规范化
- `/entities/some-tool` — `ml` → `machine-learning`

## 矛盾标注
- `/concepts/scaling` — 标记与 [[synthesis/efficiency]] 的矛盾
```

### 试运行输出（在任何写入前显示）

```
wiki-lint --consolidate — 试运行

计划操作（共 N 个）：
[1] 修复断链：/concepts/foo 第 12 行 [[OldTarget]] → [[correct-target]]
[2] 添加交叉引用：/concepts/baz ← [[concepts/alpha]]（孤立页面救援）
[3] 生命周期：/concepts/old-draft → reviewed（年龄 45 天，置信度 0.74）
[4] 层级降级：/concepts/unused → peripheral（0 链接，112 天过时）
[5] 标签别名：/entities/some-tool：ml → machine-learning
[6] 矛盾标注：/concepts/scaling ↔ [[synthesis/efficiency]]

应用这 6 个更改？[yes / no / select by number]
```

### consolidate 模式的日志条目

```
- [<TIMESTAMP>] LINT_CONSOLIDATE links_fixed=N orphans_rescued=M lifecycle_updates=K tier_demotions=D tag_fixes=T contradiction_callouts=C report=/synthesis/consolidation-<YYYY-MM-DD>
```

## 与 obsidian-wiki 的区别

- **反向链接来自 `get_backlinks`，而非 vault 范围 grep。** 这是此技能在思源 wiki 上快速的单一最大原因——索引由服务器维护，同时跟踪 wikilink 引用和纯文本提及。
- **最终一致性注意事项：** `search fulltext` 可能短暂错过在同一技能运行中写入的内容。当验证刚写入的内容（如你刚插入的标注）时，`fs read` 页面而非搜索它。
- **无文件系统路径操作。** `fs replace` 和 `fs write --overwrite` 覆盖每个正文编辑；`block set-attrs` 覆盖每个属性编辑；`fs mv` 覆盖每个重定位。

---

## 模式二：日常更新 — Wiki 维护周期

运行轻量维护遍历：检查来源新鲜度、刷新索引、更新 hot 页、写入状态文件。这是写入类——需要 `rwd` 权限。

**笔记本作用域状态目录：**

```bash
STATE_DIR="$HOME/.siyuan-wiki/state/<SIYUAN_NOTEBOOK_ID>"
mkdir -p "$STATE_DIR"
```

### 步骤

1. **来源新鲜度检查**——比较 manifest 中每个来源的文件修改时间。分类：新鲜（mtime ≤ ingested_at）、过期（mtime > ingested_at）、缺失（文件不再存在）。
2. **索引刷新**——读取 `/<notebook>/index`，通过 `query_sql` 枚举笔记本页面并核对。更新不一致项。
3. **hot 页更新**——如超过 48 小时，读取最近修改的 10 个 wiki 页面并写入约 500 字语义快照。
4. **写入状态文件**：
   ```bash
   date +%s > "$STATE_DIR/.last_update"
   echo "<stale_count>" > "$STATE_DIR/.pending_delta"
   ```
5. **日志**——追加到 `/log`：
   ```
   - [<ISO-8601>] DAILY-UPDATE fresh=N stale=N missing=N index_added=N hot_refreshed=true|false
   ```
6. **报告**——来源状态、索引状态、hot 页状态、过期来源列表。

### 定时任务设置

首次设置时：验证脚本存在 → 检测 OS 选择调度器（macOS launchd / Linux systemd / cron 回退）→ 安装定时调度器（每天 09:00）→ 可选安装终端通知 → 运行一次初始化。

---

## 模式三：状态审计 — 增量与完整性

计算 wiki 当前状态：什么已摄取、什么待处理、增量如何。此模式**只读**——`r` / `rw` / `rwd` 任一均可。

### 步骤

1. **扫描当前来源**——Glob `SIYUAN_SOURCES_DIR` 中的文档、`CLAUDE_HISTORY_PATH` 中的 Claude 历史、manifest 中记录的其他来源。
2. **计算增量**——比较当前来源与 manifest：新（磁盘有，manifest 无）、已修改（hash 不同）、已触碰（mtime 新但 hash 同）、未变、已删除。
3. **报告状态**——概览（总页面、可见性统计、已摄取来源数）、增量表（新来源、已修改来源）、Token 占用估算、下一步建议（按优先级排序）。
4. **下一步建议**——按优先级：暂存待处理 → _raw 待处理 → 过期核心页面 → 孤立页面 → 综合机会 → 新/已修改来源 → Lint 问题。空状态：`✅ Wiki 健康——无紧急事项。`

### 洞察分析

触发条件："wiki 洞察"、"什么是中心的"、"显示枢纽"、"wiki 结构"。

1. **构建块引用图谱**——拉取所有非系统文档，对每个文档获取反向链接。计算 `incoming[doc]`、`tags[doc]`、`category[doc]`。
2. **计算内容**：
   - **锚点页面**——按入站链接数排名前 10。高入站且高出站=连接器枢纽；高入站但零出站=汇枢纽。
   - **桥梁页面**——连接不连接的标签簇的页面，按跨簇对数排名前 5。
   - **标签簇内聚力**——cohesion < 0.15 的簇是交叉链接目标。
   - **孤立邻近建议**——从顶级枢纽链接但自身零出站链接的页面。
   - **层级建议**——推荐 `custom-tier` 变更（从不写入，仅建议）。
   - **建议问题**——从矛盾论断、桥梁页面、孤立页面中生成。
3. **输出**——写入 `/<notebook>/_insights` 并追加到 `/log`。

**跳过条件**：页面少于 20 的笔记本；刚 `wiki-rebuild` 后；`get_backlinks` 在 >500 文档上出错。
