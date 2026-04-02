# siyuan-notes

一个面向 Claude Code 的思源笔记（SiYuan Notes）插件，提供完整的笔记操作技能集。

---

## 安装

### 方式 A：Claude Code 插件目录（推荐）

```bash
git clone https://github.com/wooyang2018/my-trex-skills.git siyuan-notes
claude --plugin-dir ./siyuan-notes
```

### 方式 B：项目级安装

将仓库克隆到项目目录，然后在 Claude Code 配置中注册：

```json
{
  "plugins": ["./siyuan-notes"]
}
```

安装后 Claude Code 自动发现并加载 `skills/` 目录下的所有技能，无需额外配置。

---

## 前置条件

| 要求 | 版本 | 说明 |
|------|------|------|
| **Node.js** | >= 14.0.0 | 运行思源笔记 CLI 工具 |
| **思源笔记** | >= 3.6.0 | 本地运行的思源笔记实例 |

---

## 环境变量

在 Claude Code 或系统环境中配置以下变量：

```bash
# 必需
SIYUAN_BASE_URL=http://localhost:6806
SIYUAN_TOKEN=你的API令牌          # 思源笔记 → 设置 → 关于 → API Token
SIYUAN_DEFAULT_NOTEBOOK=笔记本ID   # 运行 node skills/siyuan-skill/siyuan.js notebooks 获取

# 可选
SIYUAN_PERMISSION_MODE=all         # all / whitelist / blacklist
SIYUAN_NOTEBOOK_LIST=id1,id2       # 白名单/黑名单笔记本列表
```

详细配置说明见 [环境变量文档](skills/siyuan-skill/references/config/environment.md) 和 [config.json 配置](skills/siyuan-skill/references/config/advanced.md)。

---

## 技能列表

### siyuan-skill

操作思源笔记的完整技能，Claude Code 会在以下场景自动激活：

- 管理笔记本（列出、查看结构）
- 文档操作（创建、读取、更新、删除、移动、重命名）
- 块操作（插入、更新、删除、移动、折叠）
- 内容搜索（SQL 关键词搜索）
- 标签、属性、图标管理
- 路径与 ID 互转、文档存在性检查

**示例触发场景：**

> "在思源笔记中创建一篇关于 X 的文档"
> "搜索思源笔记中关于项目 A 的内容"
> "把这篇文档移动到项目 B 目录下"
> "给文档 20260304051123-doaxgi4 设置标签"

**CLI 直接使用：**

```bash
cd skills/siyuan-skill
node siyuan.js help              # 查看所有命令
node siyuan.js notebooks         # 列出笔记本
node siyuan.js search "关键词"   # 搜索内容
node siyuan.js create "标题" "内容" --parent-id <notebookId>
```

详细命令文档见 [skills/siyuan-skill/references/commands/](skills/siyuan-skill/references/commands/)。

---

## 插件结构

```
siyuan-notes/
├── .claude-plugin/
│   └── plugin.json              # 插件清单
└── skills/
    └── siyuan-skill/            # 思源笔记操作技能
        ├── SKILL.md             # 技能入口（Claude Code 自动加载）
        ├── siyuan.js            # CLI 入口
        ├── commands/            # 命令实现
        ├── lib/                 # 核心业务逻辑
        ├── utils/               # 工具函数
        ├── config.js            # 配置管理
        ├── connector.js         # API 连接器
        ├── config.example.json  # 配置示例
        └── references/          # 详细参考文档
            ├── commands/        # 各命令文档
            ├── config/          # 配置文档
            └── advanced/        # 最佳实践
```

---

## 添加更多技能

在 `skills/` 目录下创建新子目录，放入 `SKILL.md` 后即可被 Claude Code 自动发现：

```
skills/
├── siyuan-skill/        # 已有
│   └── SKILL.md
└── your-new-skill/      # 新增
    └── SKILL.md
```

---

## 安全说明

- 仅连接本地思源笔记实例（`http://localhost:6806`）
- `SIYUAN_TOKEN` 仅通过环境变量或 `config.json` 读取，插件不提供 Token 写入功能
- 删除操作默认禁用（`deleteProtection.safeMode: true`），需用户手动配置才能启用
- 生产环境建议使用 `whitelist` 权限模式

---

## 许可证

MIT © [wooyang2018](https://github.com/wooyang2018)
