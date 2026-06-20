# wiki-ingest — 特殊摄取模式

> 本文件是 `references/ingest/index.md` 的拆分模块，涵盖 URL 摄取、数据摄取、对话捕获和历史导入四种特殊模式。核心蒸馏流程（步骤 1-7）见 `references/ingest/core.md`，项目检测见 `core.md` §项目检测。综合与研究模式见 `references/ingest/synthesis.md`。

## 目录

- [URL 摄取模式](#url-摄取模式)
- [数据摄取模式](#数据摄取模式)
- [对话捕获模式](#对话捕获模式)
- [历史导入模式](#历史导入模式)

---

## URL 摄取模式

当来源是 URL 时，先获取网页内容再进入主蒸馏流程。

### 步骤 U1：检测当前项目

使用 `references/ingest/core.md` §项目检测（共享工具）确定项目上下文。

### 步骤 U2：清洁提取预检

检查 `defuddle` CLI 是否可用（`which defuddle`）。如可用，用 `defuddle <url>` 获取干净 markdown（减少 40-60% token）。如不可用，回退到 `WebFetch`。

### 步骤 U3：获取 URL

- 付费墙/JS 渲染/错误 → 创建存根页面（`stub: true`，正文注明无法获取）。
- 成功 → 继续。

### 步骤 U4：检查重复

1. 扫描 manifest 中匹配的 `source_url`。
2. 全文回退：`search fulltext --query "<URL>"`。
3. 如已存在：报告哪个页面涵盖它，提供更新选项。

### 步骤 U5：生成 Slug

从 URL 派生：去协议 → 取主机+前2路径段 → 小写连字符化 → 前加 `web-`。

### 步骤 U6：质量评分

按 URL 主机分桶：`arxiv.org`/`doi.org` → paper(1.0)；官方文档 → official(0.9)；第三方文档 → documentation(0.85)；GitHub → repository(0.75)；博客 → blog(0.55)；论坛 → forum(0.4)；其他 → unknown(0.4)。`base_confidence = round(0.17 + 0.5 × quality_score, 2)`。

### 步骤 U7：写入和跟踪

- 项目模式 → `projects/<project>/references/<slug>`，更新项目概览的参考文献。
- Misc 模式 → `misc/<slug>`，计算亲和力评分（≥3 时提示提升候选）。
- manifest 中 `source_type: "url"`，日志条目 `INGEST_URL`。
- 写入页面和提交跟踪文件遵循 `core.md` 步骤 5-7。

---

## 数据摄取模式

当来源是任意原始文本数据（聊天导出、日志、CSV、JSON 转储、非结构化文本）时。

### 步骤 D1：识别来源格式

| 格式 | 如何识别 | 如何读取 |
|---|---|---|
| JSON / JSONL | `.json`/`.jsonl`，以 `{` 或 `[` 开头 | 解析 message/content 字段 |
| Markdown | `.md` | 直接读取 |
| 纯文本 | `.txt` 或无扩展名 | 直接读取 |
| CSV / TSV | 逗号或制表符分隔 | 解析行和列 |
| HTML | `.html`，以 `<` 开头 | 提取文本，忽略标记 |
| 聊天导出 | 查找轮流对话模式 | 提取对话轮次 |
| 图片 | `.png`/`.jpg`/`.jpeg`/`.webp`/`.gif` | 需视觉模型，Read 工具 |

常见聊天导出格式：ChatGPT（`conversations.json` 的 mapping 结构）、Slack（每频道 JSON）、通用聊天日志（时间戳+角色）。不要预设格式——读取实际数据，弄清结构，然后适应。

### 步骤 D2：提取知识

无论格式，都提取相同内容：主题、决策、事实、流程、实体、关联。对对话数据，关注**实质内容**而非对话本身——50 条消息的调试会话可能产生一个技能页面。跳过寒暄、重复来回、原始代码转储。

### 步骤 D3：聚类和去重

按主题（非按来源文件）分组提取的知识。检查现有 wiki 页面，合并重叠信息，记录矛盾。

### 步骤 D4：蒸馏和提交

遵循 `core.md` 步骤 5 写入页面。对话/日志数据倾向于高推断——大量使用 `^[inferred]`，矛盾时使用 `^[ambiguous]`。manifest 中 `source_type: "data"` 或 `"image"`，日志条目 `DATA_INGEST`。跟踪文件更新遵循 `core.md` 步骤 7。

---

## 对话捕获模式

当用户说"保存这个对话"、"/wiki-capture"、"捕获这个"时。

### 步骤 C1：识别值得保留的内容

扫描对话，提取 3 个月后仍有价值的知识：决策及原因、分析框架、技术发现、概念解释、外部来源关键事实。跳过后勤安排、未结论的探索性来回、已在 wiki 中的内容。如无实质内容，告知用户并停止。

### 步骤 C2：分类内容类型

| 类型 | 描述 | 目标文件夹 |
|---|---|---|
| `synthesis` | 多步分析或推理答案 | `synthesis/` |
| `concept` | 定义、框架或心智模型 | `concepts/` |
| `source` | 外部文档/文章摘要 | `references/` |
| `decision` | 战略/架构/设计选择及理由 | `synthesis/` |
| `session` | 跨多主题的完整讨论摘要 | `journal/` |

如内容属于特定项目，放在 `projects/<project-name>/<category>/` 下。

### 步骤 C3：重写为声明性知识

**不要**写对话摘要。写知识本身，用声明性现在时：
- 不是："用户问了关于 X，Claude 解释说……"
- 而是："X 的工作方式是……"

应用溯源标记：提取（无标记）、推断（`^[inferred]`）、歧义（`^[ambiguous]`）。

### 步骤 C4：写入和提交

遵循 `core.md` 步骤 5 写入页面。manifest 中 `source_type: "conversation"`，日志条目 `CAPTURE`。每条笔记必须链接到至少 2 个现有 wiki 页面。跟踪文件更新遵循 `core.md` 步骤 7。

---

## 历史导入模式

当用户说"/wiki-history-ingest claude"、"导入我的 Claude 历史时"。

### 路由规则

1. 用户明确说 `claude` → 导入 Claude 历史。
2. 用户提供路径 → `~/.claude` 或 Claude memory/session JSONL 产物 → 导入 Claude 历史。
3. 如有歧义，简短澄清："要导入 Claude 历史吗？"

### Claude 历史导入

挖掘 `~/.claude` 目录中的对话历史和记忆文件：

1. **发现来源**——Glob `~/.claude/projects/*/*.jsonl`（对话历史）和 `~/.claude/projects/*/memory/*.md`（记忆文件）。记录路径、大小、修改时间。
2. **逐个处理**——对每个 JSONL 文件，解析对话轮次，提取知识（同数据摄取模式的提取规则）。
3. **聚类**——按项目/主题聚类，而非按文件。同一项目的多个会话合并为该项目下的页面。
4. **蒸馏和提交**——遵循 `core.md` 步骤 5-7 写入页面并更新跟踪文件。manifest 中 `source_type: "claude-history"`，日志条目 `HISTORY_INGEST`。
