# AI Agent 协作守则

本文档面向与 my-trex-skills 插件市场协作的 AI Agent（Claude Code / CodeBuddy / Codex），定义工作约定和安全边界。

本仓库是一个统一的多插件市场，承载两类能力：

**A. 原生能力（`plugins/siyuan-skills/`）**
1. **底层 CLI 操作** — `siyuan-sisyphus` 技能提供思源笔记 CLI 的完整参考
2. **知识库引擎** — `llm-wiki` + 8 个 wiki 技能提供基于 Karpathy LLM Wiki 模式的知识蒸馏系统
3. **网页提取** — `defuddle` 技能提取干净 Markdown

**B. 迁入的职能插件（`plugins/`，来自 agent-plugins）** — 前端开发、Go 开发、项目工程化、设计、产品管理、spec 工作流、外部 CLI agent 分流。

---

## 插件总览

### A. 原生基础工具（`plugins/siyuan-skills/`）

| 技能 | 触发场景 | 核心能力 |
|------|----------|----------|
| **defuddle** | 用户提供 URL 需阅读/分析/摘要网页内容 | 从 HTML 页面提取干净 Markdown |
| **siyuan-sisyphus** | 用户要求操作思源笔记的任何内容/结构/元数据 | 通过 CLI 完成笔记本/文档/块/属性视图/搜索/标签/闪卡/Excalidraw 操作 |

### 知识库引擎（Wiki Skills）

基于 [Karpathy LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)，将知识"编译"而非"检索"。四阶段流水线：Ingest → Extract → Resolve → Schema。

| 技能 | 触发场景 | 核心能力 |
|------|----------|----------|
| **llm-wiki** | 理解 wiki 模式、存储协议、页面模板 | 三层架构 + 存储原语 + 页面模板（理论基石） |
| **wiki-setup** | "set up my wiki" / "初始化" / "切换笔记本" / "列出我的 wiki" | 创建笔记本结构、特殊文档、配置；管理多笔记本配置切换 |
| **wiki-ingest** | "ingest" / "add this to wiki" / "/ingest-url" / "/wiki-capture" / "/wiki-history-ingest" | 统一摄取入口——文档蒸馏、URL 获取、数据导入、对话捕获、历史导入 |
| **wiki-retrieval** | "what do I know about X" | 从 wiki 回答问题（分层检索） |
| **wiki-lint** | "audit" / "lint" / "日常更新" / "状态如何" / "wiki 洞察" | 健康审计 + 日常维护周期 + 状态审计 + 图谱洞察分析 |
| **wiki-graph** | "dedup" / "cross-link" / "fix my tags" / "color my graph" | 去重合并 + 交叉链接 + 标签分类法 + 图谱着色 |
| **wiki-report** | "create a dashboard" / "weekly digest" / "context pack" | SQL 仪表板 + 周/月摘要 + Token 受限上下文包 |
| **wiki-synthesis** | "synthesize my wiki" / "wiki-research" | 发现并填补综合缺口 + 自主多轮网络研究 |
| **deep-study** | "深入研究《X》" / "研读 GO 圣经" / "调研 X 的原理和实战" / "面试级深度研究" | 面试与项目实践级深度学习——书籍系统研读 + 多源专项调研，产出面试追问链+实践方案，沉淀到 wiki（concept+闪卡+预填深入段 L4）|

### B. 迁入职能插件（`plugins/`）

| 插件 | 路径 | 面向 | 做什么 |
|------|------|------|--------|
| `frontend-dev` | `plugins/frontend-dev/` | 前端/全栈开发者 | React/Next.js 性能、React Native、页面动画、Playwright 调试、UI/UX 代码规范、shadcn/ui、前端视觉设计（含 73 套品牌范本）|
| `project-craft` | `plugins/project-craft/` | 所有开发者 | 项目初始化（`.gitignore`、LICENSE、`.editorconfig`）与日常规范（Conventional Commits、Changelog、SemVer）|
| `go-dev` | `plugins/go-dev/` | Go 开发者 | 惯用 Go、并发、错误处理、测试、性能、数据库、gRPC/GraphQL、CLI、依赖注入、可观测、安全、CI/CD——45 个 skills |
| `design` | `plugins/design/` | 设计师/设计工程 | 设计评审、设计系统、UX 文案、无障碍审查、用户研究、开发交付规格 |
| `product-management` | `plugins/product-management/` | 产品经理/创始人 | PRD/规格、路线图、干系人汇报、研究综合、竞品分析、指标复盘、产品头脑风暴 |
| `spec-craft` | `plugins/spec-craft/` | 工程设计 | 一次一问把想法打磨成 spec，外加一个中文写作 skill |
| `specialist-agents` | `plugins/specialist-agents/` | 重度 CLI 用户 | 按专长把检索、概要、机械代码、并发脏活、高难复核分流给外部 CLI agent（pi / codebuddy / codex）|

前三个面向代码与工程，`design` 和 `product-management` 面向非代码的设计与产品工作流，`spec-craft` 与 `specialist-agents` 是两个工作流工具。按你当下戴的"帽子"选用。

---

## defuddle 触发条件

以下情形使用 defuddle 技能：

- 用户提供 URL 需要阅读、分析、总结
- 需要从网页提取文本内容
- 在线文档、文章、博客、教程、新闻页面

**不适用**：
- URL 以 `.md` 或 `.txt` 结尾 → 用 WebFetch
- 需要登录的页面 → 用 WebFetch 或告知用户
- PDF / 二进制文件 → 告知用户不支持

---

## siyuan-sisyphus 触发条件

以下情形使用 siyuan-sisyphus 技能：

- "看一下我的思源笔记"
- "在某个笔记本里创建文档"
- "改某个块的内容"
- "用 SQL 查思源"
- "把图贴进笔记"
- "给文档加标签"
- 任何与思源笔记内容、结构、元数据相关的需求

### 启动预检（每次会话首次使用前执行）

```bash
siyuan-sisyphus --version
siyuan-sisyphus config list
siyuan-sisyphus notebook list
```

---

## Wiki 知识库 — 存储宪法

所有 wiki 读写均通过 `siyuan-sisyphus` CLI 完成 — 禁止通过 `Read` / `Write` / `Glob` / `Grep` 直接访问笔记本目录。思源将文档存储为块树，由内嵌 SQLite 索引支撑；绕过索引的原始文件系统访问会破坏状态一致性。

### 配置解析协议

所有 wiki 技能使用统一配置解析：

1. **读取全局配置** — 从 `~/.siyuan-wiki/config` 读取所有配置项。这是唯一的配置来源。
2. **提示初始化** — 若配置不存在，提示用户运行 `wiki-setup`。

配置提供三个变量（均为必需，不可互相推导）：

- `SIYUAN_NOTEBOOK_ID` — 用于 `--notebook` 参数、`query_sql ... WHERE box='<id>'`、`document lookup` 等
- `SIYUAN_NOTEBOOK_NAME` — 仅用于 `fs *` 工作区路径（以笔记本名作为首段）和人可读日志
- `SIYUAN_FLASHCARD_DECK_ID` — wiki-cards 闪卡牌组 ID，所有闪卡 CLI 命令（`create_card`、`list_cards`、`review_card`、`remove_card`）从 config 读取此值

### 笔记本结构

```
$SIYUAN_NOTEBOOK_NAME (notebook root)
├── index                   # 主索引 — 每个页面都列出
├── log                     # 时间线活动日志（block append）
├── hot                     # 会话热缓存 — ~500 词语义快照
├── _insights               # 图分析输出
├── _staging/               # 暂存审查队列（WIKI_STAGED_WRITES=true 时）
├── _archives/              # 归档快照
├── concepts/               # 知识单元 — 抽象概念 + 具体命名对象（工具、人物、组织、技术）
├── references/             # 来源摘要 — 单一来源摘要 + 源链接定位
├── synthesis/              # 跨来源综合分析
├── comparisons/            # 多方案对比分析
├── contradictions/         # 来源间矛盾记录
├── journal/                # 学习反思日志 — 费曼自检、学习复盘
└── projects/
    └── <project-name>      # 学习计划与实践记录 — 目标、进度、关联概念
```

### 三条硬性写入规则

1. **整页重写用 `fs write --overwrite`。** 多行内容绝不使用 `block update`（会在首个换行处静默截断）。
2. **增量日志追加用 `block append --data-type markdown`。** 需要文档 ID 时运行时 `document lookup` 解析，不再缓存到 manifest。
3. **元数据单写。** 文档体不含 YAML frontmatter 和 `# 标题`行（思源自动生成 frontmatter 和标题）；元数据仅通过 `block set_attrs --attrs-json` 写 `custom-*` 属性，为 SQL 索引查询提供唯一来源。

### 写入模式 — 两步写入法

```
# 步骤 1：写正文（不含 frontmatter，不含 # 标题行）
siyuan-sisyphus fs write --path "/$SIYUAN_NOTEBOOK_NAME/concepts/my-page" \
  --markdown "正文内容..." --overwrite

# 步骤 2：写元数据（不是 document set-attr，是 block set_attrs）
siyuan-sisyphus document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/concepts/my-page"
# → 获取 doc-id
siyuan-sisyphus block set_attrs --id <doc-id> \
  --attrs-json '{"custom-title":"My Page","custom-category":"concepts","custom-tags":"a,b","custom-sources":"source-a","custom-summary":"...","custom-status":"draft","custom-confidence":"low","custom-depth":"beginner","custom-updated":"2026-06-28"}'
```

### AI 写入边界

| 类别 | AI 角色 | 初始 status | 初始 confidence | 初始 depth |
|------|---------|-------------|-----------------|------------|
| `concepts/` | 草拟全文 + 生成闪卡，status/confidence/depth 自动派生 | draft | low | beginner |
| `references/` | 完全写入 | verified (恒定) | high (恒定) | — |
| `synthesis/` | 草拟全文，status/confidence 自动派生 | draft | low | — |
| `comparisons/` | 草拟全文，status/confidence 自动派生 | draft | low | — |
| `contradictions/` | 检测并创建，status 由 Resolution Status 决定 | draft | low (恒定) | — |

`custom-status`、`custom-confidence`、`custom-depth` 三个字段由 maintain 周期自动派生，**不需要人工维护**。confidence 由来源数量决定（0-1→low, 2→medium, 3+→high）；status 由时间+来源+矛盾状态决定；depth 由闪卡复习表现决定（concept 页面包含 L1/L2/L3 三层闪卡，复习表现自动决定 depth）。references/ 因事实性强、错误易对照源发现，由 AI 完全写入。

### 检索原语 — 分层检索（成本递增）

| 需求 | 原语 | 相对成本 |
|------|------|----------|
| 页面是否存在？标题/标签/摘要？ | `query_sql ... WHERE box='$SIYUAN_NOTEBOOK_ID' AND type='d'` | **最便宜** |
| 按标签筛选页面 | `query_sql ... WHERE ial LIKE '%custom-tags=%foo%'`（注意：需配合 `block get-attrs`） | **便宜** |
| 全文搜索 | `search fulltext --query "..."` | **中等** |
| 反链查询 | `document lookup` → `search get_backlinks --id <id> --mode both` | **中等** |
| 整页内容 | `fs read --path "/$SIYUAN_NOTEBOOK_NAME/<hpath>"` | **最贵 — 最后手段** |

**query_sql 两条铁律：**
1. **必须包含 `box='$SIYUAN_NOTEBOOK_ID'`** — 不含则权限过滤器会丢弃全部结果。
2. **必须包含 `LIMIT`** — 成熟 wiki 可能有数千行。
3. **必须包含 identity column** — `blocks` 表需 `id`，`refs` 表需 `root_id`，否则行被权限过滤丢弃。

### 内部链接格式

wiki 页面之间的所有内部链接写为思源原生块引用：

```
((<20-char-doc-id> "display text"))
```

这是唯一能产生真实图边的语法 — 填充 `refs` 表、出现在 `get_backlinks` 中、在全局关系图中画线。`[[wikilink]]` markdown **不被** 思源解析为图边。

### 索引最终一致性

`fs write` 后，`search fulltext` 可能暂时找不到新内容。验证写入成功的正确方式：
- `fs read --path "<just-written-hpath>"` 直接读取验证
- 或 `document lookup --hpath "<just-written-hpath>"` 检查返回的 id

---

## 路径三种形态（铁律）

| 形态 | 用于 | 示例 |
|------|------|------|
| 工作区可读路径 | 全部 `fs` 动作 | `/笔记本名/目录/文档` |
| 笔记本本地 hpath | `document create --path`、`document lookup --hpath` | `/目录/文档` |
| 存储路径（`.sy`） | `document lookup` 返回值；`document create --parent-path` | `/20240318112233-abc123.sy` |

**绝对禁止：**
- 不要把工作区路径 `/笔记本名/...` 传给 `document create --path`
- 不要把存储路径传给 `document create --path`，只有 `--parent-path` 接受
- 需要 ID 或 storage 路径时，先 `document lookup` 解析

---

## 危险动作清单

执行以下动作前，**必须**用一句话向用户复述目标对象与影响，取得明确批准后再执行：

| 工具 | 需确认的动作 |
|------|-------------|
| `fs` | `rm`、`mv` |
| `document` | `move` |
| `block` | `move` |
| `search` | `find_replace` |
| `file` | `upload_asset`、`remove_unused_assets`、`delete_asset` |
| `tag` | `remove` |
| `flashcard` | `remove_card` |

**确认话术模板**：「准备执行 `<命令摘要>`，将影响 `<具体目标>`，是否继续？」

写类技能需要笔记本 `rwd` 权限；读类技能（`wiki-retrieval`、`wiki-lint` 的状态审计/洞察模式）接受 `r` / `rw` / `rwd` 任一。

---

## 工作约定

1. **所有思源操作通过 CLI 完成** — 不直接调用 HTTP API，不写自定义脚本
2. **脚本/链式调用** — 输出加 `--json`
3. **长文档/列表** — 加 `--page N --page-size 8000` 避免截断
4. **多行内容写入** — 用 `block append` / `block insert` / `fs write`，不要用 `block update`（会截断）
5. **Excalidraw 嵌入** — 走 `scripts/excalidraw_compose.py`（Python ≥ 3.8），不要手拼 base64
6. **闪卡牌组初始化** — 走 `skills/llm-wiki/scripts/setup_flashcard_deck.py`（幂等），不要手拼 curl 调 createRiffDeck API；脚本自动检查牌组存在性、创建、写 config
7. **wiki 页面必须有 custom 属性** — `custom-title`、`custom-category`、`custom-tags`、`custom-sources`、`custom-summary`、`custom-status`（draft|verified|outdated，**自动派生**）、`custom-confidence`（low|medium|high，**自动派生**）、`custom-depth`（beginner|intermediate|advanced，仅 concepts/，**闪卡自动派生**）、`custom-updated`，共 9 个字段（其中 3 个自动派生），通过 `block set_attrs --attrs-json` 写入（不写 YAML frontmatter）
8. **知识图谱边用块引用** — `((doc-id "display text"))`，不用 `[[wikilink]]`
9. **深度学习调研走 deep-study** — 用户要求"深入研究一本书"/"面试级调研某技术"时，走 `skills/deep-study/`（book-study 或 topic-research 模式），产出必含面试追问链+实践方案+wiki 摄取（预填 concept 深入段 L4）；topic-research 调研须多源质量分级（T0 官方/论文/源码优先），复用 Task research_subagent 并行

---

## 插件注册机制

本仓库同时提供三套 local marketplace，共享同一份 `plugins/`：

- **Claude Code**：`.claude-plugin/marketplace.json` + 各插件 `plugins/<name>/.claude-plugin/plugin.json`
- **CodeBuddy**：`.codebuddy-plugin/marketplace.json`（与 Claude 清单内容一致）
- **Codex**：`.agents/plugins/marketplace.json` + 各插件 `plugins/<name>/.codex-plugin/plugin.json`

`go-dev`、`project-craft`、`spec-craft` 在同一目录并存 Claude 与 Codex 两套 manifest，共用 `skills/`。原生 `siyuan-skills` 插件（`source: "./plugins/siyuan-skills"`）只有 Claude/CodeBuddy 清单。

**新增插件必须两步：** 先在 `plugins/<name>/` 下建好对应平台的 manifest 与 skills，再在该平台的 marketplace 注册。

---

## 编辑原则与上游同步

### 各插件编辑原则

- **原生 skills（defuddle / siyuan-sisyphus / llm-wiki / wiki-*，位于 `plugins/siyuan-skills/`)** — 可直接编辑 `SKILL.md` 与 `references/`。
- **frontend-dev / project-craft** — 可直接编辑 `SKILL.md` 与 `references/`。
- **go-dev** — 可直接编辑 `SKILL.md`。原有三个（`go`、`cobra-viper`、`go-spec-reviewer`）来自 spf13，`golang-*` 系列来自 samber，直接复制。
- **playwright-cli skill**（frontend-dev 下）— 不手改，靠 `playwright-cli install --skills` 重新生成。
- **Vercel / shadcn / design / product-management skills** — 上游静态拷贝，保留原 `author` 元数据（`vercel` / `openai` / `Anthropic`）。改动会在下次同步时被覆盖。
- **frontend-design skill** — 源自 Anthropic 官方 `anthropics/claude-code` 的 `frontend-design` 插件，`SKILL.md` 已本地化为中文并在尾部追加「参照现成品牌设计系统」一节，主体许可是 **Anthropic 商业条款**（非本仓库 MIT），署名见同目录 `LICENSE.txt`。品牌设计范本库 `references/` 收录自 VoltAgent/awesome-design-md（MIT），许可与主体不同，别混。
- **spec-craft** — `brainstorming` 移植自 superpowers 并已剥离，可直接编辑；不得重新引入浏览器可视化伴侣。
- **product-management 与 design 有功能重叠** — PM 的 `synthesize-research` 和 design 的 `research-synthesis` / `user-research` 都做用户研究综合，同时启用会抢触发。当前保留冗余，未去重。

### 上游同步

```bash
# project-craft 的 .gitignore 模板（git subtree）
git subtree pull --prefix=plugins/project-craft/skills/project-init/templates \
  https://github.com/github/gitignore.git main --squash

# project-craft 的许可证文本（git subtree）
git subtree pull --prefix=plugins/project-craft/skills/project-init/licenses \
  https://github.com/github/choosealicense.com.git gh-pages --squash
```

其余几家是手动复制：go-dev 从 samber/cc-skills-golang 复制 `golang-*`；design / product-management 从 Anthropic 官方插件整目录复制（剔除 `.DS_Store`）；spec-craft 的 brainstorming 从 obra/superpowers 移植并剥离。

### specialist-agents 硬约束

`specialist-agents` 自编，可直接改 `SKILL.md` 与 `references/`。以下是硬约束：

- **模型黑名单不可放开**：pi 上 `moonshotai/kimi-*` 全系、codebuddy 上 `claude-*` / `gpt-*` 全系、`hy3-preview-ioa` 默认禁用。放开任何一项都要明文修订该 skill。
- **不起内置 haiku/sonnet 子 agent 干本 skill 范围内的脏活**：deepseek-v4-pro / glm-5.1-ioa 已到 sonnet 级，deepseek-v4-flash 已远胜 haiku。要么走 specialist-agents，要么主 Claude 自己上。
- **一律保留 session**：模板里禁止出现 `--no-session`（pi）/ `--ephemeral`（codebuddy/codex）。session 是事后复盘的唯一入口。
- **子 agent 一律裸跑**：pi 命令带 `-ns -ne -np`；codebuddy 命令前缀 `CODEBUDDY_DISABLE_AUTO_MEMORY=1 CODEBUDDY_DISABLE_HOT_RELOAD=1 CODEBUDDY_SKIP_BUILTIN_MARKETPLACE=1`。新增或修订模板都要带上这两套开关。
- **写盘必走 worktree**：直接改代码的模板先 `git worktree add` 隔离，再让子 agent 进去改。全权写盘开关（codebuddy `--dangerously-skip-permissions`、codex `--dangerously-bypass-approvals-and-sandbox`）只在 worktree 内允许；pi 默认即可写盘，同样只在 worktree 内放它改。
- **`.specialist-agents/` 目录** 是子 agent 的报告落盘位置，由 skill 自身维护项目根 `.gitignore`，不进 git。
- **CLI 升级时**：pi / codebuddy / codex 任一家 `--list-models` 输出有变或新增专项模型，回头同步 `references/routing.md` 的模型分级与黑白名单。

---

## References 导引

### 原生技能参考文档（`plugins/siyuan-skills/skills/siyuan-sisyphus/references/`）

| 文件 | 何时打开 |
|------|----------|
| `browse-read.md` | 列笔记本、看文档树、读文档/块、解析 ID 与路径 |
| `create-edit.md` | 创建文档、追加/插入/更新块、改图标/封面/属性、日记 |
| `search-query.md` | 全文搜索、SQL、反链、引用、资源搜索、全局替换 |
| `database-av.md` | 属性视图（思源数据库）增列、增行、写单元格、渲染 |
| `file-export.md` | 上传资源、导出 markdown、抽取文档、未引用资源治理 |
| `tag-flashcard.md` | 标签管理与闪卡复习 |
| `system-config.md` | profile 管理、权限模式、故障排查 |
| `markup-guide.md` | 块引用、嵌入块、超级块、图表块、Callout、自定义属性 |
| `excalidraw-embed.md` | Excalidraw 矢量图嵌入完整流程 |
| `sql-reference.md` | 思源 SQL 表结构与常用查询模板 |

wiki 理论基石详见 `plugins/siyuan-skills/skills/llm-wiki/SKILL.md`（存储协议、原语表、页面模板、校准经验）。

### 迁入插件参考文档

各插件的 `SKILL.md` 与 `references/` 位于 `plugins/<name>/skills/<skill>/`。`specialist-agents` 的 routing / clis / execution 决策表在 `plugins/specialist-agents/skills/specialist-agents/references/`。项目级技能创作元指南在 `.claude/skills/writing-skills/`。

---

## 故障快速排查

| 现象 | 对策 |
|------|------|
| 连不上 / 401 | `siyuan-sisyphus config list`，按 `system-config.md` 重设 profile |
| 命令字段不确定 | `siyuan-sisyphus help <tool> <action>` |
| 看不到笔记本 | `siyuan-sisyphus notebook get_permissions`，检查权限 |
| 刚写入搜不到 | 思源索引最终一致，稍候重试或按路径直接读 |
| defuddle 输出为空 | 页面可能需 JS 渲染，回退到 WebFetch |
| `query_sql` 返回空 | 检查是否遗漏 `box=` 条件或 identity column（`id`/`root_id`） |
| `document set-attr` 写不进 custom-* | 改用 `block set-attrs --id <doc-id>` |
| `block update` 多行截断 | 改用 `block append` / `block insert` / `fs write --overwrite` |
| 新笔记本 `fs write` 权限错误 | 新建笔记本默认 `r`，需在思源 UI 手动改为 `rwd` |
