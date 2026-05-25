# AI Agent 协作守则

本文档面向与 my-trex-skills 插件协作的 AI Agent（Claude Code / CodeBuddy），定义工作约定和安全边界。

---

## 插件总览

| 技能 | 触发场景 | 核心能力 |
|------|----------|----------|
| **defuddle** | 用户提供 URL 需阅读/分析/摘要网页内容 | 从 HTML 页面提取干净 Markdown |
| **siyuan-sisyphus** | 用户要求操作思源笔记的任何内容/结构/元数据 | 通过 CLI 完成笔记本/文档/块/属性视图/搜索/标签/闪卡/Excalidraw 操作 |

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

## 路径三种形态（铁律）

| 形态 | 用于 | 示例 |
|------|------|------|
| 工作区可读路径 | 全部 `fs` 动作 | `/笔记本名/目录/文档` |
| 笔记本本地 hpath | `document create --path` | `/目录/文档` |
| 存储路径（`.sy`） | `document lookup` 返回值 | `/20240318112233-abc123.sy` |

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

---

## 工作约定

1. **所有思源操作通过 CLI 完成** — 不直接调用 HTTP API，不写自定义脚本
2. **脚本/链式调用** — 输出加 `--json`
3. **长文档/列表** — 加 `--page N --page-size 8000` 避免截断
4. **多行内容写入** — 用 `block append` / `block insert` / `fs write`，不要用 `block update`（会截断）
5. **Excalidraw 嵌入** — 走 `scripts/excalidraw_compose.py`（Python ≥ 3.8），不要手拼 base64

---

## References 导引

按需查阅对应参考文档（位于 `skills/siyuan-sisyphus/references/`）：

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

---

## 故障快速排查

| 现象 | 对策 |
|------|------|
| 连不上 / 401 | `siyuan-sisyphus config list`，按 `system-config.md` 重设 profile |
| 命令字段不确定 | `siyuan-sisyphus help <tool> <action>` |
| 看不到笔记本 | `siyuan-sisyphus notebook get_permissions`，检查权限 |
| 刚写入搜不到 | 思源索引最终一致，稍候重试或按路径直接读 |
| defuddle 输出为空 | 页面可能需 JS 渲染，回退到 WebFetch |
