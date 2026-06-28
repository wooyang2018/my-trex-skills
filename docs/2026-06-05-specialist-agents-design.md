# specialist-agents 插件设计

**日期：** 2026-06-05
**状态：** 已认可，待实现

## 目的

把固定、轻量、重复型的脏活分给外部 CLI agent（pi / codebuddy / codex），不再让 Claude Code 内置的 haiku / sonnet 子 agent 干这些活——它们的单 token 价值远低于 deepseek-v4-flash / deepseek-v4-pro / glm-5.1-ioa。

## 边界

**纳入：**

- 仓库范围检索与多文件概要
- 文案/文档体力活（拼写、Markdown lint、翻译、风格统一）
- 机械代码生成与重复型重构（boilerplate、import、测试骨架）
- 日志 / 测试 / diff 输出解析
- 大量并发脏活（10+ 路）
- 视觉/审美专项判断
- 高难复核（"换一双眼睛"看主 Claude 的产出）

**不纳入：**

- 跨文件设计与重构、debug 根因分析、需要主线对话上下文的多步推理
- 用户已点名要 sonnet/opus 处理的任务

## 模型分级与黑白名单

**haiku 级**

- `deepseek/deepseek-v4-flash`（pi）
- `deepseek-v4-flash-ioa`（codebuddy）

**sonnet 级**

- `deepseek/deepseek-v4-pro`（pi）
- `deepseek-v4-pro-ioa`（codebuddy）
- `glm-5.1-ioa`（codebuddy）
- 优先级：deepseek-v4-pro > glm-5.1

**专项**（不进通用分级）

- `gemini-3.1-pro`（codebuddy）—— UI/审美评图
- `gpt-5.5`（codex）—— 高难复核换视角
- `hy3-preview-ioa`（codebuddy）—— 仅极简单 + 用户明许

**硬禁**

- pi：`moonshotai/kimi-*` 全系列
- codebuddy：`claude-*`、`gpt-*` 全系列
- codebuddy：`hy3-preview-ioa` 默认禁用，仅当用户在当次请求中明文许可才可用
- 主 Claude 自身：本 skill 覆盖范围内的脏活不得再起 haiku / sonnet 子 agent——deepseek-v4-pro / glm-5.1-ioa 已属 sonnet 级，deepseek-v4-flash 已远胜 haiku

## 路由表

| 任务形状 | 主用 | 模型 | 交付 |
|---|---|---|---|
| 代码探索 — 简单（grep、列文件、找符号、看单文件结构） | pi | haiku 级（`deepseek-v4-flash`） | 报告回传 |
| 代码探索 — 困难（跨文件追调用链、判断"X 在哪定义/谁引用了 Y"、需推断意图） | pi | sonnet 级（`deepseek-v4-pro`） | 报告回传 |
| 多文件概要（单跑，≤1M） | pi | sonnet 级 | 报告回传 / 落报告 |
| 文案/文档轻智力 | pi | haiku 级 | 直接改代码（worktree） |
| 机械代码生成 / 重复型重构 | pi | sonnet 级 | 直接改代码（worktree） |
| 日志 / 测试 / diff 输出解析 | pi（stdin pipe） | haiku 级 | 报告回传 |
| 大量并发脏活（10+ 路） | codebuddy | flash-ioa > pro-ioa > glm-5.1-ioa | 落报告文件 |
| 中等并发（4–9 路） | codebuddy | 同上序列按任务难度选档 | 落报告文件 |
| 低并发（2–3 路） | pi | 按形状选档 | 报告回传 |
| 视觉/审美专项 | codebuddy | `gemini-3.1-pro` | 报告回传 |
| 高难复核（换视角） | codex | `gpt-5.5` | 报告回传 |
| 极简单 + 用户明许 | codebuddy | `hy3-preview-ioa` | 报告回传 |

档位由主 Claude 自行判断。

## 三种交付方式

**A. 报告回传（默认）**

子 agent 把分析/检索/复核结果写到 stdout，主 Claude `Bash` 拿回输出。
适用：检索、概要、解析、复核、视觉评图。

**B. 直接改代码（worktree 隔离）**

主 Claude 用 `git worktree add` 起隔离分支；子 agent 加 `--dangerously-skip-permissions`（codebuddy）或 pi 默认全工具开，进去改盘。改完 `git diff` 看结果，满意合回主工作树，不满意丢弃 worktree。
适用：机械代码生成、重复型重构、文案批量修订。
**护栏：** 动盘前必须在隔离 worktree 里跑；不许直接在用户主工作树上让子 agent 写盘。

**C. 报告落盘 + 按需 Read**

子 agent 把输出写到 `.specialist-agents/<task-id>--<slice>.md`，主 Claude 之后按需 Read。
适用：拆分后并发 ≥ 4 路；或子 agent 自身需要边读边记。
**护栏：** 写入路径限定在 `.specialist-agents/`；首次调用前主 Claude 检查并补 `.gitignore` 一行。

## 选交付方式的判据

按"任务形状"判断，**不预设输出 token 阈值**——deepseek-v4-flash/pro 都是 1M 上下文，多数长任务一次能跑完，不为"输出可能很长"而提前拆。

- **检索 / 概要 / 复核 / 解析** 这类只产文字结论的：默认 A。
- **机械代码生成 / 重复型重构 / 文案批量修订** 这类要落盘的：B。
- **任务天然可独立切片**（10 个文件各自审一遍、20 条日志各自归类、N 个目录各自概要）：拆 → 并发 → C。
  - 拆分依据是"切片是否独立、是否能各自闭环"，不是看预计输出大小。
  - 切片不独立、勉强能塞进 1M 上下文的，单跑走 A，别为拆而拆。

主 Claude 自己判断不准时，先按 A 跑一次；输出明显爆量再回头拆。

## 上下文传入三件套

**1. 一次性 prompt（默认）**

```bash
pi -p "在 plugins/frontend-dev 下找出所有引用 'shadcn' 的 SKILL.md，列出文件名" --model deepseek/deepseek-v4-flash
```

适用：任务描述短、上下文靠子 agent 自己读盘就能拿到。

**2. stdin pipe 传大输入**

```bash
git diff main...HEAD | pi -p "概括这份 diff 的主要改动点，按文件分组列出" --model deepseek/deepseek-v4-flash
go test ./... 2>&1 | codebuddy -p "提取所有失败用例与错误信息，列成表格" --model deepseek-v4-flash-ioa
```

适用：要喂主 Claude 已经在手的大块文本（diff、测试输出、日志、长文档）给子 agent，避免主 Claude 把它们塞进自己上下文转手。

**3. 报告落盘 + 按需 Read（并发场景必走）**

```bash
codebuddy -p "审 plugins/go-dev/skills/golang-cli/SKILL.md 是否有过时表述，结果写到 .specialist-agents/audit-golang-cli.md" \
  --model deepseek-v4-flash-ioa --dangerously-skip-permissions &
codebuddy -p "..." --model deepseek-v4-flash-ioa --dangerously-skip-permissions &
wait
```

适用：切片并发 ≥ 4 路；或子 agent 自身需要边读边记中间结果。

**选哪件的口诀：**

- 没大输入要喂、单路 → 1
- 主 Claude 手里有大块文本要喂下去 → 2
- 切片并发 → 3

## 并发与拆分

**并发位的归属**

- **2–3 路并发**：直接 pi 重复跑（shell `&` + `wait`）。
- **4–9 路并发**：codebuddy（视为再叠 2–3 路并发）。
- **10+ 路**：codebuddy 主力，模型按"大量并发脏活"那行：`deepseek-v4-flash-ioa > deepseek-v4-pro-ioa > glm-5.1-ioa`，按任务难度选档。

**拆分依据**

- 切片必须自洽——每片单独看也能闭环。
- 切片之间不互相依赖结果——A 片的产出不被 B 片需要。
- 切片粒度看任务形状，不看预计输出 token——deepseek 1M 上下文够装。

**汇总**

- 并发跑出的报告统一落 `.specialist-agents/<task-id>--<slice>.md`。
- 主 Claude 拿到所有切片后按需 Read：先 Read 几片看模式 → 决定要不要全 Read → 必要时再起一个子 agent 做"二级汇总"。

**失败兜底**

- 单切片 CLI 失败：换同级模型在另一个 CLI 重试一次。仍失败 → 主 Claude 决定是否亲自处理那一片或放弃。
- 不跨级降档（不会因 sonnet 级失败就退到 haiku 级——任务难度没变）。

**护栏**

- 主 Claude 起并发前必须先列出"切片清单"给用户看一眼，再 fire and forget。
- 并发不是越多越快，超过 10 路 IOA 后端可能限流。
- 并发跑命令时不要直接把 stdout 串成一团——一律 `> .specialist-agents/<slice>.md 2>&1` 落盘。

## Session 持久化

所有 CLI 调用一律保留 session，方便事后 `pi --resume` / `pi --continue` / `codebuddy --continue` 复盘。

- pi：**不**用 `--no-session`；命令模板里禁止出现该开关。可加 `--name <task-id>` 命名以便事后认领。
- codebuddy：**不**用 `--ephemeral` 之类丢弃 session 的开关。
- codex：`codex exec` 默认持久化 session，**不**加 `--ephemeral`；高难复核场景默认 `--sandbox read-only`，不让复核子 agent 写盘。

## 文件清单

```
plugins/specialist-agents/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── specialist-agents/
        ├── SKILL.md
        └── references/
            ├── routing.md          # 任务形状 → 推荐外援的决策表（正反例）+ 模型分级 + 黑白名单
            ├── pi.md               # pi 命令骨架、模型清单、stdin pipe、worktree 改盘
            ├── codebuddy.md        # codebuddy 命令骨架、模型白/黑名单、并发模板、专项模型说明
            ├── codex.md            # codex exec 命令骨架、复核场景模板
            ├── concurrency.md      # 并发位归属、拆分依据、汇总、失败兜底、护栏
            ├── delivery.md         # 三种交付的判据与命令模板、worktree 操作、.specialist-agents/ 维护
            └── context-passing.md  # 一次性 prompt / stdin pipe / 报告落盘三件套
```

## 触发门槛（写进 SKILL.md description）

> **specialist-agents** —— 把固定、轻量、重复型的脏活分给外部 CLI agent（pi / codebuddy / codex），不再让 sonnet/opus 亲自下场。
>
> **该用：** 仓库范围检索与多文件概要、文案/文档体力活、机械代码生成、日志/测试/diff 解析、需要并发跑 6+ 路的脏活、需要"换一双眼睛"做高难复核。
>
> **不该用：** 跨文件设计与重构、debug 根因分析、需要主线对话上下文的多步推理、用户已点名要 sonnet/opus 处理的任务。
>
> **不该用（硬禁）：**
>
> - codebuddy 的 `claude-*` / `gpt-*` 模型 —— 全程禁止
> - pi 的 `moonshotai/kimi-*` 模型 —— 全程禁止
> - `hy3-preview-ioa` —— 默认禁用，仅当用户在当次请求中明文许可才可用
> - 主 Claude 自身遇到本 skill 覆盖范围内的脏活，不得再起 haiku / sonnet 子 agent —— 要么走 specialist-agents，要么主 Claude 自己直接处理

## marketplace 注册

`plugins/specialist-agents/.claude-plugin/plugin.json`：

```json
{
  "name": "specialist-agents",
  "version": "1.0.0",
  "description": "按专长把脏活分给外部 CLI agent（pi / codebuddy / codex），避开 haiku/sonnet 的低性价比工时",
  "author": "okarinhuang"
}
```

`.claude-plugin/marketplace.json` 的 `plugins` 数组追加：

```json
{
  "name": "specialist-agents",
  "description": "按专长召唤外部 CLI agent：pi（deepseek 高 token 效能）/ codebuddy（多并发与专项模型）/ codex（gpt-5.5 高难复核换视角）。把检索、概要、机械代码生成、文案体力活分出去，避开 haiku/sonnet 的低性价比工时。",
  "version": "1.0.0",
  "source": "./plugins/specialist-agents",
  "tags": ["delegate", "cli-agent", "pi", "codebuddy", "codex", "deepseek", "cost-saving"],
  "channel": "stable"
}
```

并在根 marketplace.json 顶部 `keywords` 数组追加 `"delegate"`、`"cli-agent"`。

## CLAUDE.md 维护要点

仓库根 CLAUDE.md 在"仓库概述"表格末尾追加一行 `specialist-agents | plugins/specialist-agents/ | 自编（无上游）`；在"编辑原则"末尾加：

- **模型黑名单是硬约束**：pi 上 `moonshotai/kimi-*` 全系列、codebuddy 上 `claude-*` / `gpt-*` 全系列、`hy3-preview-ioa` 默认禁用——三处任何一项放开都需要明文修订该 skill。
- **session 一律保留**：不要在命令模板里加 `--no-session` / `--ephemeral` 之类丢弃 session 的开关；session 是事后复盘的唯一入口。
- **写盘必走 worktree**：B 类"直接改代码"的命令模板，必须先 `git worktree add` 隔离，再让子 agent 进去改；不要直接在主工作树上让子 agent 写盘。
- **`.specialist-agents/` 目录** 是子 agent 的报告落盘位置，由 skill 自身维护 `.gitignore`。
- **CLI 升级**：pi/codebuddy/codex 任意一家的 `--list-models` 输出变化或新增专项模型时，要回头同步 references/routing.md 的模型分级与黑白名单。
