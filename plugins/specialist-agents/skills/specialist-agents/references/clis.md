# clis.md — pi / codebuddy / codex 命令参考

三个 CLI 的命令骨架、模型清单、授权开关与 session。通用契约（裸跑、保 session、写盘走 worktree）见 SKILL.md「调用契约」，这里只给各自的具体写法与差异。

## 通用：默认全权，写盘走 worktree

子 agent 默认拿全工具、跳过权限确认。命令模板**一律不传**工具白名单——`--tools`/`--allowedTools` 是"只留列出的"，传了反而砍掉其余工具；确需锁死能力（如只读复核）时才收窄。全权写盘开关只在 worktree 内允许（见 execution.md「B worktree 改盘」）：

| CLI | 全权写盘写法 | 裸跑 |
|---|---|---|
| pi | `-p` 模式默认即全权可写盘，无需额外开关 | `-ns -ne -np` |
| codebuddy | `--dangerously-skip-permissions`（仅 worktree 内） | 三件套环境变量 |
| codex | `--dangerously-bypass-approvals-and-sandbox`（仅 worktree 内） | —— |

## pi（默认主用通道）

```bash
pi -p "<任务>" --model <model> -ns -ne -np --thinking xhigh [--name <task-id>]
```

- `-p`：非交互（必加）
- `-ns -ne -np`：裸跑，关 skill / extension / prompt template 发现。需要某 skill 协作时显式 `--skill <path>`，某 extension 显式 `-e <path>`。
- `--name <task-id>`：命名 session，事后 `pi --resume <task-id>` 定位
- `--thinking xhigh`：reasoning 固定拉满，命令一律带上
- 模型：`deepseek/deepseek-v4-flash`（haiku 级，1M）、`deepseek/deepseek-v4-pro`（sonnet 级，1M）
- session：`--resume [id]` 选续、`-c` 续最近、`--export <file>` 导 HTML 复盘

```bash
# 代码探索
pi -p "在 plugins/ 下找出所有引用 'shadcn' 的 SKILL.md，列出文件名和命中行" \
  --model deepseek/deepseek-v4-flash -ns -ne -np --thinking xhigh --name explore-shadcn

# diff 解析（stdin 喂入）
git diff main...HEAD | pi -p "概括这份 diff 主要改动，按文件分组，标出风险点" \
  --model deepseek/deepseek-v4-flash -ns -ne -np --thinking xhigh --name diff-summary
```

## codebuddy（并发主力 / 视觉专项）

```bash
CODEBUDDY_DISABLE_AUTO_MEMORY=1 CODEBUDDY_DISABLE_HOT_RELOAD=1 CODEBUDDY_SKIP_BUILTIN_MARKETPLACE=1 \
codebuddy -p "<任务>" --model <model> --session-id <task-id> [--dangerously-skip-permissions]
```

- 三件套环境变量是裸跑：关 memory 自动加载 / 插件热加载 / 内置市场。codebuddy 没有关 skill/plugin/context-files 发现的开关，切到这程度已是上限。
- `--session-id <task-id>`：首选，用 task-id 作 id，便于 resume；`--add-dir <dir>` 放开额外可写目录
- 模型：`deepseek-v4-flash-ioa`（haiku 级，并发主选）、`deepseek-v4-pro-ioa` / `glm-5.1-ioa`（sonnet 级，pro 优先）、`gemini-3.1-pro`（视觉专项）、`hy3-preview-ioa`（用户明许才用）
- session：`--resume [id]` / `-c` 续最近
- `--json-schema` 强制结构化输出：默认不用（主 Claude 自己能读自然语言），下游有程序消费时再加

```bash
# 视觉评图
CODEBUDDY_DISABLE_AUTO_MEMORY=1 CODEBUDDY_DISABLE_HOT_RELOAD=1 CODEBUDDY_SKIP_BUILTIN_MARKETPLACE=1 \
codebuddy -p "看附图，评价排版、字号梯度、配色对比度、留白；提三条改进，每条点出问题+改法+为什么" \
  --model gemini-3.1-pro --session-id ui-review-landing
```

并发批量与 worktree 改盘示例见 execution.md。

## codex（高难复核换视角）

```bash
codex exec -m gpt-5.5 -c model_reasoning_effort="xhigh" --sandbox read-only "<任务>"
```

- **模型固定 `gpt-5.5`**：账号现可选 gpt-5.5（frontier）/ gpt-5.4 / gpt-5.4-mini / gpt-5.3-codex / gpt-5.2，但本 skill 只用 gpt-5.5——codex 的价值就是 frontier 换视角，便宜活归 deepseek，不启用更便宜的 codex 档。省额度靠压 `model_reasoning_effort`，不降模型。
- 用途：高难复核换视角（默认只读）；写盘改代码仅在用户点名或高价值改动时。日常脏活走 pi / codebuddy。
- `--sandbox read-only`：复核默认。写盘改用 `--dangerously-bypass-approvals-and-sandbox`（仅 worktree 内）。
- 其他：`--cd <dir>` / `-C` 切根、`--ignore-user-config` 忽略 `~/.codex/config.toml`、`--skip-git-repo-check` 非 git 仓库也能跑
- `-` 作参数表示 prompt 走 stdin：`codex exec - --sandbox read-only -m gpt-5.5 < spec.md`
- session：`codex resume` 选续、`codex exec resume --last` 续最近、`codex fork` 派生。`--output-schema` 默认不用。

```bash
# 复核一份 diff
git diff main...HEAD | codex exec -m gpt-5.5 -c model_reasoning_effort="xhigh" --sandbox read-only \
  "读这份 diff，找反例与盲点：边界情况、想当然处、未来半年可能踩的坑。只点问题，不复述 diff。"
```
