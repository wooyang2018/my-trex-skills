# Wiki Lint — Consolidate 自动修复

> 本文件定义基于审计结果的自动修复流程。审计检查见 `audit.md`，前置步骤和安全协议见 `shared.md`。
> 去重和交叉链接有各自独立流程，不在此模式范畴内——分别见 `dedup.md` 和 `crosslink.md`。

## 目录

- [Consolidate 模式](#consolidate-模式)
- [安全协议](#安全协议)
- [操作 1：修复断链](#操作-1修复断链)
- [操作 2：为孤立页面添加交叉引用](#操作-2为孤立页面添加交叉引用)
- [操作 3：纠正生命周期状态](#操作-3纠正生命周期状态)
- [操作 4：层级降级](#操作-4层级降级)
- [操作 5：标签别名修正](#操作-5标签别名修正)
- [操作 6：矛盾标注](#操作-6矛盾标注)
- [操作 7：写入合并报告](#操作-7写入合并报告)
- [试运行输出](#试运行输出)

---

## Consolidate 模式

**触发**：用户说"修复"/"自动修复"/"consolidate"。**需要 `rwd` 权限**。

从仅报告切换到**执行-并-报告**——定期运行使 wiki 自愈。

## 安全协议

遵循 `shared.md` 安全协议，增加以下 Consolidate 特有约束：

1. 运行 `audit.md` 的全部 13 项检查
2. 以结构化列表打印计划操作（见下方试运行输出）
3. 询问用户确认
4. 仅在明确确认后执行写入
5. **切勿合并页面**——合并是 `dedup.md` 的职责。Consolidate 只链接、提升、降级和标注

---

## 操作 1：修复断链

对 `audit.md` 检查 2 中发现的每个断链目标：

- 在注册表的 `name`、`custom-title` 和 `custom-aliases` 中搜索模糊匹配（Levenshtein ≤ 2 或共享词根）
- **存在唯一最佳匹配**：用 `fs replace` 重写正文中的链接
  ```
  siyuan-sisyphus fs replace \
    --path "/<SIYUAN_NOTEBOOK_NAME>/<source-hpath>" \
    --old "[[<old-target>]]" \
    --new "((<correct-doc-id> \"<correct-title>\"))"
  ```
- **无匹配或模糊**：将链接转为纯文本并通过 `block append` 添加注释行
- **切勿**仅为满足断链而创建新页面

---

## 操作 2：为孤立页面添加交叉引用

对 `audit.md` 检查 1 中发现的每个孤立页面：

1. 运行 `search fulltext --query "<orphan title>"` 和 `--query "<each alias>"`
2. 对每个以纯文本提及孤立页面但无链接的命中页面，用 `fs replace` 将第一个自然提及包裹在块引用中
3. 限制每个孤立页面最多 3 次插入——不要用链接淹没页面

---

## 操作 3：纠正生命周期状态

自动应用——这些规则强制执行文档化的状态机，无需人工判断：

**提升 `draft` → `reviewed`**：`custom-lifecycle: draft` 且 `custom-created` > 30 天前 且 `custom-base-confidence > 0.7` 的页面：
```
block set-attrs --id <doc-id> --attrs '{
  "custom-lifecycle":"reviewed",
  "custom-lifecycle-changed":"<today>",
  "custom-lifecycle-reason":"auto-promoted by wiki-lint: age>30d, confidence>0.7"
}'
```
同时更新正文 YAML（`fs write --overwrite`）。

**过时标注（`verified` + > 180 天）**：不改变 lifecycle 值。在正文前部添加标注块：
```
> ⚠️ **过时**：此页面最后更新于 <date>。依赖前请验证。
```
使用 `fs replace` 插入，仅在标注尚不存在时添加。`stale` 是计算叠加层，不是状态转换。

**不要更改** `reviewed` → `verified` 或任何其他转换——仅限人工。

---

## 操作 4：层级降级

对于 `custom-tier: supporting`（或未设置）且有 0 个入站链接且 90+ 天未更新的页面：

```
block set-attrs --id <doc-id> --attrs '{"custom-tier":"peripheral"}'
```

- 如果正文有 `tier:` 行则镜像到正文 YAML
- 输出降级列表供用户审查
- **不要自动降级** `custom-tier: core` 页面

---

## 操作 5：标签别名修正

`fs read /<SIYUAN_NOTEBOOK_NAME>/_meta/taxonomy` 获取别名映射（如 `ml → machine-learning`）。对每个注册表页面，在 `custom-tags` 中将别名标签替换为其规范形式。

这是 `taxonomy.md` 标签分类法模式的子集——仅别名修复，无全面审计。

---

## 操作 6：矛盾标注

对 `audit.md` 检查 5 中标记的每对矛盾页面：

1. 读取正文并检查相关论断附近是否已存在 `> ⚠️ 与 [[Other Page]] 的矛盾标注`
2. 如果不存在，在"关键想法"部分末尾插入
3. **不要解决矛盾**；只标注

---

## 操作 7：写入合并报告

所有操作完成后，按 `shared.md` 写入模式将报告写入 `/<SIYUAN_NOTEBOOK_NAME>/synthesis/consolidation-<YYYY-MM-DD>`：

两步写入法：先 `fs write --overwrite` 写正文，再 `block set-attrs` 写元数据。

```markdown
# 合并报告 — <YYYY-MM-DD>

## 摘要
- 修复的断链：N
- 添加的交叉引用：M
- 更新的生命周期状态：K
- 层级降级：D
- 规范化的标签：T
- 添加的矛盾标注：C

## 断链修复
| 来源 | 旧目标 | 新目标 |
|---|---|---|
| `/concepts/foo` | [[OldTarget]] | ((doc-id "correct-target")) |

## 添加的交叉引用（孤立页面救援）
| 孤立页面 | 现在链接自 |
|---|---|
| `/concepts/baz` | ((doc-id-a "alpha")), ((doc-id-b "beta")) |

## 生命周期更新
| 页面 | 变更 | 原因 |
|---|---|---|
| `/concepts/old-draft` | draft → reviewed | 年龄 45 天，置信度 0.74 |

## 层级降级
| 页面 | 变更 | 原因 |
|---|---|---|
| `/concepts/unused` | supporting → peripheral | 0 链接，120 天过时 |

## 标签规范化
| 页面 | 旧标签 | 新标签 |
|---|---|---|
| `/entities/some-tool` | ml | machine-learning |

## 矛盾标注
| 页面 | 标注 |
|---|---|
| `/concepts/scaling` | 标记与 ((doc-id "efficiency")) 的矛盾 |
```

元数据：`custom-title="Consolidation Report <YYYY-MM-DD>"`, `custom-category="synthesis"`, `custom-tags="maintenance,consolidation"`, `custom-lifecycle="draft"`, `custom-tier="peripheral"`。

---

## 试运行输出

在任何写入前显示：

```
wiki-lint --consolidate — 试运行

计划操作（共 N 个）：
[1] 修复断链：/concepts/foo 第 12 行 [[OldTarget]] → ((doc-id "correct-target"))
[2] 添加交叉引用：孤立页面 /concepts/baz ← 来自 ((doc-id-a "alpha"))
[3] 生命周期：/concepts/old-draft → reviewed（年龄 45 天，置信度 0.74）
[4] 层级降级：/concepts/unused → peripheral（0 链接，112 天过时）
[5] 标签别名：/entities/some-tool: ml → machine-learning
[6] 矛盾标注：/concepts/scaling ↔ ((doc-id "efficiency"))

应用这 6 个更改？[yes / no / select by number]
```

完成后按 `shared.md` 日志格式写入：`LINT mode=consolidate pages_scanned=N links_fixed=N orphans_rescued=M lifecycle_updates=K tier_demotions=D tag_fixes=T contradiction_callouts=C`。
