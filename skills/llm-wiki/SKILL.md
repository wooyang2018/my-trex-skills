---
name: llm-wiki
description: >
  在思源笔记本中构建和维护 AI 驱动知识库的完整工具集（通过 siyuan-sisyphus）。
  基于 Andrej Karpathy 的 LLM Wiki 模式——wiki 是编译产物，知识被蒸馏一次并保持更新。
  整合了初始化、摄取+综合、审计+图谱维护和报告生成四大能力。
  当用户想设置新 wiki、摄取文档/URL/对话、综合发现、自主研究、审计健康、
  去重/交叉链接/标签规范化/图谱着色、创建仪表板或知识摘要时使用。
  关键词："设置我的 wiki"、"摄取这个"、"处理这些文档"、"综合我的 wiki"、"研究 X"、
  "审计 wiki"、"清理 wiki"、"去重"、"交叉链接"、"标签规范化"、"给图谱上色"、
  "创建仪表板"、"每周总结"、"wiki 健康检查"、"日常更新"、"状态如何"。
---

# LLM Wiki — 知识蒸馏引擎

wiki 不是聊天机器人——它是**编译产物**，知识被蒸馏一次并保持更新。产物存在于**思源笔记本**中，只能通过 `siyuan-sisyphus` CLI 访问。

**完整宪法见 `references/constitution.md`**——三层架构、页面模板、置信度公式、生命周期状态机、10 条 CLI 校准说明等所有细节。本文件仅包含路由表和任何模块都必须遵守的致命错误避免清单。

## 模块路由

从用户措辞推断模块，加载对应 reference 后执行：

| 用户意图 / 关键词 | 模块 | Reference |
|---|---|---|
| "设置我的 wiki"、"初始化笔记本"、"切换笔记本"、"列出我的 wiki" | **setup** | `references/setup.md` |
| "摄取这个"、"处理这些文档"、"添加到 wiki"、URL/文件/对话摄入 | **ingest** | `references/ingest/index.md` |
| "综合我的 wiki"、"发现连接"、"发现综合缺口" | **ingest（内部综合）** | `references/ingest/synthesis.md` |
| "研究 X"、"自主研究"、"深入调查 X" | **ingest（外部研究）** | `references/ingest/synthesis.md` |
| "审计 wiki"、"清理 wiki"、"什么需要修复"、"wiki 健康检查" | **lint（审计）** | `references/lint/audit.md` |
| "修复"、"自动修复"、"consolidate" | **lint（Consolidate）** | `references/lint/consolidate.md` |
| "日常更新"、"定期维护" | **lint（日常更新）** | `references/lint/daily.md` |
| "状态如何"、"wiki 状态" | **lint（状态审计）** | `references/lint/daily.md` |
| "去重"、"查找重复页面"、"合并重复" | **lint（去重）** | `references/lint/dedup.md` |
| "交叉链接"、"添加链接"、"连接页面" | **lint（交叉链接）** | `references/lint/crosslink.md` |
| "标签规范化"、"标签审计"、"整理标签" | **lint（标签分类法）** | `references/lint/taxonomy.md` |
| "给图谱上色"、"颜色"、"可视化" | **lint（图谱着色）** | `references/lint/colorize.md` |
| "wiki 洞察"、"枢纽"、"中心"、"wiki 结构" | **lint（洞察分析）** | `references/lint/insights.md` |
| "创建仪表板"、"每周总结"、"知识报告"、"总结我最近的学习" | **report** | `references/report.md` |

加载 reference 前不需要预加载 constitution.md——各 reference 在需要时会引用具体章节。

## 致命错误避免清单

以下规则如被违反，会**静默损坏 wiki 数据**。所有模块必须遵守，无一例外。

### 1. 只通过 CLI 访问

每次读写通过 `siyuan-sisyphus` 进行。**禁止对笔记本目录进行原始文件系统访问**——会绕过思源的索引。

### 2. 链接格式

所有内部链接使用思源原生块引用：
```
((<20-char-doc-id> "display text"))
```
`[[wikilink]]` **不被**思源解析为图边。详见 `references/constitution.md` §15 + §13 校准说明 7。

### 3. query_sql 三条铁律

1. **始终包含 `box='$SIYUAN_NOTEBOOK_ID'`** — 不含则权限过滤器剥离全部结果
2. **始终包含 `LIMIT`** — 成熟 wiki 可能数千行
3. **始终投影 `id` 列**（blocks 表）或 `root_id`（refs 表）— 权限过滤器需要身份列

详见 `references/constitution.md` §13（含 10 条 CLI 实测校准说明）。

### 4. 三条硬性写入规则

1. **整页重写用 `fs write --overwrite`** — 切勿对多行内容用 `block update`（在第一个换行符处截断）
2. **增量日志追加用 `block append --data-type markdown`** — `fs write --overwrite` 会抹除历史
3. **Frontmatter 双重写入** — 正文顶部保留 YAML frontmatter，同时通过 `block set-attrs` 镜像到 `custom-*` 属性

### 5. 写入模式

规范的两步调用：
```
# 步骤 1：写正文（无 frontmatter，无前导 # Title 行）
siyuan-sisyphus fs write --path "/$SIYUAN_NOTEBOOK_NAME/<hpath>" --markdown "..." --overwrite

# 步骤 2：写元数据
siyuan-sisyphus document lookup --notebook "$SIYUAN_NOTEBOOK_ID" --hpath "/<hpath>"
siyuan-sisyphus block set-attrs --id <doc-id> --attrs '{"custom-title":"...","custom-tags":"...",...}'
```

### 6. 配置解析协议

所有模块必须使用此算法：
1. 从 CWD 向上遍历 `.env`（含 `SIYUAN_NOTEBOOK_ID`）直到 `$HOME`
2. 回退到 `~/.siyuan-wiki/config`
3. 两者都不存在则提示运行 setup 模块

`SIYUAN_NOTEBOOK_ID` 用于 `--notebook`/`WHERE box=`；`SIYUAN_NOTEBOOK_NAME` 用于 `fs *` 路径。

### 7. 危险演练

破坏性操作（`fs rm`、`fs mv`、`document move`、`block move`、`find_replace`、`tag remove`）前必须：
1. 用一句话复述影响
2. 等待用户明确批准
3. 权限非 `rwd` 则拒绝

### 8. 索引最终一致性

写入后不信任 `search fulltext`。验证写入用 `fs read` 直接读取或 `document lookup --hpath`。

---

## 参考文件索引

| 文件 | 内容 |
|---|---|
| `references/constitution.md` | 完整宪法——三层架构、笔记本组织、特殊文档、存储原语、页面模板、置信度与生命周期、检索原语、10 条 CLI 校准说明、环境变量、操作模式 |
| `references/setup.md` | 笔记本初始化 + 多笔记本管理（setup/switch/list/show/new） |
| `references/ingest/index.md` | 统一知识蒸馏入口——文档/图片摄取核心流程 + 质量检查 |
| `references/ingest/modes.md` | 特殊摄取模式——URL 摄取、数据摄取、对话捕获、历史导入 |
| `references/ingest/synthesis.md` | 综合发现 + 自主研究 |
| `references/lint/index.md` | Lint 路由入口——9 种模式的关键词分发 + 文件索引 |
| `references/lint/shared.md` | 共享操作——前置步骤、注册表构建、日志写入、安全协议 |
| `references/lint/audit.md` | 健康审计——13 项 Lint 检查 + 审计报告模板 |
| `references/lint/consolidate.md` | Consolidate 自动修复——6 项合并操作 + 试运行 |
| `references/lint/daily.md` | 日常维护周期 + 状态审计 |
| `references/lint/insights.md` | 图谱洞察——锚点/桥梁/标签簇/层级建议 |
| `references/lint/dedup.md` | 去重——身份解析 + 页面级合并 |
| `references/lint/crosslink.md` | 交叉链接——自动化块引用 + 关系类型推断 |
| `references/lint/taxonomy.md` | 标签分类法——受控词汇表审计与规范化 |
| `references/lint/colorize.md` | 图谱着色——按标签/类别/可见性着色文档 |
| `references/report.md` | 仪表板 + 知识摘要 |
