# Wiki Report — 仪表板 + 知识摘要

> 链接格式：所有内部链接使用思源原生块引用 `((<doc-id> "display text"))`。详见 `references/constitution.md` §15 + §13 校准说明 7。

你正在生成 wiki 的报告和视图。本技能整合两种互补的报告功能：**仪表板**（SQL 渲染的 markdown 结构化视图）和**摘要**（可读的通讯风格知识总结）。所有读写都通过 `siyuan-sisyphus` 进行。

## 开始之前

遵循 `references/constitution.md` §16 配置解析协议，获取 `SIYUAN_NOTEBOOK_ID` 和 `SIYUAN_NOTEBOOK_NAME`。然后运行预检：
```
siyuan-sisyphus --version
siyuan-sisyphus notebook get-permissions --notebook "<SIYUAN_NOTEBOOK_ID>"
```
- **仪表板模式**是写入类 — 需要 `rwd`
- **摘要模式**是只读类 — `r`/`rw`/`rwd` 任一均可

最后读取 `/<SIYUAN_NOTEBOOK_NAME>/_meta/taxonomy` 和 `/<SIYUAN_NOTEBOOK_NAME>/index` 了解笔记本当前范围。

---

## 模式一：仪表板 — SQL 渲染的 Markdown 视图

在 `/_meta/<dashboard-name>` 下生成仪表板文档——正文是 **`query_sql` 输出的快照，渲染为 markdown 表格或卡片列表**，加上 SQL 本身放在围栏块中供用户（或重新运行）随时刷新。

**思源 vs Obsidian 模型。** Obsidian 有 Bases 和 Dataview——都在视图时动态渲染。思源有原生**数据库块**（3.0+）提供类似动态视图，但 `siyuan-sisyphus` CLI 不暴露干净的方式以编程方式搭建或更新它们。务实的方法是：运行 `query_sql`，将行渲染为 markdown 表格放在普通文档中，定期重新运行（廉价——重新运行此技能替换正文；文档 id 和反向链接保留）。

### 步骤 D1：选择配方

将用户意图匹配到以下规范配方之一。如果是全新的请求，编写自定义 SQL 并复用渲染逻辑。

| 配方 | 显示内容 | 默认 slug |
|---|---|---|
| `content-index` | 所有活跃页面按类别分组，按更新时间排序 | `_meta/content-index` |
| `concepts-by-tag` | 概念页面按首标签分组，含摘要 | `_meta/concepts-by-tag` |
| `entities-tracker` | 实体页面以卡片样式列表显示 | `_meta/entities-tracker` |
| `recent-ingests` | 页面按 `custom-created` 日期降序 | `_meta/recent-ingests` |
| `stale-pages` | `custom-updated` 超过 30 天的页面 | `_meta/stale-pages` |
| `projects-overview` | 项目页面含最后同步日期 | `_meta/projects-overview` |
| `research-tracker` | 标记为 `research` 的综合页面 | `_meta/research-tracker` |
| `tag-cardinality` | 每个标签及使用页面数 | `_meta/tag-cardinality` |
| `backlink-leaderboard` | 前 50 个最多引用的页面 | `_meta/backlink-leaderboard` |
| `lifecycle-status` | 页面按 `custom-lifecycle` 分组 | `_meta/lifecycle-status` |

### 步骤 D2：运行查询

每个配方对应一次 `query_sql` 调用。始终包含 `box='<SIYUAN_NOTEBOOK_ID>'` 和 `LIMIT`。

> **注意**：根据校准说明，在 SQL 中避免 `hpath NOT LIKE '/_%'`（被权限层静默过滤）。拉取完整列表后客户端过滤 `/_` 前缀。

**`content-index` 示例：**

```
siyuan-sisyphus search query_sql --stmt "
  SELECT id, hpath, name, ial FROM blocks
  WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>'
  ORDER BY hpath
  LIMIT 1000
"
```

客户端按 hpath 首段分组，按类别渲染为分区。

**`backlink-leaderboard` 示例（需要两步）：**

```
# 1. 注册表
siyuan-sisyphus search query_sql --stmt "
  SELECT id, hpath FROM blocks
  WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>'
  LIMIT 200
"

# 2. 对每个 id，计数反向链接
for id in <ids>; do
  siyuan-sisyphus search get_backlinks --id "$id" --mode both --json | jq '.linkRefsCount'
done
```

按计数降序排列，取前 50。

### 步骤 D3：渲染为 Markdown

仪表板文档正文遵循固定形状，使重新运行确定性且用户可识别为仪表板：

```markdown
---
title: "<仪表板标题>"
category: _meta
tags: [dashboard, <配方>]
custom-rebuild-query: |
  SELECT id, hpath, ial FROM blocks
  WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>' AND hpath LIKE '/concepts/%'
  LIMIT 1000
custom-rebuild-recipe: <配方名>
custom-rebuild-at: <ISO-8601>
custom-row-count: <N>
summary: "<配方>快照；重新运行 /wiki-report dashboard <配方> 刷新。"
lifecycle: supporting
---

# <仪表板标题>

快照拍摄于 <ISO-8601>。重新运行 `/wiki-report dashboard <配方>` 刷新——此技能原地替换正文；文档 id 和指向此页面的反向链接保留。

## <组标签> (<计数>)

| 页面 | 标签 | 摘要 | 更新时间 |
|---|---|---|---|
| ((doc-id "page-title")) | tag-a, tag-b | <摘要摘录> | <YYYY-MM-DD> |

## 重建查询

```
<与 custom-rebuild-query 中相同的 SQL>
```

## 如何转换为思源数据库块

如果要在思源编辑器内进行过滤/排序/分组：
1. 在思源中打开此文档。
2. 将光标定位在表格处，输入 `/数据库`（或 `/Database`）。
3. 选择"从本文档子节点"或"从笔记本"。
4. 配置列以镜像上方 markdown 表格。
5. 数据库块动态更新；之后可删除静态表格。
```

frontmatter 中的 `custom-rebuild-recipe` 让重新运行能找到此仪表板。

### 步骤 D4：写入仪表板文档

使用规范的两次调用模式：

```
# 1. 整页写入
siyuan-sisyphus fs write \
  --path "/<SIYUAN_NOTEBOOK_NAME>/_meta/<dashboard-slug>" \
  --markdown "<渲染的正文>" \
  --overwrite

# 2. 镜像 frontmatter 到 custom-* 属性
DOC_ID=$(siyuan-sisyphus document lookup \
  --notebook "<SIYUAN_NOTEBOOK_ID>" \
  --hpath "/_meta/<dashboard-slug>" \
  --json | jq -r '.idPath.path' | awk -F/ '{print $NF}' | sed -E 's|\.sy$||')
siyuan-sisyphus block set-attrs \
  --id "$DOC_ID" \
  --attrs '{"custom-title":"<仪表板标题>","custom-category":"_meta","custom-tags":"dashboard,<recipe>","custom-rebuild-recipe":"<recipe>","custom-rebuild-at":"<ISO-8601>","custom-row-count":"<N>","custom-lifecycle":"supporting"}'
```

### 步骤 D5：更新跟踪

追加到 `/log`：

```
siyuan-sisyphus block append --parent-id <log-doc-id> --data-type markdown \
  --data "- [<ISO-8601>] REPORT mode=dashboard recipe=<recipe> slug=<dashboard-slug> rows=<N>"
```

不要触碰 `/index` 或 `/_meta/manifest`——仪表板是派生快照，不需要 manifest 条目。

---

## 模式二：摘要 — 知识通讯生成器

生成近期 wiki 活动的可读摘要：学到了什么、更新了什么、出现了什么主题、什么值得回顾。此技能总结**知识**，而非来源——把它想象成每周回顾会，而非摄取状态报告。

### 步骤 E1：收集周期内活跃的页面

单次 SQL 查询拉取每个文档及其 `custom-created` 和 `custom-updated`：

```
siyuan-sisyphus search query_sql --stmt "
  SELECT id, hpath, ial FROM blocks
  WHERE type='d'
    AND box='<SIYUAN_NOTEBOOK_ID>'
  LIMIT 5000
"
```

客户端过滤 `/_` 前缀子树和 `index`/`log`/`hot`/`_insights` 及之前的摘要文档。

解析 `custom-created` 和 `custom-updated`。分类：
- **新页面**：`custom-created` 在周期内
- **更新页面**：`custom-updated` 在周期内但 `custom-created` 在周期前
- **未变**：两个日期都不在周期内 → 跳过

如果活跃页面少于 5 个，提示用户是否扩大范围。

### 步骤 E2：识别主题

从所有活跃页面的标签中统计主题频率，取前 5。同时读取分类法文件，标记不在分类法中的新词汇标签。

注意哪个类别增长最多。

### 步骤 E3：发现值得注意的新连接

扫描新和更新页面中的跨类别 wikilinks——桥接不同知识层的链接。这些是周期内最具知识趣味的产出。

按趣味度排名：
- **+3** 如果链接跨两个很少连接的类别
- **+2** 如果目标页面是前 10 枢纽
- **+2** 如果链接出现在 `synthesis/` 页面中
- **+1** 如果源页面标记为 `^[inferred]`

取前 3-5 个连接，每个写成简洁的中文句子说明为什么有趣。

### 步骤 E4：呈现待解线索

扫描活跃页面和 `_raw/` 获取未解决的工作：
- **草稿**：`lifecycle: draft` 的页面
- **歧义论断**：跨所有活跃页面统计 `^[ambiguous]` 标记
- **未暂存笔记**：`_raw/` 中的文件数
- **分类法缺口**：不在分类法中的标签

### 步骤 E5：选择推荐重读

从周期前已有的页面中，识别 2-3 个鉴于本周新上下文值得重访的。启发式：找到与活跃页面共享最多标签的周期前页面——新页面建立在它们之上但用户可能未重访基础。

也包括因新入站链接而变得更连接的周期前页面。

每个推荐附带具体原因。

### 步骤 E6：生成摘要

```markdown
# Wiki 摘要 — [周期标签]
> [N 个新页面 · M 个更新页面 · 周期：YYYY-MM-DD 至 YYYY-MM-DD]

## 头条

- [具体洞察 #1——综合实际知识，不只是"学到了 X"]
- [具体洞察 #2]
- [具体洞察 #3]

## 新知识

### 新页面（[计数]）
| 页面 | 类别 | 摘要 |
|---|---|---|
| ((doc-id-a "concepts/foo")) | concept | frontmatter 中的一句话摘要 |

### 值得注意的更新（[计数]）
| 页面 | 变更内容 |
|---|---|
| ((doc-id-b "skills/react-hooks")) | 添加了 useCallback 与 async effects 的模式 |

## 新兴主题

- **#[tag]**（[N 个页面]）——[一句话说明为何此主题活跃]
- **#[NEW TAG]**（[N 个页面]）⭐ *新词汇——尚不在分类法中*

最活跃类别：**[category/]**（[N 个页面添加或更新]）

## 建立的关键连接

- ((doc-id-a "concepts/A")) → ((doc-id-b "entities/B")) — [简洁说明此连接为何有趣]
- ((doc-id-x "synthesis/X")) 创建——首次桥接 ((doc-id-y "concepts/Y")) 和 ((doc-id-z "concepts/Z"))

## 待解线索

- **待编译草稿**（[计数]）：((doc-id-a "concepts/foo")), ((doc-id-b "concepts/bar"))
- **歧义论断**：[N] 个 `^[ambiguous]` 标记跨 [M] 个页面
- **未暂存笔记**：[N] 个文件在 `_raw/` 中
- **分类法缺口**：标签 `#newtag1`, `#newtag2` 未在分类法中

## 推荐重读

- ((doc-id-x "concepts/X")) — [具体原因："本周 3 篇新论文都扩展了此概念"]
- ((doc-id-y "synthesis/Y")) — [具体原因："本周创建的 2 个新页面引用了它"]

---
*由 wiki-report 生成 · [TIMESTAMP] · [N 个页面扫描于 <SIYUAN_NOTEBOOK_NAME>]*
```

**可见性**：如果页面标记为 `visibility/pii`，从所有表格和连接列表中排除（但在总数中计数，标注为"+ N 个私密页面"）。

### 步骤 E7：输出和可选保存

**默认（聊天输出）**：直接打印摘要。最后询问："要保存为 `journal/digest-YYYY-MM-DD.md` 吗？"

**如果用户前缀"save"或"write"**：
- 写入 `/<SIYUAN_NOTEBOOK_NAME>/journal/digest-YYYY-MM-DD.md`
- 添加 frontmatter（title、category: journal、tags: [digest, meta/review]、created、updated、summary）
- 更新 `/<SIYUAN_NOTEBOOK_NAME>/index` 在 Journal 下添加新条目
- 不添加到 `/_meta/manifest`（摘要不是来源摄取）

---

## 操作完成后

追加到 `/<SIYUAN_NOTEBOOK_NAME>/log`：

```
- [<ISO-8601>] REPORT mode=dashboard recipe=<recipe> slug=<slug> rows=<N>
- [<ISO-8601>] REPORT mode=digest period="<period>" new_pages=N updated_pages=M themes=T connections=C saved=<true|false>
```

## 边缘情况

| 情况 | 处理 |
|---|---|
| 仪表板触及不存在的类别 | 渲染空表格并注明"在 <时间> 无匹配页面" |
| `backlink-leaderboard` 在 >200 页面注册表上 | 警告用户 `get_backlinks` 调用可能耗时数秒 |
| 活跃页面少于 5 个 | 提议扩大周期；仅在用户确认后继续 |
| 空笔记本 | 告诉用户先运行摄取；停止 |
| 无 `_meta/taxonomy.md` | 跳过分类法缺口检查 |
| 所有页面都是 `visibility/pii` | 报告"N 个私密页面本周活跃"无详情；提供完整模式 |
| 重新运行找到两个相同配方的仪表板 | 呈现冲突并询问用户刷新哪个 |

## 注意事项

- **头条是回报。** 不要列页面标题——综合实际学习。如果本周学到了注意力机制，头条应捕捉洞察，不只是说"添加了 3 个 transformer 页面"。
- **重读推荐要具体。** "此页面相关"无用。"本周 3 篇论文都引用了此页面中的同一论断"是可操作的。
- 仪表板不触碰 `/index` 或 `/_meta/manifest`——它们是派生快照。
- 摘要不修改现有 wiki 页面——唯一写入是可选的 journal 页面和 log 追加。
- 不要与 `wiki-maintenance` 重复——如果用户问"什么需要摄取"或"增量是什么"，路由到维护技能。
