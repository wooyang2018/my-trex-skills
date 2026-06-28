# routing.md — 任务形状到外援的决策表

模型黑名单见 SKILL.md「硬禁」。本文给正向选择：选哪档模型、按什么决策表、失败怎么兜。

## 模型分级

| 档 | pi | codebuddy |
|---|---|---|
| haiku 级 | `deepseek/deepseek-v4-flash` | `deepseek-v4-flash-ioa` |
| sonnet 级 | `deepseek/deepseek-v4-pro` | `deepseek-v4-pro-ioa` > `glm-5.1-ioa` |

专项（不进通用分级，按场景显式点用）：

- `gemini-3.1-pro`（codebuddy）—— UI / 审美评图
- `gpt-5.5`（codex）—— 高难复核换视角；用户点名时也用于写盘（账号另有更便宜的 codex 档，本 skill 固定用 frontier）
- `hy3-preview-ioa`（codebuddy）—— 仅极简单 + 用户明许

## 决策表

| 任务形状 | CLI | 模型 | 交付 |
|---|---|---|---|
| 代码探索——简单（grep、列文件、找符号、看单文件） | pi | deepseek-v4-flash | A |
| 代码探索——困难（追调用链、谁定义/引用了 X、需推断意图） | pi | deepseek-v4-pro | A |
| 多文件概要 | pi | deepseek-v4-pro | A（多片独立可拆 → C）|
| 文案/文档轻智力（拼写、lint、翻译、风格统一） | pi | deepseek-v4-flash | B 改盘 |
| 机械代码 / 重复型重构（boilerplate、补 import、测试骨架） | pi | deepseek-v4-pro | B 改盘 |
| 日志/测试/diff 解析 | pi（stdin） | deepseek-v4-flash | A |
| 并发 2–3 路 | pi 重复跑（`&`+`wait`） | 按形状选档 | A / C |
| 并发 4–9 路 | codebuddy | flash-ioa > pro-ioa > glm-5.1 | C |
| 并发 10+ 路 | codebuddy | 同上序列 | C（留意 IOA 限流）|
| 视觉/审美专项 | codebuddy | gemini-3.1-pro | A |
| 高难复核换视角 | codex | gpt-5.5 | A（`--sandbox read-only`）|
| 用户点名 gpt-5.5 写盘 | codex | gpt-5.5 | B 改盘（worktree）|
| 极简单 + 用户明许 | codebuddy | hy3-preview-ioa | A |

代码探索两档由主 Claude 判断。codex 写盘单价高、非默认通道——批量写盘走 pi / codebuddy。

## 失败兜底

- 单片 / 单次失败 → 换同级模型在另一 CLI 重试一次。例：pi `deepseek-v4-pro` 失败 → codebuddy `deepseek-v4-pro-ioa` → `glm-5.1-ioa`。
- 同级横切，**不**降到 haiku 级——任务难度不因 CLI 故障变低。
- 同级全失败 → 报回主 Claude 决定接手或放弃，不静默退档。落盘文件首行写 `[FAILED] <原因>`。
