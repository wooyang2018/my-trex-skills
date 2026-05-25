# my-trex-skills

个人 AI 技能集合插件，兼容 Claude Code 与 CodeBuddy 双平台。包含以下技能：

- **defuddle** — 用 Defuddle CLI 从网页提取干净 Markdown，替代 WebFetch
- **siyuan-sisyphus** — 用 siyuan-sisyphus CLI 操作思源笔记（笔记本/文档/块/属性视图/搜索/标签/闪卡/Excalidraw）

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
| **siyuan-sisyphus CLI** | 思源笔记命令行工具 |
| **思源笔记** ≥ 3.6.0 | 本地运行的思源笔记实例 |
| **Python** ≥ 3.8 | 仅 Excalidraw 嵌入功能需要 |

---

## 技能概览

### defuddle

从网页 URL 提取干净的 Markdown 内容，去除导航、广告和杂物以节省 token。

```bash
defuddle parse <url> --md
```

适用场景：用户提供 URL 需要阅读、分析或摘要网页内容时使用。对于 `.md` 结尾的 URL 直接用 WebFetch。

### siyuan-sisyphus

通过 `siyuan-sisyphus` 命令行操作思源笔记的完整技能。

```bash
siyuan-sisyphus <tool> <action> [--flag value ...]
```

覆盖 12 个工具：`fs`（文档文件操作）、`notebook`（笔记本管理）、`document`（文档元数据）、`block`（块级操作）、`av`（属性视图）、`search`（全文/SQL 检索）、`file`（资源与导出）、`tag`（标签）、`system`（配置）、`flashcard`（闪卡）、`mascot`（挂件）、`feedback`（反馈）。

配置方式：

```bash
siyuan-sisyphus config list          # 查看当前配置
siyuan-sisyphus notebook list        # 列出笔记本
```

详细配置见 `skills/siyuan-sisyphus/references/system-config.md`。

---

## 目录结构

```
my-trex-skills/
├── .claude-plugin/
│   └── marketplace.json         # Claude Code 市场清单（仓库自身即单插件市场）
├── .codebuddy-plugin/
│   └── marketplace.json         # CodeBuddy 市场清单（仓库自身即单插件市场）
├── AGENTS.md                    # AI Agent 协作守则
├── CLAUDE.md                    # → AGENTS.md（软链接）
├── README.md                    # 本文件
└── skills/
    ├── defuddle/
    │   └── SKILL.md             # 网页内容提取技能
    └── siyuan-sisyphus/
        ├── SKILL.md             # 思源笔记 CLI 技能入口
        ├── scripts/
        │   └── excalidraw_compose.py  # Excalidraw SVG 合成脚本
        └── references/          # 详细参考文档
            ├── browse-read.md       # 浏览与读取
            ├── create-edit.md       # 创建与编辑
            ├── database-av.md       # 属性视图（数据库）
            ├── excalidraw-embed.md  # Excalidraw 嵌入
            ├── file-export.md       # 资源与导出
            ├── markup-guide.md      # 思源专有语法
            ├── search-query.md      # 搜索与查询
            ├── sql-reference.md     # SQL 参考
            ├── system-config.md     # 系统配置
            └── tag-flashcard.md     # 标签与闪卡
```

---

## 添加更多技能

在 `skills/` 目录下创建新子目录，放入 `SKILL.md`（含 frontmatter）后即可被自动发现：

```
skills/
├── defuddle/
├── siyuan-sisyphus/
└── your-new-skill/
    └── SKILL.md
```

---

## 安全说明

- 思源笔记仅连接本地实例（默认 `http://localhost:6806`）
- Token 通过 `siyuan-sisyphus config` 管理，插件不提供写入功能
- 危险操作（删除/移动/全局替换）执行前需用户明确确认
- 详见 `AGENTS.md` 中的危险动作清单

---

## 许可证

MIT © [wooyang2018](https://github.com/wooyang2018)
