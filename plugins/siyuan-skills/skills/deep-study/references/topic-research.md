# Topic Research — 网络多源专项调研

对一个技术主题（如"Go 垃圾收集算法"）做多源深度调研，产出 concept 页面（L1-L4）+ 面试追问链 + 实践方案，写入 wiki。

## 多源质量分级

调研须覆盖多类来源并按质量分级优先：

| 级别 | 来源类型 | 示例 | 角色 |
|---|---|---|---|
| T0 权威源 | 官方文档 / 规范 / 顶会论文 / 权威书籍 / 源码 | go.dev blog、runtime/mgc.go、arXiv 论文 | 事实基准，综合时优先 |
| T1 高质量源 | 知名工程师博客 / 公司技术博客 / 优质中文公众号 | Dave Cheney、Cloudflare/Uber engineering blog | 深度实践视角 |
| T2 补充源 | Stack Overflow 高票答案 / GitHub issues / 技术社区 | SO、GitHub discussions | 交叉验证，不单独作依据 |

综合原则：T0 之间冲突 → 记入 `contradictions/`；T0 与 T1 冲突 → 以 T0 为准并注明；T2 仅作交叉验证，不作唯一依据。

## 检索工具组合

| 来源类型 | 工具 | 说明 |
|---|---|---|
| 通用英文检索 | `web_search` + `web_fetch` | 先 search 找 URL，再 fetch 抓全文 |
| 中文技术文章 | `wechat-article-search` skill | 公众号高质量中文内容 |
| 论文 / 官方文档 / 长文 | `defuddle parse <url> --md` 或 `web_fetch` | 抓全文 markdown，优先 defuddle |
| 源码 | `web_fetch`（GitHub raw）或 `read_file`（本地仓库） | 直读源码是最权威的 T0 |
| 本地文件 / PDF | `read_file` | 用户提供的研究素材 |

## 调研流程

### 1. 研究前查 wiki

```bash
siyuan-sisyphus search query_sql --sql "SELECT id,hpath FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' AND (hpath LIKE '/concepts/%' OR hpath LIKE '/synthesis/%') LIMIT 200" --json
siyuan-sisyphus search fulltext --query "<主题关键词>" --page 1 --page-size 20 --json
```

已有相关 concept 则在其上深化；无则新建。

### 2. 研究规划（维度拆分）

将主题拆为 3-5 个研究维度，每维度分配一个 `research_subagent`。典型维度（按主题调整）：

- **原理机制**：X 怎么工作？内部实现？T0 源码 / 官方文档
- **设计动机**：为什么这样设计？替代方案？权衡？T0 论文 / 规范
- **对比分析**：vs 竞品？优劣？T0 + T1
- **生产实践**：踩坑 / 调优 / 选型经验？T1 博客 + T2 issue
- **面试热点**：常见面试题 / 易错点？T1 + T2

### 3. 并行调度 research_subagent

用 Task 工具并行调度 `research_subagent`，每 subagent 一个维度。subagent 的 task 须包含：

- 研究维度（如"Go GC 的三色标记机制与写屏障"）
- 来源质量要求（"优先 T0：go.dev 官方文档、runtime/mgc.go 源码；T1：Dave Cheney/Cloudflare 博客"）
- 期望产出（该维度的深度事实，含 L2/L3/L4 内容）
- 工具调用预算（5-15 次）

调度示例（3 个维度并行）：

```
Task(research_subagent, "研究 Go GC 的三色标记机制与写屏障。优先 T0：go.dev blog GC 指南、runtime/mgc.go 源码。产出：三色标记流转、写屏障演进（Dijkstra→Yuasa→混合）、为什么用混合写屏障。")
Task(research_subagent, "研究 Go GC 的 STW 与调优。优先 T1：工程师博客生产经验。产出：STW 阶段、GOGC/GOMEMLIMIT 调优、sync.Pool 减压。")
Task(research_subagent, "研究 Go GC 面试热点与易错点。T1+T2。产出：常见面试追问、易混淆点（并发 vs 并行、非分代原因）。")
```

### 4. 综合交叉验证

收集各 subagent 报告后：

- 交叉验证关键事实（如"Go GC 是否分代"——多源确认非分代）。
- T0 冲突 → 创建 `contradictions/` 页面。
- 按 L1-L4 组织内容（见 `depth-standard.md`）。
- 补足 subagent 未覆盖的 L4 实战（必要时追加一轮 subagent）。

### 5. wiki 摄取

按 `deliverable.md` 的字段映射表和摄取流程写入：

- 1-3 个 concept 页面（含 L1-L3 闪卡 + 预填深入段）
- references 页面（每个 T0/T1 来源一个，含 `## Source Link`）
- 注册闪卡（复用 `../llm-wiki/references/ingest.md` 流程）
- log 追加 + index 重建

### 6. 面试追问链 + 实践方案

按 `depth-standard.md` 生成面试追问链（写入 `## Interview Questions`），按 `deliverable.md` 生成实践方案（写入 `## Practice Ideas` + `## Common Pitfalls`）。

## wechat-article-search 使用时机

中文技术主题（如国产框架、中文社区热点）时，在维度规划阶段加入"中文实践"维度，用 `wechat-article-search` skill 检索公众号文章。英文主题不强制使用。

加载方式：`use_skill("wechat-article-search")`，按其指引搜索。搜索时加时间参数限制近期内容。

## subagent 调度策略

- **维度数 = subagent 数**：3-5 个维度，并行调度（一条消息内多个 Task 调用）。
- **每 subagent 独立 OODA**：subagent 自行决定查询和抓取，不干预。
- **来源质量写进 task**：在 task 描述里明确"T0 优先 + 具体 T0 来源 URL 提示"，避免 subagent 沉迷 T2。
- **工具预算**：5-15 次 / subagent，简单维度 5 次，复杂维度 15 次。
- **不自带 agents/**：本技能不定义自己的 subagent，复用 Task 工具的 `research_subagent`。
