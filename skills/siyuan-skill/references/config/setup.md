# 安装配置指南

本文档包含安装步骤、前置要求和配置说明。

## 前置条件

| 要求 | 版本 | 说明 |
| --- | --- | --- |
| **Node.js** | >= 14.0.0 | 必需 |
| **思源笔记** | >= 3.6.0 | 运行中的本地实例 |

---

## Claude Code 安装（推荐）

通过 Claude Code 插件系统安装整个 `siyuan-notes` 插件：

```bash
# 克隆插件仓库
git clone https://github.com/dazexcl/siyuan-skill.git siyuan-notes

# 在 Claude Code 中以插件目录模式运行
claude --plugin-dir ./siyuan-notes
```

或将插件目录添加至 Claude Code 配置：

```json
{
  "plugins": ["./siyuan-notes"]
}
```

安装后，`siyuan-skill` 技能会自动加载，无需额外配置文件。

---

## 手动安装（其他 AI 工具）

### 步骤 1：获取文件

```bash
# 进入对应 AI 工具的 skills 目录
cd <skills-directory>

# 克隆仓库
git clone https://github.com/dazexcl/siyuan-skill.git

# 进入技能目录
cd siyuan-skill/skills/siyuan-skill
```

### 步骤 2：获取思源笔记凭证

**获取 API Token：**

1. 打开思源笔记
2. 进入 **设置 → 关于**
3. 复制 **API Token**

**获取笔记本 ID：**

> **注意：** 需要先配置好环境变量或 config.json，才能运行命令。

```bash
# 在 skills/siyuan-skill 目录下运行

# 方式1：临时设置环境变量后运行（macOS/Linux）
SIYUAN_BASE_URL="http://localhost:6806" SIYUAN_TOKEN="你的token" node siyuan.js notebooks

# 方式2：临时设置环境变量后运行（Windows PowerShell）
$env:SIYUAN_BASE_URL="http://localhost:6806"; $env:SIYUAN_TOKEN="你的token"; node siyuan.js notebooks

# 方式3：先创建 config.json，再运行
cp config.example.json config.json
# 编辑 config.json 填入 token，然后运行
node siyuan.js notebooks
```

### 步骤 3：配置环境变量

在你的 AI 工具配置中添加以下环境变量：

```bash
# 必需配置
SIYUAN_BASE_URL=http://localhost:6806
SIYUAN_TOKEN=你的API令牌
SIYUAN_DEFAULT_NOTEBOOK=你的笔记本ID

# 可选配置
SIYUAN_PERMISSION_MODE=all
```

### 步骤 4：验证安装

```bash
cd skills/siyuan-skill
node siyuan.js notebooks
```

成功输出示例：

```json
{
  "success": true,
  "data": [
    { "id": "20260227231831-yq1lxq2", "name": "我的笔记本" }
  ]
}
```

---

## 不同 AI 工具的配置位置

| AI 工具 | 配置位置 |
| --- | --- |
| **Claude Code** | 插件目录（`--plugin-dir`）或项目 `.claude/` 配置 |
| OpenClaw | `.openclaw/skills/` 目录或 `~/.openclaw/env` 环境变量 |
| Trae | `.trae/rules/project_rules.md` 或系统环境变量 |
| Claude Desktop | `claude_desktop_config.json` |
| Cursor | `.cursor/rules` 或系统环境变量 |

---

## 配置文件方式（可选）

如果你更倾向于使用配置文件而非环境变量：

```bash
cd skills/siyuan-skill
cp config.example.json config.json
```

编辑 `config.json`：

```json
{
  "baseURL": "http://localhost:6806",
  "token": "你的API令牌",
  "defaultNotebook": "你的笔记本ID"
}
```

> **注意：** 环境变量优先级高于配置文件。

---

## 快速测试命令

```bash
# 查看帮助
node siyuan.js help

# 获取笔记本列表
node siyuan.js notebooks

# 获取文档结构（需要指定笔记本ID或路径）
node siyuan.js structure <notebook-id>
node siyuan.js structure --path "/笔记本名"

# 搜索内容
node siyuan.js search "关键词"
```

---

## 更新

```bash
cd siyuan-notes  # 插件根目录
git pull origin main
node skills/siyuan-skill/siyuan.js help  # 验证
```
