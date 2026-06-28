# execution.md — 交付、worktree、并发、上下文传入

## 三种交付 A / B / C

| 交付 | 适用 | 形式 |
|---|---|---|
| **A 报告回传**（默认） | 检索、概要、复核、解析、视觉评图 | 子 agent 写 stdout，主 Claude `Bash` 拿回 |
| **B worktree 改盘** | 机械代码、重复型重构、文案批量修订 | 隔离 worktree → 改 → 主 Claude `git diff` → 合回或丢 |
| **C 报告落盘** | 并发 ≥ 4 路，或子 agent 要边读边记 | 写到 `.specialist-agents/<task-id>--<slice>.md`，主 Claude 挑着 Read |

判据：只产文字 → A；要改代码 → B；能切片各自独立 → 拆 → 并发 → C。不预设输出 token 阈值——deepseek 1M 够装大多数长任务，输出爆量再从 A 切到 C。

## B worktree 改盘

写盘的唯一正确姿势，绝不在主工作树上让子 agent 写盘。

```bash
# 1. 起隔离 worktree（路径放主工作树外）
git worktree add ../specialist-wt-<id> -b specialist/<id>
# 2. 进去让子 agent 改（全权开关见 clis.md）
cd ../specialist-wt-<id>
CODEBUDDY_DISABLE_AUTO_MEMORY=1 CODEBUDDY_DISABLE_HOT_RELOAD=1 CODEBUDDY_SKIP_BUILTIN_MARKETPLACE=1 \
codebuddy -p "<改什么>" --model deepseek-v4-pro-ioa --dangerously-skip-permissions --session-id <id>
cd -
# 3. 主 Claude 看 diff 再定夺
git -C ../specialist-wt-<id> diff
# 4a. 满意 → 合回：git -C ../specialist-wt-<id> diff | git apply（或 cherry-pick / merge 分支）
# 4b. 不满意 → 丢：git worktree remove ../specialist-wt-<id> --force && git branch -D specialist/<id>
```

护栏：

- 全权写盘开关只在 worktree 内加；主工作树上加 = 放任改盘，禁止。pi 默认即可写盘，同样只在 worktree 内放它改。
- 一条 worktree 跑一个写盘任务。多路改盘 → 多条 worktree，各跑各的，不在同一条里抢文件。
- 子 agent 跑完，主 Claude 先看 diff 再决定合不合，别让它一路改一路合。

## C 报告落盘

- 目录 `.specialist-agents/`，文件名 `<task-id>--<slice>.md`（无 slice 直接 `<task-id>.md`），内容是 markdown 自然语言报告。
- **首次调用前**补 `.gitignore`：`grep -qxF '.specialist-agents/' .gitignore || echo '.specialist-agents/' >> .gitignore`。报告是中间产物，不进 git。
- 失败报告首行写 `[FAILED] <原因>`，正常的不写。
- 任务归纳完按需清理：`rm -rf .specialist-agents/<task-id>*`（目录在 .gitignore 里，留着也不进 git，只占盘）。

## 并发

按并发数选 CLI：2–3 路 pi 重复跑（`&` + `wait`）；4–9 路 codebuddy；10+ 路 codebuddy 主力。**上限 10 路左右**，IOA 后端会限流；并发数由"能拆几片独立切片"定，不是越多越快。

切片三条（缺一就别拆，单跑走 A）：

1. **自洽**——每片单独看能闭环，不给"参考其他切片"。
2. **互不依赖**——A 片产出不被 B 片需要；要级联就串行。
3. **粒度看任务形状**，不看预计输出大小——deepseek 1M 够装，别为"输出可能长"提前切。

**起并发前必做**：列一份切片清单给用户看——每片编号（对应 session-id / 文件名）、做什么、走哪 CLI、哪模型、落到哪个文件。用户能据此拦下"这片不该拆"或"这条该升档"的误判。

落盘并发模板：

```bash
mkdir -p .specialist-agents
export CODEBUDDY_DISABLE_AUTO_MEMORY=1 CODEBUDDY_DISABLE_HOT_RELOAD=1 CODEBUDDY_SKIP_BUILTIN_MARKETPLACE=1
for f in <切片列表>; do
  codebuddy -p "<任务>" --model deepseek-v4-flash-ioa --session-id "<id>" \
    > ".specialist-agents/<id>.md" 2>&1 &
done
wait
```

`export` 一次后循环都继承三件套；下一段任务重新 `export`，别依赖残留。每片 `2>&1` 连 stderr 一起落盘，方便 debug；**不**把多路 stdout 串成一团——对不齐切片、读起来串戏。

汇总：主 Claude 先 `ls .specialist-agents/` 看齐不齐 → 挑 1–2 片 Read 看模式（别一上来全 Read，爆主 Claude 上下文）→ 决定全 Read，或起二级汇总子 agent：

```bash
pi -p "读 .specialist-agents/audit-*.md，做二级汇总：高频问题（≥3 次）单列、偶发但重要的归'重点关注'、各自独有的小毛病分组列" \
  --model deepseek/deepseek-v4-pro -ns -ne -np --thinking xhigh --name summarize-audits
```

## 上下文传入

- **一次性 prompt**（默认）：任务一句话讲得清、子 agent 自己 ls/Read 就能拿上下文。别把"读 X 文件"塞进 prompt，让它自己 `Read X`。
- **stdin pipe**：主 Claude 手里有大块文本（diff、测试输出、长日志、长文档）要喂下去。直接管道走过去，**别**先把 50KB 的 diff Read 进自己上下文再 echo。多 GB 级 pipe 也卡 → 写文件让子 agent 自己 Read。
- **报告落盘**：切片并发，或单跑也要存档 / 子 agent 边读边记中间笔记。

判不准 → 先按一次性 prompt 起一条试；输出爆量再切 stdin / 落盘。并发 ≥ 4 路必走落盘，别把每路结果都 stdout 拿回主 Claude。
