# Wiki Lint — 交叉链接（自动化交叉引用）

> 本文件定义在应互相引用但当前没有的页面之间插入思源原生块引用的完整流程。
> 前置步骤见 `shared.md`。去重见 `dedup.md`（建议去重后运行交叉链接）。

## 目录

- [交叉链接概述](#交叉链接概述)
- [步骤 C1：构建页面注册表](#步骤-c1构建页面注册表)
- [步骤 C2：扫描缺失链接](#步骤-c2扫描缺失链接)
- [步骤 C3：评分和排名建议](#步骤-c3评分和排名建议)
- [步骤 C4：应用链接](#步骤-c4应用链接)
- [步骤 C5：评分 Misc 页面亲和力](#步骤-c5评分-misc-页面亲和力)
- [步骤 C6：报告](#步骤-c6报告)

---

## 交叉链接概述

通过在应互相引用但当前没有的页面之间插入**思源原生块引用**来收紧 wiki 的知识图谱。

**关键语法**：思源不解析 `[[wikilink]]` markdown。唯一产生图谱边的语法是 `((<doc-id> "display text"))`。本技能专门发出此形式。

**写入类** — 需要 `rwd` 权限。

---

## 步骤 C1：构建页面注册表

执行 `shared.md` 前置步骤和注册表构建，附加 `block get-attrs --id <doc-id>` 获取每个页面的 `custom-title`、`custom-aliases`、`custom-tags`、`custom-category`、`custom-tier`。

构建查找表：`hpath → { doc_id, name, title, aliases, tags, category, tier }`。

**ALIAS_MAP 覆盖层**：维护内存中的 `ALIAS_MAP`（`{phrase: hpath}`），用于需要不在 `name` 或 `aliases` 中的表面形式的链接目标。持久化有前景的条目到 `_meta/manifest._meta.cross_linker.alias_map` 供下次运行种子化。ALIAS_MAP 条目优先于名称/标题匹配。保持映射小（< 50 条目）。

---

## 步骤 C2：扫描缺失链接

对注册表中的每个页面（或增量模式下仅上次运行后更新的页面）：

1. **读取页面正文** — `fs read --path "/<SIYUAN_NOTEBOOK_NAME>/<hpath>"`
2. **遮蔽非散文区域** — 围栏代码块、行内代码、现有块引用、YAML frontmatter
3. **提取现有出站引用集** — 这些 doc id 不应从此页面重新链接
4. **未链接提及的廉价测试** — 对每个候选目标，检查 `name`/`title`/`aliases` 中是否有字符串出现在遮蔽的正文中
5. **标签/类别候选** — 找到共享 ≥ 2 标签的其他页面，以及相邻类别层中的页面

**匹配规则**：
- 大小写不敏感匹配
- 变音符号不敏感匹配 — Unicode NFKD 归一化
- 跳过自引用
- 跳过 < 4 字符的常见词或在停用词表中的词
- 不要双重链接 — 目标已在现有块引用集中则跳过
- 从右到左应用替换 — 按起始偏移降序排列
- 每页上限 8–10 个链接

---

## 步骤 C3：评分和排名建议

| 信号 | 分值 | 示例 |
|---|---|---|
| **精确名称/标题/别名匹配** | +4 | "git-ai 技术全景" 出现在正文中 |
| **ALIAS_MAP 覆盖命中** | +4 | "记忆系统" 映射到特定页面 |
| **共享标签（2+）** | +2 | 都标记为 `ai, agent` 但无链接 |
| **同项目，无链接** | +2 | 都在 `/projects/my-project/` 下 |
| **跨类别连接** | +2 | 源在 `/concepts/`，目标在 `/entities/` |
| **外围→枢纽** | +2 | 源 ≤ 2 出站，目标 ≥ 8 入站 |
| **部分名称匹配** | +1 | "graph" 出现但页面是 `knowledge-graphs` |

| 得分 | 标签 | 操作 |
|---|---|---|
| ≥ 6 | **提取** | 内联应用 |
| 3–5 | **推断** | 内联或 Related 部分应用 |
| 1–2 | **歧义** | 跳过 |

---

## 步骤 C4：应用链接

在内存中构建合并正文，每页一次 `fs write --overwrite` 写回。

### 4a：内联链接（首选）
找到术语在正文中首次自然提及并包裹块引用：
```markdown
This project uses ((20260525220651-4ptqo4v "knowledge graphs")) to connect entities.
```

### 4b：Related 部分（回退）
如果术语未被自然提及但页面语义相关，在底部添加：
```markdown
## Related

- ((20260525220644-9rpxnqo "git-ai 技术全景")) — Also covers AI-driven development workflows
- ((20260525220651-4ptqo4v "knowledge graphs")) — Core technique used here
```

### 4c：推断并写入关系类型
从周围句子推断语义关系类型并写入 `custom-relationships`：

| 句子模式 | 推断类型 |
|---|---|
| "X extends / builds on Y" | `extends` |
| "X implements Y" | `implements` |
| "X contradicts / opposes Y" | `contradicts` |
| "X is derived from Y" | `derived_from` |
| "X uses / relies on Y" | `uses` |
| "X replaces / supersedes Y" | `replaces` |
| 共享标签或跨类别，无方向线索 | `related_to` |

```
block set-attrs --id <doc-id> \
  --attrs '{"custom-relationships":"<compact-json>","custom-updated":"<TIMESTAMP>"}'
```

---

## 步骤 C5：评分 Misc 页面亲和力

对 `/misc/` 中的每个页面（或 `custom-promotion-status=misc`）：

1. 收集出站块引用和入站反向链接
2. 按项目分组链接的页面
3. 更新 `custom-affinity`：`{"custom-affinity":"siyuan-wiki:3,another-project:1"}`
4. 项目得分 ≥ 3 → 标记为**提升候选**

---

## 步骤 C6：报告

```markdown
## 交叉链接报告

### 已添加链接：23 个，跨 12 个页面（每页上限=10）
| 页面 | 添加链接数 | 置信度 | 放置位置 | 关系类型 |
|---|---|---|---|---|
| `/synthesis/git-ai 技术全景` | 4 | 提取 | 内联 | uses×3, related_to×1 |
| `/references/git-svn 知识全面介绍` | 3 | 提取 | 内联 | derived_from×1, uses×2 |

### refs 表中的边：40
### 剩余孤立页面：2
### Misc 提升候选：N
### 跳过的页面：3
```

边计数通过 `refs` 表验证（`shared.md` 注意事项：始终带 `box=`，客户端计数）。

完成后按 `shared.md` 更新跟踪文件，日志格式：`LINT mode=crosslink pages_scanned=N links_added=M misc_promotions=P`。
