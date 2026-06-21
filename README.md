# my-trex-skills

个人 AI 技能集合插件，兼容 Claude Code 与 CodeBuddy 双平台。包含 10 个技能，围绕"在思源笔记中构建 LLM Wiki 知识库"核心场景。

## 架构总览

```
┌───────────────────────────────────────────────────┐
│              my-trex-skills 插件                   │
│                                                   │
│  ┌──────────┐  ┌────────────────────────────────┐ │
│  │ defuddle │  │    siyuan-sisyphus (CLI)       │ │
│  │ (URL→MD) │  │    底层 CLI 参考文档            │ │
│  └──────────┘  └────────────┬───────────────────┘ │
│                              │ 依赖                │
│                  ┌───────────▼───────────────────┐ │
│                  │      llm-wiki (理论基石)       │ │
│                  │   三层架构 + 存储协议          │ │
│                  └───────────┬───────────────────┘ │
│                              │ 定义协议            │
│    ┌──────────┬──────────────┼──────────────┐     │
│    │          │              │              │     │
│ ┌──▼───┐ ┌───▼────┐ ┌──────▼───┐ ┌──────▼────┐  │
│ │wiki- │ │wiki-   │ │wiki-     │ │wiki-      │  │
│ │setup │ │ingest  │ │retrieval │ │lint       │  │
│ └──────┘ └────────┘ └──────────┘ └───────────┘  │
│ ┌──────────┐ ┌────────────┐ ┌──────────────────┐ │
│ │wiki-graph│ │wiki-report │ │wiki-synthesis    │ │
│ └──────────┘ └────────────┘ └──────────────────┘ │
└───────────────────────────────────────────────────┘
```

三层能力：
1. **底层 CLI 操作** — `siyuan-sisyphus` 提供思源笔记 CLI 的完整参考
2. **知识库引擎** — `llm-wiki` + 8 个 wiki 技能提供基于 Karpathy LLM Wiki 模式的知识蒸馏系统
3. **网页提取** — `defuddle` 技能提取干净 Markdown

## 基础工具

| 技能 | 触发场景 | 核心能力 |
|------|----------|----------|
| **defuddle** | 用户提供 URL 需阅读/分析/摘要网页内容 | 从 HTML 页面提取干净 Markdown |
| **siyuan-sisyphus** | 用户要求操作思源笔记的任何内容/结构/元数据 | 通过 CLI 完成笔记本/文档/块/属性视图/搜索/标签/闪卡/Excalidraw 操作 |

## 知识库引擎（Wiki Skills）

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

## 安装

### Claude Code

本仓库同时是一个 Claude Code 插件市场。在 Claude Code 中：

```bash
/plugin marketplace add wooyang2018/my-trex-skills
/plugin install my-trex-skills@my-trex-skills
```

Claude Code 会读取 `.claude-plugin/marketplace.json`，加载同名插件。

### CodeBuddy

本仓库同时是一个 CodeBuddy 插件市场（marketplace）。在 CodeBuddy 中：

1. 打开「插件」面板 →「添加插件市场 / Add Marketplace」
2. 填入仓库 URL：`https://github.com/wooyang2018/my-trex-skills`
3. CodeBuddy 自动识别 `.codebuddy-plugin/marketplace.json`，加载名为 `my-trex-skills` 的插件
4. 在插件列表中启用 `my-trex-skills@my-trex-skills`，`skills/` 下的所有 SKILL 自动可用

---

## 前置条件

| 要求 | 说明 |
|------|------|
| **Node.js** ≥ 14 | 运行 Defuddle CLI |
| **Defuddle CLI** | `npm install -g defuddle` |
| **siyuan-sisyphus CLI** | 思源笔记命令行工具 `npm install -g siyuan-sisyphus` |
| **思源笔记** ≥ 3.6.0 | 本地运行的思源笔记实例（API 已启用，笔记本 `rwd` 权限） |
| **Python** ≥ 3.8 | 仅 Excalidraw 嵌入功能需要 |

### Wiki 快速开始

1. 确保思源笔记运行且 `siyuan-sisyphus` 已配置
2. 在 Agent 中说 **"set up my wiki"** — `wiki-setup` 技能会自动创建 `~/.siyuan-wiki/config` 并初始化笔记本结构

---

## 目录结构

```
my-trex-skills/
├── .claude-plugin/
│   └── marketplace.json         # Claude Code 市场清单
├── .codebuddy-plugin/
│   └── marketplace.json         # CodeBuddy 市场清单

├── AGENTS.md                    # AI Agent 协作守则（含存储宪法）
├── README.md                    # 本文件
└── skills/
    ├── defuddle/                # 网页内容提取
    │   └── SKILL.md
    ├── siyuan-sisyphus/         # 思源笔记 CLI 底层操作
    │   ├── SKILL.md
    │   ├── scripts/
    │   │   └── excalidraw_compose.py
    │   └── references/          # 10 份详细参考文档
    │       ├── browse-read.md
    │       ├── create-edit.md
    │       ├── database-av.md
    │       ├── excalidraw-embed.md
    │       ├── file-export.md
    │       ├── markup-guide.md
    │       ├── search-query.md
    │       ├── sql-reference.md
    │       ├── system-config.md
    │       └── tag-flashcard.md
    ├── llm-wiki/                # 知识库理论基石
    │   ├── SKILL.md
    │   └── references/
    │       └── karpathy-pattern.md
    ├── wiki-setup/              # 初始化 + 多笔记本切换
    ├── wiki-ingest/             # 统一摄取入口
    ├── wiki-retrieval/          # 分层检索
    ├── wiki-lint/               # 质量审计 + 维护
    ├── wiki-graph/              # 去重 + 交叉链接 + 元数据
    ├── wiki-report/             # 仪表板 + 摘要
    └── wiki-synthesis/          # 综合发现 + 自主研究
```

---

## 安全说明

- 思源笔记仅连接本地实例（默认 `http://localhost:6806`）
- Token 通过 `siyuan-sisyphus config` 管理，插件不提供写入功能
- 危险操作（删除/移动/全局替换）执行前需用户明确确认
- Wiki 写操作需要笔记本 `rwd` 权限
- 详见 `AGENTS.md` 中的危险动作清单和存储宪法

---

## 许可证

MIT © [wooyang2018](https://github.com/wooyang2018)
