# Claude Code 与 Codex 双平台插件兼容设计

## 目标

让本仓库同时成为 Claude Code 与 Codex 的插件市场，并优先迁移高价值、低重复的能力。

本次交付包含四个 Codex 插件：

- `go-dev`：与 Claude Code 共用现有插件目录和 skills。
- `project-craft`：与 Claude Code 共用现有插件目录和 skills。
- `spec-craft`：与 Claude Code 共用现有插件目录和 skills，并从两端移除可视化伴侣。
- `frontend-craft`：Codex 专用精简插件，只保留 Codex 官方插件未覆盖或本仓库更有特色的前端能力。

仓库根目录新增符号链接 `AGENTS.md -> CLAUDE.md`，让 Codex 与 Claude Code 共用仓库说明。

## 不做什么

- 不把全部七个 Claude Code 插件迁移到 Codex。
- 不迁移 `design`、`product-management`、`specialist-agents`。
- 不让现有 `frontend-dev` 直接支持 Codex。
- 不在 `frontend-craft` 中复制 Codex 官方 Build Web Apps 和 Browser 已覆盖的能力。
- 不保留 `spec-craft` 的浏览器可视化伴侣。

## 仓库结构

```text
agent-plugins/
├── .agents/
│   └── plugins/
│       └── marketplace.json
├── .claude-plugin/
│   └── marketplace.json
├── AGENTS.md -> CLAUDE.md
└── plugins/
    ├── go-dev/
    │   ├── .claude-plugin/plugin.json
    │   ├── .codex-plugin/plugin.json
    │   └── skills/
    ├── project-craft/
    │   ├── .claude-plugin/plugin.json
    │   ├── .codex-plugin/plugin.json
    │   └── skills/
    ├── spec-craft/
    │   ├── .claude-plugin/plugin.json
    │   ├── .codex-plugin/plugin.json
    │   └── skills/
    ├── frontend-dev/
    │   ├── .claude-plugin/plugin.json
    │   └── skills/
    └── frontend-craft/
        ├── .codex-plugin/plugin.json
        └── skills/
```

## 双平台共享规则

`go-dev`、`project-craft`、`spec-craft` 在原目录中并存两套 manifest：

- Claude Code 读取 `.claude-plugin/plugin.json`。
- Codex 读取 `.codex-plugin/plugin.json`。
- 两端共用同一份 `skills/`，不复制 skill 内容。

Codex manifest 使用与插件目录一致的名称，并补齐 Codex 要求的版本、描述、作者和界面元数据。Codex marketplace 位于 `.agents/plugins/marketplace.json`，条目使用相对路径 `./plugins/<plugin-name>`。

## `go-dev`

保留 45 个现有 Go skills。大多数内容本身与宿主无关，可直接供两端使用。

兼容调整只处理会影响实际执行的 Claude 专属行为：

- 将 `go-spec-reviewer` 中固定的 Claude `Agent` 调用改成宿主无关的子代理派遣说明。
- 保留上游 skills 中的 `allowed-tools` 和兼容性描述，除非 Codex 验证明确报错；避免批量改写 45 个上游 skill。
- 更新 `plugins/go-dev/README.md`，补充 Codex 安装说明。

## `project-craft`

保留现有 `project-init` 和 `project-standards`。两者没有影响执行的 Claude 专属路径或命令，只需新增 Codex manifest 和安装说明。

## `spec-craft`

保留：

- `brainstorming`
- `writing-clear-chinese`
- `LICENSE`

删除：

- `skills/brainstorming/visual-companion.md`
- `skills/brainstorming/scripts/`
- `brainstorming` skill 中所有可视化伴侣步骤、流程图节点、触发说明和路径引用
- marketplace、README、CLAUDE.md 中的可视化伴侣描述

`spec-document-reviewer-prompt.md` 中固定的 Claude `Task tool` 说明改成宿主无关的审查说明。

这项删除同时影响 Claude Code 与 Codex：两端的 `spec-craft` 都只使用文字对话完成头脑风暴和规格设计。

## `frontend-craft`

`frontend-craft` 是 Codex 专用精简插件，包含四个 skills：

- `composition-patterns`
- `frontend-design`
- `react-native`
- `react-view-transitions`

不包含：

- `react-best-practices`：Codex Build Web Apps 已有同源版本。
- `shadcn`：Codex Build Web Apps 已有同源版本。
- `playwright-cli`：Codex Browser 与 frontend testing 能力更适合 Codex。
- `web-design-guidelines`：与 Codex Product Design 和前端测试能力重叠。

`frontend-craft` 中的四个 skills 从 `frontend-dev` 复制。仓库新增同步脚本，维护选定 skill 清单，并支持校验模式。这样既不削弱 Claude Code 的完整 `frontend-dev`，也能控制两份内容的同步成本。

`frontend-design` 的触发描述需要收窄：它负责审美方向、视觉细节和品牌范本，不接管 Codex 官方 Build Web Apps 已覆盖的完整应用构建流程。

## 文档

更新以下文件：

- `README.md`：说明仓库同时支持 Claude Code 与 Codex；分别列出安装命令和可用插件。
- `CLAUDE.md`：记录双 manifest 结构、Codex marketplace、新增插件和同步规则。
- `plugins/go-dev/README.md`：补充双平台安装说明。
- 相关 marketplace 与 manifest 中的 `spec-craft` 描述：移除可视化伴侣。

根目录新增符号链接：

```text
AGENTS.md -> CLAUDE.md
```

## 本机迁移与清理

仓库插件验证通过后，再清理本机现有重复能力：

1. 删除全局 `brainstorming` 和 `writing-clear-chinese`。
   - `~/.codex/skills` 指向 `~/.claude/skills`，因此删除会同时影响 Codex 与 Claude Code。
   - 删除前确认仓库中的 `spec-craft` 已通过双平台验证。
2. 检查 Codex 当前安装状态，卸载 `superpowers`。
   - 使用 Codex 安装或 marketplace 命令清理持久配置。
   - 不直接删除临时缓存目录。
3. 安装或注册本仓库 Codex marketplace，验证新插件可被发现。

## 错误处理与保护

- 保留用户现有未跟踪文件 `.claude/launch.json`，不修改、不删除。
- 新插件或 marketplace 验证失败时，不删除全局 skills，也不卸载 Superpowers。
- Codex 验证工具若缺少依赖，先使用仓库隔离环境安装依赖或采用等价的结构检查，不修改系统 Python。
- 清理本机能力前记录原路径和安装状态，便于恢复。
- 不手工删除 Codex 临时插件缓存。

## 验证

### 结构验证

- `.agents/plugins/marketplace.json` 可解析，包含四个目标插件。
- 三个双平台插件同时包含 Claude 与 Codex manifest。
- `frontend-craft` 只包含四个选定 skills。
- `AGENTS.md` 是指向 `CLAUDE.md` 的符号链接。
- 仓库内不再出现 `visual-companion`、`CLAUDE_PLUGIN_ROOT` 或可视化伴侣脚本引用。

### 插件验证

- 使用 plugin creator 的 `validate_plugin.py` 验证四个 Codex 插件。
- 解析并核对 Claude marketplace 与各 Claude manifest。
- 检查 marketplace 名称、插件目录名和 manifest 名称完全一致。
- 检查 Codex marketplace 中每个条目都包含安装策略、认证策略和分类。

### 内容验证

- 比较 `frontend-craft` 与 `frontend-dev` 中四个共享 skills，确认内容一致；仅允许 `frontend-design/SKILL.md` 存在明确记录的 Codex 触发描述差异。
- 确认 `go-spec-reviewer` 和 spec 审查模板不再固定依赖 Claude 工具名。
- 确认 README 与 CLAUDE.md 的插件列表、版本和安装命令一致。

### 本机验证

- Codex 能发现本仓库 marketplace 中的四个插件。
- 新线程中能触发 `go-dev`、`project-craft`、`spec-craft` 和 `frontend-craft` 的代表性 skill。
- 清理后，全局独立 `brainstorming`、`writing-clear-chinese` 和 Superpowers 不再重复出现。

