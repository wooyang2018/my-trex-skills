---
name: specialist-agents
description: "凡是要起内置 haiku/sonnet 子 agent 干脏活——仓库范围检索、多文件概要、文案/文档体力活、机械代码生成、日志/测试/diff 解析、并发跑 4+ 路、需要『换一双眼睛』高难复核——一律改走本 skill。不要用：跨文件设计与重构、debug 根因分析、依赖主线对话上下文的多步推理、用户已点名 sonnet/opus 的任务。"
---

# 按专长召唤外部 CLI agent

把脏活分给外部 CLI——pi / codebuddy / codex——不再起内置 haiku/sonnet 子 agent。haiku/sonnet 太贵，效果不如 deepseek-v4-flash / deepseek-v4-pro / glm-5.1-ioa。跨文件设计、debug 根因、依赖主线对话上下文的多步推理，主 Claude 自己干，不在本 skill 范围。

## 该用 / 不该用

**该用**：代码探索、多文件概要、文案/文档体力活、机械代码生成、日志/测试/diff 解析、并发 4+ 路、视觉/审美专项、高难复核换视角。

**不该用**：跨文件设计与重构、debug 根因、依赖主线上下文的多步推理、用户已点名 sonnet/opus 的任务。

## 路由速查

| 任务 | CLI + 模型 | 交付 |
|---|---|---|
| 代码探索、多文件概要、文案/文档、机械代码、日志/diff 解析 | pi + deepseek-v4-flash/pro | A 报告 / B 改盘 |
| 并发 ≥ 4 路 | codebuddy + deepseek-*-ioa | C 落盘 |
| 视觉 / 审美专项 | codebuddy + gemini-3.1-pro | A 报告 |
| 高难复核换视角 | codex + gpt-5.5 | A 报告 |

模型分级、决策表、失败兜底见 `references/routing.md`；三个 CLI 的命令与开关见 `references/clis.md`；交付、worktree、并发、落盘见 `references/execution.md`。

## 硬禁

- pi：`moonshotai/kimi-*` 全系列
- codebuddy：`claude-*` 与 `gpt-*` 全系列
- codebuddy：`hy3-preview-ioa` 默认禁用，仅当次请求用户明文许可才用
- 主 Claude：本 skill 覆盖的脏活，不再起内置 haiku/sonnet 子 agent——deepseek-v4-pro / glm-5.1-ioa 已属 sonnet 级，deepseek-v4-flash 已远胜 haiku
- 放开任一项都要用户当次明文许可，且只在当次有效

## 调用契约

每次调用都要满足：

1. **裸跑**：pi 加 `-ns -ne -np`；codebuddy 前置三件套环境变量（`CODEBUDDY_DISABLE_AUTO_MEMORY=1 CODEBUDDY_DISABLE_HOT_RELOAD=1 CODEBUDDY_SKIP_BUILTIN_MARKETPLACE=1`）。不继承宿主的 skill/插件/memory，结果更干净、token 更省。
2. **保 session**：不传 `--no-session`（pi）/ `--ephemeral`（codebuddy/codex）。`pi --resume` / `codebuddy --resume` / `codex resume` 是事后复盘唯一入口。
3. **写盘走 worktree**：子 agent 默认全权（全工具 + 跳过确认），但凡写盘先 `git worktree add` 隔离。全权写盘开关（codebuddy `--dangerously-skip-permissions`、codex `--dangerously-bypass-approvals-and-sandbox`、pi 默认即可写盘）只在 worktree 内放行。
4. **落盘到 `.specialist-agents/`**：首次调用前检查项目根 `.gitignore`，缺这一行就补上。报告是中间产物，不进 git。
5. **并发先列切片清单**：起命令前列给用户看——每片做什么、走哪 CLI、走哪模型、落到哪个文件。每片 `> .specialist-agents/<slice>.md 2>&1`，不把多路 stdout 串成一团。上限 10 路左右，IOA 后端会限流。
6. **失败不跨级降档**：单片失败换同级模型在另一 CLI 重试一次；仍失败上报主 Claude。任务难度不因 CLI 故障变低。
