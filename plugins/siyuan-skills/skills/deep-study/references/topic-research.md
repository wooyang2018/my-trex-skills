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
| 源码 | `web_fetch`（GitHub raw URL）或 `read_file`（本地仓库） | 直读源码是最权威的 T0 |
| 本地文件 / PDF | `read_file` | 用户提供的研究素材 |

## 调研流程

### 1. 研究前查 wiki

```bash
siyuan-sisyphus search query_sql --sql "SELECT id,hpath FROM blocks WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d' AND (hpath LIKE '/concepts/%' OR hpath LIKE '/synthesis/%') LIMIT 200" --json
siyuan-sisyphus search fulltext --query "<主题关键词>" --page 1 --page-size 20 --json
```

已有相关 concept 则在其上深化；无则新建。

### 2. 研究规划（维度拆分 + 问题细化）

将主题拆为 3-5 个研究维度，每维度进一步拆成 3-5 个**具体问题**。不是一句话维度描述，而是可直接搜索的精确问题。典型维度（按主题调整）：

- **原理机制**：X 怎么工作？内部实现？
  - 灰色队列的数据结构是什么？Per-P 本地缓存如何工作？
  - gcDrain 函数的执行路径是什么？三种 worker 模式如何切换？
  - 写屏障的插入路径在哪？`typedmemmove` → `writeBarrier` 的调用链？
  - T0 源码 / 官方文档

- **设计动机**：为什么这样设计？替代方案？权衡？
  - 为什么不用分代 GC？Go 的分配器已经做了什么让分代收益变小？
  - Dijkstra 屏障的栈重扫问题——具体在哪个版本、什么场景下 STW 最严重？
  - 为什么选混合写屏障而不是纯 Yuasa？Yuasa 的波面后退是什么？
  - T0 论文 / 规范

- **对比分析**：vs 竞品？优劣？
  - Go GC vs Java G1/ZGC：STW、吞吐、堆占用各自多少？
  - Go GC vs Rust（无 GC）：各自在什么场景下更合适？
  - T0 + T1

- **生产实践**：踩坑 / 调优 / 选型经验？
  - GOGC=50 vs 100 vs 200 在真实服务中 P99 延迟差多少？有具体数据吗？
  - Mark Assist 在什么条件下被触发？它如何影响用户 goroutine 延迟？
  - GOMEMLIMIT 在容器环境如何配置？OOM 前的 GC 行为是什么？
  - T1 博客 + T2 issue

- **面试热点**：常见面试题 / 易错点？
  - "并发 GC" 和 "并行 GC" 的区别——哪些来源讲清楚了？
  - GOGC=0 是什么效果？常见误解是什么？
  - T1 + T2

### 3. 源码强制追踪

至少一个维度必须做源码追踪。源码追踪不是"提到了源码文件名"，而是实际读取源码并提取：

- **关键函数签名**：函数名、参数、返回值
- **调用链**：谁调用了这个函数、它调用了什么
- **关键数据结构**：struct 定义、字段含义
- **行号引用**：在 concept 页面中标注 `runtime/mgc.go:L234`

操作方式：

```bash
# GitHub raw URL 直读源码（T0）
web_fetch("https://raw.githubusercontent.com/golang/go/master/src/runtime/mgc.go")
# 或本地仓库
read_file("/path/to/go/src/runtime/mgc.go")
```

源码追踪的产出须写入 concept 页面的 `## How It Works` 段，含函数签名和关键代码片段（不超过 20 行，超长的截取核心逻辑）。

### 4. 第一轮并行调度 research_subagent

用 Task 工具并行调度 `research_subagent`，每 subagent 一个维度。subagent 的 task 须包含：

- **研究维度 + 具体问题列表**（不是一句话，是 3-5 个精确问题）
- **来源质量要求**（"优先 T0：go.dev 官方文档、runtime/mgc.go 源码；T1：Dave Cheney/Cloudflare 博客"）
- **具体 T0 来源 URL 提示**（给 subagent 起点而非让它自己找）
- **期望产出**（该维度的深度事实，含 L2/L3/L4 内容；须包含具体数据：数字、版本号、行号引用）
- **工具调用预算：15-25 次**（简单维度 15 次，复杂维度 25 次，源码追踪维度 30 次）

调度示例（3 个维度并行，每维度含具体问题）：

```
Task(research_subagent, "研究 Go GC 的三色标记机制与写屏障。
具体问题：
1. 灰色队列的数据结构是什么？Per-P 本地缓存 gcWork 如何工作？
2. gcDrain 函数的执行路径？三种 worker 模式（dedicated/fractional/idle）如何切换？
3. 写屏障的插入路径：typedmemmove → writeBarrier.ptrWrite 的调用链？
4. Go 1.8 混合写屏障 vs Go 1.5 Dijkstra 屏障：栈重扫问题具体是什么？
优先 T0：go.dev/blog GC 指南、runtime/mgc.go + runtime/mgcsweep.go 源码。
产出：三色标记流转（含灰色队列数据结构）、写屏障演进（Dijkstra→Yuasa→混合，含调用链）、为什么用混合写屏障。
须包含具体数据：STW 精确微秒数、函数签名、源码行号引用。
工具预算：25 次。")

Task(research_subagent, "研究 Go GC 的 STW 与生产调优。
具体问题：
1. GC 周期的五个阶段各自的 STW 时长是多少微秒？
2. GOGC=50 vs 100 vs 200 在真实微服务中 P99 延迟差多少？找具体博客数据。
3. Mark Assist 在什么条件下被触发？它如何影响用户 goroutine 延迟？assist ratio 怎么算？
4. GOMEMLIMIT 在容器环境如何配置？OOM 前的 GC 行为？
5. sync.Pool 的 victim 缓存机制？对象生命周期是几个 GC 周期？
优先 T1：Ardan Labs GC 系列、Cloudflare/Uber engineering blog。
产出：STW 阶段表（含微秒数）、GOGC/GOMEMLIMIT 调优指南、sync.Pool 减压原理。
须包含具体数据。
工具预算：20 次。")

Task(research_subagent, "研究 Go GC 面试热点与易错点。
具体问题：
1. '并发 GC' 和 '并行 GC' 的区别——哪些来源讲清楚了？
2. GOGC=0 是什么效果？常见误解是什么？
3. 为什么 Go 不用分代 GC？分代假设在 Go 模型下为什么不成立？
4. 现代 Go 的 STW 已小于 1ms，真正的延迟来源是什么？GC Assist / 写屏障 / 缓存失效各占多少？
T1+T2：SO 高票答案、GitHub discussions。
产出：常见面试追问、易混淆点辨析、面试陷阱题。
工具预算：15 次。")
```

### 5. 综合交叉验证 + Gap Analysis

收集各 subagent 报告后，执行两步：

**第一步：交叉验证关键事实**

- 交叉验证关键数字（如"Go 1.8 STW 降幅"——多源确认）。
- T0 冲突 → 创建 `contradictions/` 页面。
- 按 L1-L4 组织内容（见 `depth-standard.md`）。

**第二步：Gap Analysis（必须执行，不可跳过）**

对照以下清单逐项检查，找出缺口：

| 检查项 | 达标标准 | 不达标时 |
|---|---|---|
| 源码引用 | concept 页面至少有 1 处源码行号引用（如 `runtime/mgc.go:L234`） | 追加源码追踪 subagent |
| 具体数字 | How It Works 段至少有 3 个量化数据（微秒数、内存比例、版本号等） | 追加定向搜索 subagent |
| L4 实战案例 | Common Pitfalls 至少 2 条含具体现象+原因+解法的真实案例 | 追加生产实践 subagent |
| 面试追问深度 | Interview Questions 至少有 1 个 L4 级追问能区分"背了概念"和"做过" | 补充 L4 问题 |
| 干扰项质量 | 单选题/多选题的错误选项是有道理的干扰项，不是明显荒谬选项 | 重写闪卡 |

### 6. 第二轮定向调研（Gap-Driven）

根据 Gap Analysis 结果，对不达标的检查项调度第二轮 subagent。第二轮是定向的——针对具体缺口，不是重新泛搜。

```
# 示例：第一轮源码引用不够
Task(research_subagent, "补足 Go GC 源码引用。
具体任务：读取 runtime/mgc.go 的 gcStart 函数，提取函数签名、关键调用链（gcStart→gcMark→gcDrain→gcMarkDone）、行号。
产出：可直接写入 concept 页面的源码引用段落（含函数签名 + 行号 + 20 行以内代码片段）。
优先 T0：GitHub raw URL 直读源码。
工具预算：15 次。")
```

第二轮调度的 subagent 数量视缺口数量而定，通常 0-2 个。无缺口则跳过。

### 7. 对抗性面试验证

**写入 wiki 前的最后一道关卡**。假装自己是面试官，拿着 concept 草稿提问：

1. 通读 concept 草稿的全部内容。
2. 以面试官身份提出 3 个"刁钻追问"——页面内容没有直接回答但应该能推断出的问题。
3. 检查 concept 草稿是否能回答这些追问。
4. 不能回答的问题 → 追加到 Interview Questions 段，或补充正文。

追问示例（针对 Go GC 主题）：
- "你提到了 Mark Assist，那 assist ratio 的计算公式是什么？什么条件下 assist 会大量触发？" → 如果正文没写，补充。
- "你说混合写屏障消除了栈重扫，但新分配对象标黑会不会导致浮动垃圾？" → 如果没讲，补充。
- "GOMEMLIMIT 设为容器内存的 85%，那剩下 15% 留给什么？如果 Go runtime 自己的内存不在 heap 里怎么算？" → 如果没讲，补充。

### 8. wiki 摄取

按 `deliverable.md` 的字段映射表和摄取流程写入：

- 1-3 个 concept 页面（含 L1-L4 四种题型闪卡 + 预填深入段）
- references 页面（每个 T0/T1 来源一个，含 `## Source Link`）
- 注册闪卡（复用 `../llm-wiki/references/ingest.md` 流程）
- log 追加 + index 重建

### 9. 面试追问链 + 实践方案

按 `depth-standard.md` 生成面试追问链（写入 `## Interview Questions`），按 `deliverable.md` 生成实践方案（写入 `## Practice Ideas` + `## Common Pitfalls`）。

## wechat-article-search 使用时机

中文技术主题（如国产框架、中文社区热点）时，在维度规划阶段加入"中文实践"维度，用 `wechat-article-search` skill 检索公众号文章。英文主题不强制使用。

加载方式：`use_skill("wechat-article-search")`，按其指引搜索。搜索时加时间参数限制近期内容。

## subagent 调度策略

- **维度数 = subagent 数**：3-5 个维度，并行调度（一条消息内多个 Task 调用）。
- **每 subagent 独立 OODA**：subagent 自行决定查询和抓取，不干预。
- **来源质量写进 task**：在 task 描述里明确"T0 优先 + 具体 T0 来源 URL 提示"，避免 subagent 沉迷 T2。
- **工具预算：15-25 次 / subagent**，简单维度 15 次，复杂维度 25 次，源码追踪维度 30 次。**低于 15 次几乎不可能产出有深度的内容。**
- **task 须含具体问题列表**：不是一句话维度描述，是 3-5 个可直接搜索的精确问题。subagent 逐个回答。
- **不自带 agents/**：本技能不定义自己的 subagent，复用 Task 工具的 `research_subagent`。
