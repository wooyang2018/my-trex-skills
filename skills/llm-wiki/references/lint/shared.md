# Wiki Lint — 共享操作

> 本文件定义所有 lint 模式共用的操作原型。各模式文件按需引用，避免重复定义。
> 存储宪法和 CLI 原语详见 `references/constitution.md`。

## 目录

- [前置步骤 — 所有模式的统一入口](#前置步骤--所有模式的统一入口)
- [构建页面注册表](#构建页面注册表)
- [日志写入](#日志写入)
- [跟踪文件更新](#跟踪文件更新)
- [安全协议](#安全协议)
- [通用提示](#通用提示)

---

## 前置步骤 — 所有模式的统一入口

**每个 lint 模式开始前必须执行：**

1. **解析配置 + 预检** — 遵循 `references/constitution.md` 中的配置解析协议。从 CWD 向上查找 `.env` → `~/.siyuan-wiki/config` → 提示设置。获取 `SIYUAN_NOTEBOOK_ID`（用于 `--notebook` 和 `query_sql ... WHERE box=`）、`SIYUAN_NOTEBOOK_NAME`（用于 `fs *` 路径）。
2. **权限检查** — `siyuan-sisyphus --version` 和 `siyuan-sisyphus notebook get-permissions --notebook "<SIYUAN_NOTEBOOK_ID>"`。只读模式需 `r`/`rw`/`rwd` 任一；写入模式需 `rwd`。缺少权限则停止。
3. **读取索引** — `fs read --path "/<SIYUAN_NOTEBOOK_NAME>/index"` 了解当前 wiki 内容。
4. **读取 manifest** — `fs read --path "/<SIYUAN_NOTEBOOK_NAME>/_meta/manifest"` 了解已摄取来源。

## 构建页面注册表

所有 lint 模式的数据基础。单次 SQL 拉取全部文档元数据：

```
siyuan-sisyphus search query_sql --stmt "
  SELECT id, hpath, name, ial FROM blocks
  WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>'
  LIMIT 1000
"
```

> **注意**：根据 `references/constitution.md` §13 说明 8，`hpath NOT LIKE '/_%'` 会被思源权限层静默过滤。拉取完整列表后**在客户端过滤** `/_` 前缀子树（`/_archives/`、`/_staging/`、`/_raw/`、`/_meta/`）。

对每行从 `ial` 解析必要字段：`custom-title`、`custom-tags`、`custom-tier`、`custom-created`、`custom-updated`、`custom-lifecycle`、`custom-base-confidence`、`custom-aliases`、`custom-relationships`、`custom-category`、`custom-redirects-to`。

需要 doc-id 时，通过 `block get-attrs --id <doc-id>` 补充获取 `custom-*` 属性。

## 日志写入

所有写入类模式完成后，统一通过 `block append` 追加到 `/<notebook>/log`：

```
siyuan-sisyphus block append --parent-id <log-doc-id> --data-type markdown \
  --data "- [<TIMESTAMP>] LINT mode=<mode> pages_scanned=N <mode-specific-fields>"
```

**日志前缀统一为 `LINT`**，各模式在 `<mode-specific-fields>` 中自由追加字段。

模式名称常量：`audit`、`consolidate`、`daily-update`、`status`、`dedup`、`crosslink`、`tag-audit`、`tag-normalize`、`colorize`、`insights`。

## 跟踪文件更新

写入类模式造成页面变更时，按顺序更新以下跟踪文件：

1. **热缓存** — 更新 `/<notebook>/hot` 的近期活动（约 500 词语义快照）
2. **索引** — 从新鲜注册表查询重建 `/<notebook>/index`
3. **Manifest** — 如有来源或结构变更，更新 `/_meta/manifest`
4. **日志** — 追加 LINT 日志行（见上节）

**写入顺序铁律**：manifest 写入**延迟到**页面、索引、日志、热缓存全部成功后——崩溃不会留下 manifest 声称不存在/已变更的页面。

## 安全协议

所有写入类 lint 模式遵循统一安全流程：

### 通用原则

- **先审计，始终。** 即使在自动修复模式下也先运行完整审计/检测。
- **写入前展示试运行。** 以结构化列表打印计划操作，等待用户确认。
- **不要自动合并页面。** 合并是去重模式的专属职责，其他模式只链接、提升、降级和标注。
- **不要触碰 `/_archives/`、`/_staging/`、`/_raw/`、`/_meta/`。** 这些在客户端过滤（见注册表构建注意事项）。
- **危险操作（`fs rm`、`fs mv`、`document move`、`block move`）需用一句话复述影响并取得明确批准。**

### 写入确认模板

```
计划操作（共 N 个）：
[1] <操作描述>
[2] <操作描述>
...

应用这 N 个更改？[yes / no / select by number]
```

### 权限矩阵

| 模式类型 | 最低权限 |
|---|---|
| 只读（审计、状态审计、洞察分析） | `r` / `rw` / `rwd` 任一 |
| 写入（Consolidate、日常更新、去重、交叉链接、标签规范化、着色） | `rwd` |

## 通用提示

- **反向链接来自 `get_backlinks`，而非 vault 范围 grep。** 这是 lint 在思源 wiki 上快速的单一最大原因——索引由服务器维护。
- **索引是最终一致的。** `fs write` 后，验证写入用 `fs read` 或 `document lookup`，不要信 `search fulltext`。
- **链接语法：** 思源不解析 `[[wikilink]]` markdown。唯一产生图谱边的语法是 `((<doc-id> "display text"))`。
- **最终一致性注意事项：** `search fulltext` 可能短暂错过在同一运行中写入的内容。验证刚写入的内容时用 `fs read` 而非搜索。
- **保守操作：** `fs replace` 和 `fs write --overwrite` 覆盖正文编辑；`block set-attrs` 覆盖属性编辑。
- **跳过小笔记本：** 页面少于 10 个时跳过对循环或图谱计算。> 500 页面时分批处理（50 个一批）。
