# llm-wiki

**一个用于构建 Karpathy 风格 LLM 知识库的 Agent 技能。**

> 实验性技能 —— 会持续迭代。
> 欢迎在 GitHub Issues 中提交反馈。

灵感来自 [Andrej Karpathy 的 llm-wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 以及社区基于它构建的工作。

## 这是什么

与 RAG（每次查询都重新检索原始文档）不同，这个模式让 LLM 将原始素材**编译**成一个持久的、交叉链接的 Markdown 知识库。每一次 `compile`、`ingest`、`query`、`lint` 和 `audit` 都让知识库更丰富。知识随时间复利增长。

- **你负责**：收集原始素材、提出好问题、把控方向、对 AI 写错的地方提交反馈。
- **LLM 负责**：所有写作、交叉引用、归档、记账，以及根据反馈进行修正。

本仓库包含两个配套工具：

- **`plugins/obsidian-audit/`** — Obsidian 插件：在任意页面选中文本，留下带严重程度的评论，评论会写入 `audit/` 目录作为锚定的 Markdown 文件。
- **`web/`** — 本地 Node.js 预览服务器：渲染知识库（支持 Mermaid、KaTeX、双链），可在浏览器中选中文本提交反馈，并按页面显示未解决的审计项。

两个工具共享一套 TypeScript 库（`audit-shared/`），确保从 Obsidian 和 Web 端写入的审计文件格式完全一致。

## 数据源模式

Web 预览服务器支持两种数据源模式：

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **本地模式** (`local`) | 读取本地 Markdown 文件目录 | 已有 Markdown 知识库、离线使用 |
| **思源模式** (`siyuan`) | 通过思源笔记 HTTP API 实时读取，零拷贝、零导出 | 使用思源笔记作为知识库 |

### 思源模式特点

- **思源笔记作为唯一数据源**：直接调用思源 HTTP API，无需导出 `.md` 文件。
- **Kramdown 清理**：自动将思源输出的 Kramdown 方言转换为标准 Markdown（移除块属性 `{: id="..."}`、转换块引用 `((block-id "text"))` 为 `[text](?page=block-id)` 链接、转换嵌入语法 `!((...))` 为可点击链接）。
- **分页查询**：自动分页获取全量文档和关系图数据，不受思源 SQL API 默认 64 行限制。
- **关系图**：基于思源 `refs` 表构建文档间的双链关系图。

## 安装

```bash
# 将技能复制到你的 Agent 技能目录
cp -r llm-wiki/ ~/.claude/skills/llm-wiki/
# 或 Codex
cp -r llm-wiki/ ~/.codex/skills/llm-wiki/
```

然后在 Agent 配置中引用，或直接将 `llm-wiki/SKILL.md` 粘贴到 Agent 上下文中。

## 快速开始

```bash
# 1. 创建一个新的知识库
python3 llm-wiki/scripts/scaffold.py ~/my-wiki "我的研究主题"

# 2. 添加原始素材
cp my-article.md ~/my-wiki/raw/articles/

# 3. 告诉 Agent："ingest raw/articles/my-article.md"

# 4. 提问："wiki 中关于 X 有什么内容？"

# 5. 定期运行 lint 检查
python3 llm-wiki/scripts/lint_wiki.py ~/my-wiki

# 6. 从 Web 预览器或 Obsidian 插件提交评论，然后处理
python3 llm-wiki/scripts/audit_review.py ~/my-wiki --open
# 然后告诉 Agent："audit: 处理未解决的评论"
```

## 运行 Web 预览服务器

### 一次性准备（构建依赖）

```bash
cd audit-shared && npm install && npm run build && cd ..
cd web && npm install && npm run build && cd ..
```

### 本地模式

```bash
cd web
npm start -- --wiki "/path/to/your/wiki-root" --port 4175
# 打开 http://127.0.0.1:4175
```

### 思源笔记模式

```bash
cd web
npm start -- --siyuan \
  --siyuan-api http://<思源地址>:<端口> \
  --siyuan-notebook <笔记本ID> \
  --port 4175
# 打开 http://127.0.0.1:4175
```

#### 参数说明

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `--siyuan` | 是 | — | 启用思源模式 |
| `--siyuan-api <url>` | 是 | — | 思源 HTTP API 地址（如 `http://localhost:6806`） |
| `--siyuan-notebook <id>` | 是 | — | 思源笔记本 ID |
| `--siyuan-token <tok>` | 否 | — | 思源 API token（启用了鉴权时需要） |
| `--port <n>` | 否 | `4175` | 监听端口 |
| `--host <addr>` | 否 | `127.0.0.1` | 绑定地址 |
| `--author <name>` | 否 | 当前用户名 | 写入反馈文件的作者名 |

#### 如何获取笔记本 ID

在思源笔记中，调用 `/api/notebook/lsNotebooks` API 即可获取所有笔记本及其 ID：

```bash
curl -X POST http://<思源地址>:<端口>/api/notebook/lsNotebooks -H "Content-Type: application/json" -d '{}'
```

#### 示例：连接远程思源实例

```bash
cd web
npx tsx server/index.ts --siyuan \
  --siyuan-api http://30.29.67.96:26806 \
  --siyuan-notebook 20240330211548-bpov4cj \
  --host 0.0.0.0 \
  --port 4175
```

## 仓库结构

```
llm-wiki-skill/
├── llm-wiki/                    ← 技能本体
│   ├── SKILL.md                 ← 主技能文件（由 Agent 读取）
│   ├── references/              ← 参考文档
│   │   ├── schema-guide.md      ← CLAUDE.md schema 模板
│   │   ├── article-guide.md     ← 文章写作指南（分治法、Mermaid、KaTeX）
│   │   ├── log-guide.md         ← log/ 目录约定
│   │   ├── audit-guide.md       ← 审计文件格式 + 处理流程
│   │   └── tooling-tips.md      ← Obsidian、qmd、插件 + Web 工具提示
│   └── scripts/
│       ├── scaffold.py          ← 初始化知识库目录
│       ├── lint_wiki.py         ← 7 轮健康检查（链接、审计、日志格式）
│       └── audit_review.py      ← 按目标分组显示未解决/已解决的审计项
├── audit-shared/                ← 共享 TypeScript 库
│   └── src/{schema,anchor,id,serialize,index}.ts
├── plugins/obsidian-audit/      ← Obsidian 插件 — 从 vault 中提交审计
└── web/                         ← 本地 Node.js 预览 + 反馈服务器
    ├── server/
    │   ├── config.ts            ← 配置解析（支持 local / siyuan 两种模式）
    │   ├── content/             ← ContentProvider 接口 + 实现
    │   │   ├── provider.ts      ← ContentProvider 抽象接口
    │   │   ├── local-provider.ts ← 本地文件系统实现
    │   │   ├── siyuan-provider.ts ← 思源 HTTP API 实现
    │   │   ├── siyuan-link.ts   ← Kramdown 清理 + 块引用/嵌入转换
    │   │   └── factory.ts       ← 根据 mode 创建对应 provider
    │   ├── render/              ← markdown-it 渲染管线
    │   └── routes/              ← Express 路由（tree/page/graph/audit）
    └── client/                  ← 纯 TS 单页应用（Mermaid + 选区弹窗）
```

## 构建 Obsidian 插件

```bash
cd audit-shared && npm install && npm run build && cd ..
cd plugins/obsidian-audit
npm install
npm run build
npm run link -- "/path/to/your/Obsidian vault"
# 在 Obsidian → Settings → Community plugins 中启用 'LLM Wiki Audit'
```

## 使用场景

- **深入研究** — 持续数周阅读某主题的论文/文章
- **个人知识库** — 将日记条目编译成个人百科全书
- **团队知识库** — 由 Slack 讨论、会议纪要、文档汇总而成
- **阅读伴侣** — 在读书过程中构建丰富的配套知识库

## Related work

- [Karpathy's original Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [pedronauck/skills karpathy-kb](https://github.com/pedronauck/skills/tree/main/skills/karpathy-kb) — full Obsidian vault integration
- [Astro-Han/karpathy-llm-wiki](https://github.com/Astro-Han/karpathy-llm-wiki) — example implementation
- [qmd](https://github.com/tobi/qmd) — semantic search for Markdown wikis

## 许可证

MIT
