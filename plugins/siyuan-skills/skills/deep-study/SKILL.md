---
name: deep-study
description: >
  面向企业面试和项目实践的深度技术学习与调研技能。通过书籍系统研读或网络多源专项调研，
  产出面试追问链、实践方案，并沉淀到思源 wiki 知识库（concept 页面 + 4 种题型闪卡 + 预填深入段）。
  当用户要求深入研究一本书籍（如"研读 GO 圣经"、"系统学习《XXX》"）、对某技术专题做面试级
  深度调研（如"深入研究 Go 垃圾收集"、"调研 XXX 的原理和实战"）、或需要把技术调研结果沉淀为
  可复习的知识库页面时使用。不用于简单的概念查询或单次网页阅读。
---

# Deep Study — 面试与项目实践级深度研究

将一个技术主题（书籍或专项）研究到"扛得住面试官追问、落得了项目实战"的深度，并把成果沉淀进思源 wiki——生成 concept 页面（含 4 种题型闪卡 + 预填深入段）、references 来源页、面试追问链和实践方案。

## 入口

| 用户意图 | 操作 | 读取 |
|---|---|---|
| 研读一本书（"系统学习《X》"、"研读 GO 圣经"） | book-study | `references/book-study.md` |
| 专项技术深度调研（"深入研究 Go GC"、"调研 X 的原理和实战"） | topic-research | `references/topic-research.md` |
| 判定深度是否达标、设计面试追问链 | depth-standard | `references/depth-standard.md` |
| 产出三件套（追问链 + 实践方案 + wiki 摄取） | deliverable | `references/deliverable.md` |

只加载当前操作需要的 reference；不要一次性读完整个目录。

## 模式判断

- **book-study**：用户提供一本书（文本 / PDF / 在线 URL / 指定章节），要求系统学习。输入是"一本书"或"书的一章/几章"。
- **topic-research**：用户提供一个技术主题（如"Go 垃圾收集"），要求深度调研。输入是"一个主题"而非"一本书"。

两者都产出三件套并写入 wiki，区别在研究方法：book-study 按章节拆解精读，topic-research 并行调度 `research_subagent` 多源调研。

## 硬规则

1. **wiki 唯一访问层**：所有思源读写走 `siyuan-sisyphus` CLI，遵循 llm-wiki 的存储宪法（见 `../llm-wiki/SKILL.md`）。不直接访问思源工作区文件，不重复定义存储协议、页面模板或闪卡注册 SQL。
2. **研究前必查 wiki**：开始研究前，先用 llm-wiki 的 query 流程（`../llm-wiki/references/query.md`）检索已有 concept / references 页面，避免重复研究；已有页面则在其上深化，而非新建。
3. **产物默认写 wiki**：研究完成后，按 llm-wiki 的 ingest 流程（`../llm-wiki/references/ingest.md`）+ writing 模板（`../llm-wiki/references/writing.md`）写入 wiki。concept 页面须注册 4 种题型闪卡（填空 / 问答 / 单选 / 多选，见下方"闪卡题型构造"），复用 ingest.md 的注册 SQL 和 `create_card` 流程，新增 `custom-card-type` 属性标记题型。
4. **L4 深度必达**：每个 concept 必须达到 L4 深度（见 `references/depth-standard.md`）——预填 concept 模板的 Interview Questions、Common Pitfalls、Practice Ideas 深入段（标准 ingest 留空给人工，deep-study 必须预填能推断的实战内容）。未达 L4 的页面保持 `custom-status=draft` 并在日志注明"待深化"。
5. **多源质量分级**：topic-research 的调研须覆盖多类来源并按质量分级（见 `references/topic-research.md`）——T0 权威源（官方文档 / 规范 / 顶会论文 / 源码）优先，T1 高质量源（知名工程师博客 / 公司技术博客 / 优质中文公众号），T2 补充源（Stack Overflow / GitHub issues）仅作交叉验证。T0 之间冲突时记入 `contradictions/`。
6. **复用 research_subagent**：topic-research 的并行调研用 Task 工具调度 `research_subagent`（本技能不自带 agents/）。每个 subagent 负责一个研究维度 + 来源质量要求，OODA 循环。工具调用预算 **15-25 次 / subagent**（源码追踪维度 30 次），低于 15 次几乎不可能产出有深度的内容。subagent 的 task 须包含 3-5 个**具体问题**（不是一句话维度描述）。第一轮调研后必须执行 Gap Analysis，对缺口调度第二轮定向 subagent（见 `references/topic-research.md`）。
7. **三件套必交**：每个研究主题必交面试追问链（5-10 递进问题 + 答题方向）、实践方案（代码 / 架构 / 踩坑预案）、wiki 摄取（concept + references + 4 种题型闪卡）。见 `references/deliverable.md`。
8. **危险动作确认**：遵循 AGENTS.md 危险动作清单（`fs rm` / `mv`、`remove_card` 等须复述目标与影响并取得明确批准）。
9. **源码强制追踪**：topic-research 至少一个维度必须做源码追踪——实际读取源码（GitHub raw 或本地仓库），提取函数签名、调用链、关键数据结构、行号引用。concept 页面的 `## How It Works` 段须包含 ≥ 1 处源码引用（如 `runtime/mgc.go:L234`）。不是"提到了源码文件名"，而是实际读了源码并提取了关键信息。
10. **量化深度标准 + 对抗性面试验证**：concept 页面每段须达到量化深度要求（见 `references/depth-standard.md`）：How It Works ≥ 800 字含 ≥ 3 个量化数据、Common Pitfalls ≥ 3 条、Interview Questions ≥ 6 个含 ≥ 1 个 L4 级"杀手问题"。写入 wiki 前必须执行对抗性面试验证——以面试官身份提出 3 个刁钻追问，检查 concept 草稿能否回答，不能回答的补充正文或追问链。

## 与 llm-wiki 的关系

deep-study 是 llm-wiki 的"增强版 ingest"——在标准摄取前增加研究阶段，在摄取时预填深入段（L4），并额外产出面试追问链和实践方案。所有 wiki 写入复用 llm-wiki 流程，不引入新页面类型。deep-study 新增 `custom-card-type` 属性（`cloze` / `qa` / `single-choice` / `multi-choice`）标记闪卡题型，不影响 maintain 周期的 depth 派生（仍基于 `type IN ('p','s')` 匹配）和 lint 审计。

## L1-L4 深度速览

| 层级 | 内容 | 闪卡题型 | custom-card-type | 位置 |
|---|---|---|---|---|
| L1 | 定义 / 核心特征 | 填空题（段落 `==mark==` 挖空核心术语） | `cloze` | `## Flashcards` 段 |
| L2 | 原理 / 机制 | 问答题（超级块首子块=问题、其余=答案） | `qa` | `## Flashcards` 段 |
| L3 | 动机 / 权衡 / 替代方案 | 单选题（嵌套超级块，正面=题干+选项、背面=答案+解析） | `single-choice` | `## Flashcards` 段 |
| L4 | 面试追问 / 项目踩坑 | 多选题（嵌套超级块，正面=题干+任务列表、背面=答案+解析） | `multi-choice` | `## Flashcards` 段 + `## Interview Questions` / `## Common Pitfalls` / `## Practice Ideas` 深入段 |

L1-L4 闪卡注册复用 `../llm-wiki/references/ingest.md` 的流程与 SQL，额外设 `custom-card-type` 属性。`custom-depth` 派生逻辑不变，仍基于 `type IN ('p','s')` 匹配 L1 段落 + L2-L4 超级块。

## 闪卡题型构造

思源闪卡 API 无结构化题型字段（cardType / options / answer），卡片内容完全来自块本身。通过不同块结构可让用户侧复习时看到 4 种题型交互效果。

### 填空题（L1，custom-card-type=cloze）

段落块 + `==mark==` 标记挖空。注册段落块（type='p'）。

```
Go GC 采用 ==并发三色标记清除== 算法，通过 ==混合写屏障== 解决漏标问题。
```

复习时 `==mark==` 部分被挖空，点击显示答案。

### 问答题（L2，custom-card-type=qa）

超级块，首子块=问题，其余子块=答案。注册超级块（type='s'）。

```
{{{row
Go GC 的三色标记法怎么工作？

白色=未访问，灰色=已发现但子对象未扫完，黑色=完成。从根集合出发推动灰色队列，最终回收白色对象。
}}}
```

复习时正面显示问题，翻面显示答案。

### 单选题（L3，custom-card-type=single-choice）

嵌套超级块。外层超级块首子块=内层超级块（题干+选项，作为正面），外层后续子块=答案+解析。注册外层超级块（type='s'）。

关键：选项必须在内层超级块里，否则会被外层超级块当作答案隐藏。

```
{{{row
{{{row
【单选题】Go 1.8 引入混合写屏障主要解决了什么问题？

- A. 消除标记终止阶段的栈重扫描
- B. 引入分代 GC 降低分配压力
- C. 启用引用计数替代标记清除
- D. 压缩堆内存减少碎片
}}}

答案：A。混合写屏障结合 Dijkstra 和 Yuasa 屏障，消除栈重扫，STW 从毫秒级降至微秒级。
}}}
```

复习时正面显示题干和 A/B/C/D 选项，翻面显示答案和解析。

### 多选题（L4，custom-card-type=multi-choice）

嵌套超级块。与单选题结构相同，但正面用未勾选任务列表模拟多选，背面给正确选项和解析。注册外层超级块（type='s'）。

```
{{{row
{{{row
【多选题】以下哪些手段能有效降低 Go GC 压力？

- [ ] 让所有临时变量逃逸到堆上
- [ ] 用 `sync.Pool` 复用高频临时对象
- [ ] 预分配 slice 容量避免扩容复制
- [ ] 用 `strings.Builder` 替代 + 拼接字符串
}}}

答案：B、C、D。

- [x] 用 `sync.Pool` 复用高频临时对象
- [x] 预分配 slice 容量避免扩容复制
- [x] 用 `strings.Builder` 替代 + 拼接字符串

解析：sync.Pool 减少 heap 分配；预分配减少扩容复制；strings.Builder 避免中间临时字符串。
}}}
```

复习时正面显示题干和未勾选项，翻面显示正确选项（勾选状态）和解析。

## 配置与预检

首次使用前，确认 llm-wiki 已初始化（`~/.siyuan-wiki/config` 存在且含 `SIYUAN_NOTEBOOK_ID`、`SIYUAN_FLASHCARD_DECK_ID`）。若未初始化，先走 llm-wiki 的 setup 流程（`../llm-wiki/references/setup.md`）。deep-study 不维护独立配置。
