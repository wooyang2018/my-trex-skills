---
name: siyuan-skill
description: 思源笔记操作工具，支持笔记本管理、文档创建/更新/删除/搜索、块操作。当用户需要操作思源笔记时使用——包括管理笔记本、操作文档（创建、更新、删除、移动、重命名、搜索）、操作块（插入、更新、删除、移动、折叠）、管理标签/属性/图标、检查文档是否存在、转换ID和路径等任务。只要涉及思源笔记的任何操作，都应调用此技能。
compatibility:
  tools:
    - Bash
---

> **运行要求：** Node.js >= 14.0.0，思源笔记 >= 3.6.0
>
> **安装/配置：** 见 [安装配置指南](references/config/setup.md)
>
> **环境变量：** 见 [环境变量文档](references/config/environment.md)

---

# 快速开始

```bash
cd skills/siyuan-skill
node siyuan.js <command> [options]
node siyuan.js help <command>  # 查看命令帮助
node siyuan.js --version       # 显示版本信息
```

---

# 快速决策表

## 笔记本与文档操作

| 用户需求 | 命令 | 示例 |
|----------|------|------|
| 查看笔记本列表 | `notebooks` / `nb` | `siyuan nb` |
| 查看文档结构 | `structure` / `ls` | `siyuan ls <notebookId>` |
| 查看文档内容 | `content` / `cat` | `siyuan cat <docId>` |
| 获取文档信息 | `info` | `siyuan info <docId>` |
| 创建新文档 | `create` / `new` | `siyuan create "标题" --parent-id xxx` |
| 修改整个文档 | `update` / `edit` | `siyuan update <docId> "完整内容"` |
| 删除文档 | `delete` / `rm` | `siyuan rm <docId>` |
| 移动文档 | `move` / `mv` | `siyuan mv <docId> <targetId>` |
| 重命名文档 | `rename` | `siyuan rename <docId> "新标题"` |
| 保护/取消保护 | `protect` | `siyuan protect <docId>` |
| 检查文档存在 | `exists` / `check` | `siyuan exists --title "标题"` |
| 转换ID和路径 | `convert` / `path` | `siyuan path "/笔记本/文档" --to-id` |
| 设置文档图标 | `icon` | `siyuan icon <docId> --emoji 1f4c4` |
| 设置文档属性 | `block-attrs` / `ba` | `siyuan ba <docId> --set "status=done"` |
| 设置标签 | `tags` / `st` | `siyuan st <docId> "A,B"` |
| 搜索内容 | `search` / `find` | `siyuan search "关键词"` |

## 块操作

| 用户需求 | 命令 | 示例 |
|----------|------|------|
| 获取块信息 | `block-get` / `bg` | `siyuan bg <blockId> --mode kramdown` |
| 修改单个块 | `block-update` / `bu` | `siyuan bu <blockId> "块内容"` |
| 插入新块 | `block-insert` / `bi` | `siyuan bi "内容" --parent-id xxx` |
| 删除单个块 | `block-delete` / `bd` | `siyuan bd <blockId>` |
| 移动块 | `block-move` / `bm` | `siyuan bm <blockId> --parent-id xxx` |
| 折叠/展开块 | `block-fold` / `bf` | `siyuan bf <blockId>` |
| 转移块引用 | `block-transfer-ref` / `btr` | `siyuan btr <srcId> <tgtId>` |

> ⚠️ **重要区分**：`update` 只接受文档ID，`block-update` 只接受块ID

---

# 块操作决策流程

操作块前务必先查看结构：
1. `siyuan bg <blockId> --mode kramdown` — 查看块结构
2. 分析哪些块需要修改或删除
3. 选择正确命令：`bu`（修改内容）、`bd`（删除块）、`bi`（插入新块）

---

# 重名检测

以下命令在执行前自动检测目标位置是否存在同名文档：

| 命令 | 冲突处理 |
|------|----------|
| `create` | 返回错误，用 `--force` 强制创建 |
| `move` | 返回错误，用 `--new-title` 指定新标题 |
| `rename` | 返回错误，需更换新标题 |

手动检查：
```bash
siyuan exists --title "文档标题" [--parent-id <父文档ID>]
siyuan exists --path "/目录/文档标题"
```

---

# 删除保护

**默认禁止删除文档**。需用户手动在 `config.json` 中启用。

> ⚠️ **Agent 禁止自动修改此配置**

保护层级：全局安全模式 → 文档保护标记 → 删除确认机制

若删除被阻止，告知用户修改配置，或用 `protect <docId> --remove` 移除文档保护标记。

---

# 最佳实践

## 创建文档工作流

```
1. siyuan exists --title "标题" [--parent-id <父ID>]
2a. 不存在 → siyuan create "标题" "内容" --parent-id <id>
2b. 已存在 → 询问用户：覆盖用 update，新建同名用 --force
```

## 修改文档工作流

```
1. siyuan content <docId>         # 获取当前内容
2a. 全文替换 → siyuan update <docId> "完整新内容"
2b. 修改部分块 → siyuan bg <blockId> --mode kramdown
                  siyuan bu <blockId> "新内容"
```

## create 命令模式

| 模式 | 示例 |
|------|------|
| 已知父ID | `siyuan create "标题" "内容" --parent-id <id>` |
| 路径指定（多级） | `siyuan create --path "笔记本/A/B/C" "内容"` |
| 目录下创建 | `siyuan create --path "笔记本/目录/" "标题" "内容"` |

> 📋 详见 [create 命令文档](references/commands/create.md)

## 文档格式

```bash
# ✅ 正确：使用 \n 换行
siyuan create "标题" "第一段\n\n## 二级标题\n内容"

# ❌ 错误：内容全在一行
siyuan create "标题" "第一段## 二级标题 内容"
```

## 常见错误预防

| 错误场景 | 正确做法 |
|----------|----------|
| 文档已存在 | 先 `exists` 检查，再用 `--force` |
| 删除被阻止 | 告知用户修改配置或用 `protect` 移除标记 |
| ID 类型混淆 | `update` 只用文档ID，`bu` 只用块ID |
| 修改部分内容 | 用 `bu` 或 `bd` 进行块级操作 |

## 书写规范

内部链接：`((docId '标题'))`

SQL 嵌入块：`{{ SELECT * FROM blocks WHERE type = 'd' ORDER BY updated DESC LIMIT 5 }}`

> 📋 完整规范见 [书写指南](references/advanced/writing-guide.md) 和 [最佳实践](references/advanced/best-practices.md)

---

# 安全要点

- 仅使用本地实例（`http://localhost:6806`）
- 推荐使用 `whitelist` 权限模式
- 删除功能默认禁用，需用户手动配置
- 所有敏感配置（token 等）仅通过环境变量注入，技能不提供配置写入能力
- `SIYUAN_TOKEN` 仅从环境变量或 `config.json` 读取，技能绝不写入 token

> 📋 详细安全配置见 [配置文档](references/config/advanced.md)

---

# 参考文档

- [安装配置指南](references/config/setup.md)
- [环境变量配置](references/config/environment.md)
- [命令详细文档](references/commands/)
- [书写指南](references/advanced/writing-guide.md)
- [最佳实践](references/advanced/best-practices.md)
- [使用指南（故障排除）](references/advanced/usage-guide.md)
