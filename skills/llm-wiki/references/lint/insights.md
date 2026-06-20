# Wiki Lint — 图谱洞察分析

> 本文件定义 wiki 图谱的结构化洞察。前置步骤见 `shared.md`。
> 审计检查见 `audit.md`；去重和交叉链接见 `dedup.md` 和 `crosslink.md`。

## 目录

- [触发条件](#触发条件)
- [步骤 1：构建块引用图谱](#步骤-1构建块引用图谱)
- [步骤 2：计算洞察](#步骤-2计算洞察)
- [步骤 3：输出](#步骤-3输出)
- [跳过条件](#跳过条件)

---

## 触发条件

"wiki 洞察"/"什么是中心的"/"显示枢纽"/"wiki 结构"。

**只读**模式 — `r`/`rw`/`rwd` 任一均可。

## 步骤 1：构建块引用图谱

1. 执行 `shared.md` 前置步骤和注册表构建
2. 拉取所有非系统文档，对每个文档获取反向链接
3. 计算：`incoming[doc]`、`outgoing[doc]`、`tags[doc]`、`category[doc]`

## 步骤 2：计算洞察

### 锚点页面
按入站链接数排名前 10：
- 高入站 + 高出站 = **连接器枢纽**
- 高入站但零出站 = **汇枢纽**

### 桥梁页面
连接不连接的标签簇的页面，按跨簇对数排名前 5。

### 标签簇内聚力
cohesion < 0.15 的簇标记为交叉链接目标。

### 孤立邻近建议
从顶级枢纽链接但自身零出站链接的页面。

### 层级建议
推荐 `custom-tier` 变更（**从不写入，仅建议**）：
- `peripheral` + 入站 ≥ 5 → 建议提升到 `supporting`
- `supporting` + 入站 = 0 + > 90 天 → 建议降级到 `peripheral`

### 建议问题
从矛盾论断、桥梁页面、孤立页面中生成探索性问题。

## 步骤 3：输出

1. 写入 `/<notebook>/_insights`（`fs write --overwrite`）
2. 按 `shared.md` 日志格式追加：`LINT mode=insights pages_scanned=N hubs=N bridges=N cohesion_clusters=N`

## 跳过条件

- 页面 < 20 的笔记本
- 刚 `wiki-rebuild` 后
- `get_backlinks` 在 > 500 文档上出错
