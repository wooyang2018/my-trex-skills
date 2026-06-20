# Wiki Lint — 审计模式（13 项检查 + 报告）

> 本文件定义 wiki 健康审计的完整流程。前置步骤和安全协议见 `shared.md`。
> Consolidate 自动修复见 `consolidate.md`，其他模式见 lint 目录下对应文件。

## 目录

- [审计概述](#审计概述)
- [检查 1：孤立页面](#检查-1孤立页面)
- [检查 2：断链](#检查-2断链)
- [检查 3：过时页面](#检查-3过时页面)
- [检查 4：低置信度页面](#检查-4低置信度页面)
- [检查 5：矛盾论断](#检查-5矛盾论断)
- [检查 6：标签一致性](#检查-6标签一致性)
- [检查 7：分层完整性](#检查-7分层完整性)
- [检查 8：Manifest 一致性](#检查-8manifest-一致性)
- [检查 9：索引新鲜度](#检查-9索引新鲜度)
- [检查 10：热缓存新鲜度](#检查-10热缓存新鲜度)
- [检查 11：重复页面](#检查-11重复页面)
- [检查 12：Frontmatter 漂移](#检查-12frontmatter-漂移)
- [检查 13：孤儿重定向](#检查-13孤儿重定向)
- [审计报告模板](#审计报告模板)

---

## 审计概述

**只读**模式 — `r`/`rw`/`rwd` 任一权限即可。运行全部 13 项检查后生成结构化报告。

**执行顺序：**
1. 执行 `shared.md` 前置步骤（配置解析 + 权限检查 + 读取索引/manifest）
2. 执行 `shared.md` 构建页面注册表
3. 按顺序运行检查 1-13
4. 按模板生成审计报告

---

## 检查 1：孤立页面

**目标**：入站链接为 0 的页面。

1. 对注册表中的每个文档，通过 `search get_backlinks --id <doc-id> --mode both` 查询反向链接计数。
2. 入站计数 = 0 且 hpath 不在 `index`、`log`、`hot`、`_insights`、`_meta/*`、`_archives/*` 中的页面 → 孤立页面。
3. 输出列表：`hpath`、`name`、`custom-title`、`custom-created`、`custom-tier`。

**关联修复**：→ `consolidate.md` 操作 2（交叉引用救援）。

---

## 检查 2：断链

**目标**：正文中引用了不存在的页面的 `[[wikilink]]` 或块引用。

1. 对注册表中的每个文档，读取正文（`fs read`）。
2. 提取所有 `((<id> "text"))` 块引用中的 `<id>`。
3. 检查每个 `<id>` 是否在注册表中存在。
4. 不存在的 → 断链。

**关联修复**：→ `consolidate.md` 操作 1（断链修复）。

---

## 检查 3：过时页面

**目标**：`custom-updated` 超过 90 天的页面。

1. 对注册表中的每个文档，从 `ial` 解析 `custom-updated`。
2. 计算 `days_since_update = today - custom-updated`。
3. `> 90 天` → 过时；`> 180 天` → 严重过时。
4. 输出列表：`hpath`、`name`、`custom-updated`、`days_since_update`、`custom-tier`。

**关联修复**：→ `consolidate.md` 操作 3（过时标注）。

---

## 检查 4：低置信度页面

**目标**：`custom-base-confidence` < 0.4 的页面。

1. 从 `ial` 解析 `custom-base-confidence`。
2. `< 0.4` → 低置信度。
3. 输出列表：`hpath`、`name`、`custom-base-confidence`、`custom-provenance-extracted`。

---

## 检查 5：矛盾论断

**目标**：通过 `custom-relationships` `type: contradicts` 标记的页面对。

1. 拉取所有 `custom-relationships` 包含 `contradicts` 的文档。
2. 验证双向关系是否一致（A contradicts B → B 应 contradicts A）。
3. 输出矛盾对列表。

**关联修复**：→ `consolidate.md` 操作 6（矛盾标注）。

---

## 检查 6：标签一致性

**目标**：使用非规范标签（别名）或不在分类法中的未知标签的页面。

1. 读取 `/_meta/taxonomy` 获取规范标签和别名映射。
2. 对注册表中的每个文档，从 `ial` 解析 `custom-tags`。
3. 检查每个标签是否在分类法的规范标签中。如果匹配别名 → 标记为非规范；如果不在分类法中 → 标记为未知。
4. 同时标记：>5 标签的页面（不含 `visibility/` 系统标签）、未标记页面。
5. 输出：非规范标签表 + 未知标签表 + 过度标记页面表 + 未标记页面表。

**关联修复**：→ `consolidate.md` 操作 5（标签别名修正）。全面审计见 `taxonomy.md`。

---

## 检查 7：分层完整性

**目标**：`custom-tier` 与实际连接度不匹配的页面。

1. 对注册表中的每个文档，计算入站链接数（来自检查 1 的反向链接数据）。
2. `core` 层但入站 = 0 → 标记（可能是过度自信的分层）。
3. `supporting` 且入站 = 0 且 `custom-updated` > 90 天 → 建议降级到 `peripheral`。
4. `peripheral` 但入站 ≥ 5 → 建议提升到 `supporting`。
5. 无 `custom-tier` 的页面 → 标记为缺失分层（默认 `supporting`）。

**关联修复**：→ `consolidate.md` 操作 4（层级降级）。

---

## 检查 8：Manifest 一致性

**目标**：manifest 中的来源条目与实际文件系统/笔记本状态不匹配。

1. 读取 manifest，对每个来源条目检查：
   - `source_type: document` — 文件是否仍存在于 `SIYUAN_SOURCES_DIR`？
   - `source_type: url` — `source_url` 是否有效？
   - `pages_created` / `pages_updated` — 这些 hpath 是否仍在笔记本中存在？
2. 输出：缺失来源、缺失页面、不匹配条目。

---

## 检查 9：索引新鲜度

**目标**：`/<notebook>/index` 与笔记本实际内容不匹配。

1. 从注册表获取当前所有页面。
2. 读取 `/<notebook>/index`，提取其中列出的页面。
3. 比较：索引中有但笔记本中不存在的页面（幽灵条目）、笔记本中有但索引中不存在的页面（未索引页面）。
4. 输出：不匹配列表。

---

## 检查 10：热缓存新鲜度

**目标**：`/<notebook>/hot` 超过 48 小时未更新。

1. 读取 `/<notebook>/hot`，检查 `updated` 时间戳。
2. `> 48 小时` → 过时。

---

## 检查 11：重复页面

**目标**：覆盖同一概念但以不同名称存在的页面。

1. 对注册表中的每对页面，计算相似度得分（标题词元重叠 + 编辑距离 + 子串包含 + 别名交叉匹配 + 语义信号——同 category +0.10、标签重叠 ≥3 共享 +0.15、≥2 共享 +0.05）。
2. 得分 ≥ 0.75 → 候选；≥ 0.90 → 高置信度。
3. 输出候选对列表。

**完整去重流程**（语义裁决 + 合并执行）→ `dedup.md`。

---

## 检查 12：Frontmatter 漂移

**目标**：正文 YAML frontmatter 与 `custom-*` 属性不匹配。

1. 对注册表中的每个文档，从 `ial` 读取 `custom-*` 属性。
2. `fs read` 读取正文，解析 YAML frontmatter。
3. 比较以下字段：`title` vs `custom-title`、`tags` vs `custom-tags`、`summary` vs `custom-summary`、`base_confidence` vs `custom-base-confidence`、`lifecycle` vs `custom-lifecycle`、`tier` vs `custom-tier`。
4. 不匹配 → 漂移。
5. 输出：漂移字段列表。

---

## 检查 13：孤儿重定向

**目标**：`custom-redirects-to` 指向不存在页面的重定向存根。

1. 拉取所有 `custom-redirects-to` 非空的文档。
2. 解析 `redirects_to` 中的 doc-id，检查是否在注册表中存在。
3. 不存在的 → 孤儿重定向。
4. 同时检查：重定向存根是否仍有入站链接（应为 0——所有链接应已重写到规范页面）。

---

## 审计报告模板

审计完成后生成结构化报告：

```markdown
## Wiki 审计报告 — <YYYY-MM-DD>

### 摘要
- 总页面：N
- 孤立页面：N
- 断链：N
- 过时页面（>90天）：N
- 严重过时（>180天）：N
- 低置信度页面：N
- 矛盾对：N
- 标签问题：N
- 分层不匹配：N
- Manifest 不一致：N
- 索引不匹配：N
- 重复候选：N
- Frontmatter 漂移：N
- 孤儿重定向：N

### 详细发现

#### 孤立页面（N）
| hpath | 标题 | 创建日期 | 层级 |
|---|---|---|---|
...

#### 断链（N）
| 来源页面 | 断链目标 |
|---|---|
...

（... 每个检查的详细表格 ...）

### 建议
- 运行 `wiki-lint --consolidate` 自动修复 N 个问题
- 运行 `wiki-lint --dedup` 处理 N 个重复候选
- 运行 `wiki-lint --crosslink` 添加缺失交叉引用
```

审计完成后，按 `shared.md` 日志写入格式追加到 `/log`：

```
- [<TIMESTAMP>] LINT mode=audit pages_scanned=N issues_found=M issues_fixed=0
```
