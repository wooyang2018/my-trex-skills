# my-trex-skills

个人 AI 技能集合插件市场，兼容 Claude Code、CodeBuddy 与 Codex 三平台。仓库以"统一多插件市场"形式承载两类能力：原生的思源笔记 / LLM Wiki 知识库引擎（`plugins/siyuan-skills/`），以及从前 agent-plugins 仓库迁入的 7 个职能插件（`plugins/`）。

## 架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                   my-trex-skills 插件市场                         │
│                                                                  │
│  A. 原生插件 siyuan-skills (plugins/siyuan-skills/)              │
│  ┌──────────┐  ┌────────────────────────────────┐                │
│  │ defuddle │  │    siyuan-sisyphus (CLI)       │                │
│  │ (URL→MD) │  │    底层 CLI 参考文档            │                │
│  └──────────┘  └────────────┬───────────────────┘                │
│                              │ 依赖                               │
│                  ┌───────────▼───────────────────┐                │
│                  │      llm-wiki (理论基石)       │                │
│                  │   三层架构 + 存储协议          │                │
│                  └───────────┬───────────────────┘                │
│                              │ 定义协议                           │
│         ┌──────────┬─────────┼───────────┬──────────┐             │
│      wiki-setup  ingest   retrieval    lint     graph            │
│                  report   synthesis                          │
│                                                                  │
│  B. 迁入职能插件 plugins/<name>/                                  │
│  frontend-dev · go-dev · project-craft · design                 │
│  product-management · spec-craft · specialist-agents            │
└──────────────────────────────────────────────────────────────────┘
```

三层原生能力：
1. **底层 CLI 操作** — `siyuan-sisyphus` 提供思源笔记 CLI 的完整参考
2. **知识库引擎** — `llm-wiki` + 8 个 wiki 技能提供基于 Karpathy LLM Wiki 模式的知识蒸馏系统
3. **网页提取** — `defuddle` 技能提取干净 Markdown

---

## A. 原生基础工具（`plugins/siyuan-skills/`）

| 技能 | 触发场景 | 核心能力 |
|------|----------|----------|
| **defuddle** | 用户提供 URL 需阅读/分析/摘要网页内容 | 从 HTML 页面提取干净 Markdown |
| **siyuan-sisyphus** | 用户要求操作思源笔记的任何内容/结构/元数据 | 通过 CLI 完成笔记本/文档/块/属性视图/搜索/标签/闪卡/Excalidraw 操作 |

### 知识库引擎（Wiki Skills）

基于 [Karpathy LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)，将知识"编译"而非"检索"。四阶段流水线：Ingest → Extract → Resolve → Schema。

| 技能 | 触发场景 | 核心能力 |
|------|----------|----------|
| `llm-wiki` | 理解 wiki 模式、存储协议、页面模板 | 三层架构 + 存储原语 + 页面模板（理论基石） |
| `wiki-setup` | "set up my wiki" / "初始化" / "切换笔记本" | 创建笔记本结构、特殊文档、配置；管理多笔记本配置切换 |
| `wiki-ingest` | "ingest" / "add this to wiki" / URL 导入 / 对话捕获 / 历史导入 | 统一摄取入口——文档蒸馏、URL 获取、数据导入、对话捕获、历史导入 |
| `wiki-retrieval` | "what do I know about X" | 从 wiki 回答问题（分层检索） |
| `wiki-lint` | "audit" / "lint" / "日常更新" / "状态如何" | 健康审计 + 日常维护周期 + 状态审计 |
| `wiki-graph` | "dedup" / "cross-link" / "fix my tags" / "color my graph" | 去重合并 + 交叉链接 + 标签分类法 + 图谱着色 + 元数据管理 |
| `wiki-report` | "create a dashboard" / "weekly digest" / "context pack" | SQL 仪表板 + 周/月摘要 + Token 受限上下文包 |
| `wiki-synthesis` | "synthesize my wiki" / "wiki-research" | 发现并填补综合缺口 + 自主多轮网络研究 |

---

## B. 迁入职能插件（`plugins/`）

| 插件 | 版本 | 面向 | 做什么 |
|------|------|------|--------|
| `frontend-dev` | 1.3.1 | 前端 / 全栈开发者 | React/Next.js 性能、React Native、页面动画、Playwright 调试、UI/UX 代码规范、shadcn/ui 用法、前端视觉设计（含 73 套品牌设计范本）|
| `project-craft` | 1.0.0 | 所有开发者 | 项目初始化（`.gitignore`、LICENSE、`.editorconfig`）与日常规范（Conventional Commits、Changelog、SemVer、README）|
| `go-dev` | 2.0.0 | Go 开发者 | 惯用 Go、并发、错误处理、测试、性能、数据库、gRPC/GraphQL、CLI、依赖注入、可观测、安全、CI/CD——45 个 skills |
| `design` | 1.2.0 | 设计师 / 设计工程 | 设计评审、设计系统、UX 文案、无障碍审查、用户研究、开发交付规格 |
| `product-management` | 1.2.0 | 产品经理 / 创始人 | PRD/规格、路线图、干系人汇报、研究综合、竞品分析、指标复盘、产品头脑风暴 |
| `spec-craft` | 1.1.0 | 工程设计 | 一次一问把想法打磨成 spec，外加一个中文写作 skill |
| `specialist-agents` | 1.2.0 | 重度 CLI 用户 | 按专长把检索、概要、机械代码、并发脏活、高难复核分流给外部 CLI agent（pi / codebuddy / codex）|

### 各插件详情

**frontend-dev** — React/Next.js 性能规范（8 大类 70 条规则）、页面动画（`<ViewTransition>`）、复合组件模式、UI/UX 代码审查、React Native & Expo、Playwright CLI 调试循环、shadcn/ui 用法、前端视觉设计（摆脱 AI 套路审美 + 73 套品牌设计范本）。

**project-craft** — `project-init`（检测技术栈生成 `.gitignore`/`.editorconfig`/`LICENSE`/`.env.example`，内置 168 个 gitignore 模板、28 份 SPDX 许可证文本）+ `project-standards`（Conventional Commits、Keep a Changelog、README 同步、SemVer）。

**go-dev** — Go 全栈技能集共 45 个 skills：核心 Go、CLI（Cobra/Viper）、并发与 Context、错误处理、测试与基准、性能与可观测、API（gRPC/GraphQL/Swagger）、数据库、依赖注入（Wire/Dig/Fx/samber-do）、工程化、安全与设计模式、samber 生态（lo/mo/oops/slog/hot/ro）。

**design** — Anthropic 官方设计工作流：设计评审、设计系统审计/扩展、开发交付规格、WCAG 2.1 AA 无障碍审查、UX 文案、用户研究规划、研究综合。可独立使用，连接 Figma 等 MCP 后增强。

**product-management** — Anthropic 官方 PM 插件：PRD/功能规格、路线图与 Sprint 规划、干系人状态更新、研究综合、竞品对比、指标复盘、`/brainstorm` 斜杠命令。连接 Linear/Notion 等 MCP 后增强。

**spec-craft** — `brainstorming`（一次一问协作式对话，把创意打磨成可落地设计规格，spec 写入 `docs/`，移植自 obra/superpowers 并已剥离）+ `writing-clear-chinese`（清晰简洁地道的中文写作规则，专治"中文西化"）。

**specialist-agents** — 按专长把活分流给宿主机上已装的外部 CLI agent，避开 haiku/sonnet 的低性价比工时。`pi`（deepseek 系高 token 效能，默认通道）、`codebuddy`（多并发与专项模型）、`codex`（gpt-5.5，高难复核换一双眼睛）。本插件无外部脚本，能力全部来自三个 CLI。

---

## 安装

### 前置依赖

- [Claude Code](https://claude.ai/code) / [CodeBuddy](https://www.codebuddy.ai) / Codex（任选其一或多个）
- **Node.js** ≥ 18（`frontend-dev` 的 `playwright-cli` skill 与 defuddle CLI 需要）
- **Defuddle CLI** — `npm install -g defuddle`（原生 defuddle 技能）
- **siyuan-sisyphus CLI** — `npm install -g siyuan-sisyphus`（原生 wiki 技能）
- **思源笔记** ≥ 3.6.0，本地运行且 API 已启用，笔记本 `rwd` 权限（原生 wiki 技能）
- **Python** ≥ 3.8（仅 Excalidraw 嵌入功能需要）

### Claude Code

本仓库是一个 Claude Code 插件市场。在 Claude Code 中：

```bash
# 添加本仓库为 marketplace
/plugin marketplace add wooyang2018/my-trex-skills
# 或本地路径：/plugin marketplace add /path/to/my-trex-skills

# 按需安装插件
/plugin install siyuan-skills@my-trex-skills      # 原生 wiki/siyuan/defuddle
/plugin install frontend-dev@my-trex-skills
/plugin install go-dev@my-trex-skills
/plugin install design@my-trex-skills
# ……其余同理（project-craft / product-management / spec-craft / specialist-agents）
```

Claude Code 读取 `.claude-plugin/marketplace.json`，原生插件 `siyuan-skills` 的 source 为 `./plugins/siyuan-skills`，其余插件 source 为 `./plugins/<name>`。

### CodeBuddy

1. 打开「插件」面板 →「添加插件市场 / Add Marketplace」
2. 填入仓库 URL：`https://github.com/wooyang2018/my-trex-skills`
3. CodeBuddy 自动识别 `.codebuddy-plugin/marketplace.json`，加载全部 8 个插件
4. 在插件列表中按需启用，`plugins/*/skills/` 下的 SKILL 自动可用

### Codex

```bash
codex plugin marketplace add /path/to/my-trex-skills
```

在 Codex app 的插件页启用需要的插件（清单在 `.agents/plugins/marketplace.json`）：

- `go-dev`、`project-craft`、`spec-craft`

`go-dev`、`project-craft`、`spec-craft` 与 Claude Code 共用同一份 skills。

### frontend-dev 的额外步骤

`playwright-cli` skill 由 CLI 自动生成，安装该插件前先准备好：

```bash
npm install -g @playwright/cli@latest
playwright-cli install --skills   # 生成 SKILL.md 与 references/
```

`design` 和 `product-management` 连接 Figma / Linear / Notion 等 MCP 后能力更强，未连接也能独立运行。

### Wiki 快速开始

1. 确保思源笔记运行且 `siyuan-sisyphus` 已配置
2. 在 Agent 中说 **"set up my wiki"** — `wiki-setup` 技能会自动创建 `~/.siyuan-wiki/config` 并初始化笔记本结构

---

## 目录结构

```
my-trex-skills/
├── .claude-plugin/
│   └── marketplace.json         # Claude Code 市场清单（8 个插件）
├── .codebuddy-plugin/
│   └── marketplace.json         # CodeBuddy 市场清单（与 Claude 一致）
├── .agents/
│   └── plugins/marketplace.json # Codex 市场清单（go-dev/project-craft/spec-craft）
├── .claude/
│   ├── settings.local.json      # 个人本地配置（不入库）
│   └── skills/                  # 项目级技能
│       ├── writing-skills/      # 技能创作元技能
│       ├── brainstorming        # → plugins/spec-craft/skills/brainstorming
│       └── writing-clear-chinese# → plugins/spec-craft/skills/writing-clear-chinese
├── plugins/                     # 8 个插件（原生 + 迁入职能）
│   ├── siyuan-skills/          # .claude-plugin/ + skills/ (3 skills: defuddle/siyuan-sisyphus/llm-wiki)
│   ├── frontend-dev/            # .claude-plugin/ + skills/ (8 skills)
│   ├── go-dev/                  # .claude-plugin/ + .codex-plugin/ + skills/ (45 skills)
│   ├── project-craft/           # .claude-plugin/ + .codex-plugin/ + skills/ (含 gitignore 模板与许可证文本)
│   ├── design/                  # .claude-plugin/ + .mcp.json + CONNECTORS.md + skills/ (7 skills)
│   ├── product-management/      # .claude-plugin/ + .mcp.json + CONNECTORS.md + LICENSE(Apache-2.0) + commands/ + skills/
│   ├── spec-craft/              # .claude-plugin/ + .codex-plugin/ + LICENSE(MIT) + skills/ (2 skills)
│   └── specialist-agents/       # .claude-plugin/ + skills/specialist-agents/ (含 references/)
├── docs/                        # 设计笔记
├── web/                         # 原有 web 资源
├── AGENTS.md                    # AI Agent 协作守则（含存储宪法 + 插件编辑原则）
├── README.md                    # 本文件
├── LICENSE                      # MIT
└── .editorconfig
```

---

## 上游来源与致谢

本仓库整合了以下上游来源，感谢原作者的工作（`specialist-agents` 与原生 wiki/siyuan 技能为自编，无上游）：

| 来源 | 许可 | 说明 |
|------|------|------|
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | MIT | Vercel 官方 React/Next.js 技能集，保留 `author: vercel` |
| [@playwright/cli](https://playwright.dev/docs/getting-started-cli) | Apache-2.0 | 微软官方 Playwright CLI，靠 `install --skills` 生成 |
| [openai/plugins — build-web-apps](https://github.com/openai/plugins) | MIT | `shadcn-best-practices` 移植为 `frontend-dev/skills/shadcn` |
| [anthropics/claude-code — frontend-design](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design) | Anthropic 商业条款 | 官方前端视觉设计 skill，译成中文，附 `LICENSE.txt` 署名 |
| [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | MIT | 73 套知名品牌 `DESIGN.md` 设计范本 |
| [github/gitignore](https://github.com/github/gitignore) · [github/choosealicense.com](https://github.com/github/choosealicense.com) | CC0 / MIT | 经 git subtree 引入，不做修改 |
| [spf13/go-skills](https://github.com/spf13/go-skills) | — | Cobra/Viper/Hugo 作者的 Go 最佳实践 |
| [samber/cc-skills-golang](https://github.com/samber/cc-skills-golang) | MIT | Go 全栈 42 个 skills |
| [obra/superpowers](https://github.com/obra/superpowers) | MIT | `spec-craft` 的 `brainstorming` 移植自此，保留作者署名 |
| knowledge-work-plugins/design | — | Anthropic 官方设计插件，整目录拷贝，保留 `author: Anthropic` |
| knowledge-work-plugins/product-management | Apache-2.0 | Anthropic 官方产品管理插件，整目录拷贝 |

已排除两个 Vercel 平台专属技能：`deploy-to-vercel` 和 `vercel-cli-with-tokens`。

---

## 安全说明

- 思源笔记仅连接本地实例（默认 `http://localhost:6806`）
- Token 通过 `siyuan-sisyphus config` 管理，插件不提供写入功能
- 危险操作（删除/移动/全局替换）执行前需用户明确确认
- Wiki 写操作需要笔记本 `rwd` 权限
- `.mcp.json` 仅含公开 MCP 服务 URL，无嵌入令牌；OAuth 认证在安装时按需进行
- 详见 `AGENTS.md` 中的危险动作清单和存储宪法

---

## 许可证

[MIT](LICENSE) © [wooyang2018](https://github.com/wooyang2018)

> 注：`frontend-design` skill 主体适用 Anthropic 商业条款（非 MIT），署名见 `plugins/frontend-dev/skills/frontend-design/LICENSE.txt`；`design` / `product-management` 各保留其上游 LICENSE。各插件 `SKILL.md` frontmatter 中的 `author` 字段为权威署名。
