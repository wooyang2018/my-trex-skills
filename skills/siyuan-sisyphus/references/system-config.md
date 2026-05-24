# 系统与配置

适用场景：首次接入、切换工作区、检查权限、查看版本/时间/思源配置、对照危险动作清单、按现象排错。

## 第一次接入

```bash
siyuan-sisyphus --version
siyuan-sisyphus config list
siyuan-sisyphus system get_version
siyuan-sisyphus system get_current_time
siyuan-sisyphus list
```

若鉴权缺失，新建或激活一个 profile：

```bash
siyuan-sisyphus init
siyuan-sisyphus config set default --url http://127.0.0.1:6806 --token "<token>"
siyuan-sisyphus config use default
siyuan-sisyphus config get default
```

只想覆盖单条命令时直接传 flag：

```bash
siyuan-sisyphus --url http://127.0.0.1:6806 --token "<token>" system get_version
siyuan-sisyphus --profile work notebook list
```

## 配置优先级

按优先级从高到低：

1. 命令行 flag：`--url`、`--token`、`--profile`
2. 环境变量：`SIYUAN_API_URL`、`SIYUAN_TOKEN`
3. 当前激活的 profile（`~/.siyuan-sisyphus/config.json`）
4. 默认 URL（通常 `http://127.0.0.1:6806`）

> 不要写脚本去修改 `~/.siyuan-sisyphus/config.json`，配置更改一律走 `config set/use`。token 不写进任何文档与 commit。

## 系统命令

```bash
siyuan-sisyphus system get_version
siyuan-sisyphus system get_current_time
siyuan-sisyphus system conf --mode summary
siyuan-sisyphus system conf --mode get --key-path "conf.appearance.mode"
siyuan-sisyphus system network
siyuan-sisyphus system notify --msg "任务完成" --level info --timeout 5000
```

`system workspace-info` 暴露绝对工作区路径，属于高风险接口，默认禁用，除非用户明确要求且了解风险。

`system conf` 返回的是脱敏配置，不会泄露原始密钥。

## 权限

```bash
siyuan-sisyphus notebook get_permissions
siyuan-sisyphus notebook get_permissions --notebook <notebookId>
```

权限取值：`rwd`（读写删）、`rw`（读写）、`r`（只读）、`none`（不可见）。CLI 默认对未配置的笔记本给 `r`。

修改权限属于高风险动作：

```bash
siyuan-sisyphus notebook set_permission --notebook <notebookId> --permission rw
```

执行前先记录当前权限，向用户复述目标后再执行。

## 危险动作清单

CLI 把"命令本身"视为执行确认。下表中的动作影响用户数据，执行前向用户复述目标并取得明确批准。

| 工具 | 动作 |
| --- | --- |
| `fs` | `rm`、`mv` |
| `notebook` | `remove`、`set_permission` |
| `document` | `move` |
| `block` | `move` |
| `search` | `find_replace` |
| `file` | `upload_asset`、`remove_unused_assets`、`delete_asset`、`export_resources --output-path` |
| `tag` | `remove` |
| `flashcard` | `remove_card` |
| `system` | `workspace-info` |

样板话术：

> 「准备执行 `<命令摘要>`，将影响 `<具体目标>`，是否继续？」

执行后做一次读回核对（`fs read` / `block get_kramdown` / `notebook get_permissions`）。

## 帮助系统

随时以 CLI 自身为准：

```bash
siyuan-sisyphus list
siyuan-sisyphus list <tool>
siyuan-sisyphus help <tool>
siyuan-sisyphus help <tool> <action>
```

> 注意：`siyuan-sisyphus help <tool> <action>` 中的 action 用 snake_case，例如 `help block set_attrs`、`help search query_sql`。

## 故障排查

| 现象 | 排查 |
| --- | --- |
| `connect refused` / 401 | `config list` 看 URL 与 token；用 `config set` / `config use` 重设 |
| 命令字段不确定 | `siyuan-sisyphus help <tool> <action>` |
| 看不见某些笔记本/结果 | `notebook get_permissions`，权限可能为 `r` 或 `none` |
| `permission_denied: delete access is required` | 笔记本权限只到 `rw`；`fs rm` / `document remove` / `fs mv` 跨权限边界都不可执行。停下来告知用户，由用户决定是否在思源端把权限放到 `rwd`，或换一个可删的笔记本 |
| 刚写的内容搜不到 | 思源索引最终一致；按路径/ID 直接读，或短暂等待重试 |
| 复杂嵌套字段失败 | 用 `--<field>-json '<合法 JSON>'` 旁路传值 |
| `block update` 多行内容被截断 | 改 `block append` / `block insert` / `fs write` |

> Agent 不得自行 `notebook set_permission` 提权来绕过删除限制——`set_permission` 本身就是高危动作。提权是用户的决策。
