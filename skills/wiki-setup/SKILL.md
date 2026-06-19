---
name: wiki-setup
description: >
  初始化具有正确结构、特殊文档和配置的新思源 wiki 笔记本，并管理多个笔记本配置之间的切换。
  当用户想从零设置新 wiki、创建新笔记本、配置 .env，或说"设置我的 wiki"、"初始化我的笔记本"、
  "创建新 wiki"、"开始使用 wiki"时使用。也在用户需要重新配置现有笔记本、修复损坏的设置，
  或说"切换到我的工作 wiki"、"切换笔记本"、"列出我的 wiki"、"显示我的笔记本"时使用。
  支持子命令：setup（默认）、switch <名称>、list、show [名称]、new <名称>。
---

# wiki-setup — 思源笔记本初始化 + 多笔记本管理

你正在设置一个新的思源 wiki（或修复现有的），或管理多个笔记本配置之间的切换。所有写入都通过 `siyuan-sisyphus` 进行；切勿直接在磁盘上操作思源工作区。

## 分发

解析调用并路由：

| 调用 | 操作 |
|---|---|
| `/wiki-setup` 或无参数 | → **设置**（初始化/修复笔记本结构） |
| `/wiki-setup switch <名称>` 或"切换笔记本" | → **切换配置** |
| `/wiki-setup list` 或"列出我的 wiki" | → **列表配置** |
| `/wiki-setup show [名称]` 或"显示我的笔记本" | → **显示配置** |
| `/wiki-setup new <名称>` 或"创建新笔记本配置" | → **新建配置** |

## 步骤 0：预检

在做任何事之前：

1. 按 `llm-wiki/SKILL.md` 中的配置解析协议解析配置。从 CWD 向上查找 `.env`，回退到 `~/.siyuan-wiki/config`。如果都不存在，你将在步骤 1 中创建 `.env`。
2. 运行预检（仅当 `SIYUAN_PRECHECK=false` 时跳过）：

   ```
   siyuan-sisyphus --version
   siyuan-sisyphus notebook list --json
   ```

3. 如果任一命令失败，**停止**并告诉用户："siyuan-sisyphus 不可达。请运行 `siyuan-sisyphus init`（或 `siyuan-sisyphus config list`）配置一个 profile，然后重新运行 wiki-setup。"不要尝试任何文件系统回退。

步骤 2 中返回的笔记本 JSON 列表是接下来两步的权威来源。**捕获每个笔记本的 `id` 和 `name`**——你需要 id 来消歧同名笔记本并填充 `.env` 中的 `SIYUAN_NOTEBOOK_ID`。这是框架中 `notebook list --json` 优于 `notebook get-permissions` 的一个地方，因为在这个阶段我们可能还不知道目标笔记本 id。

## 步骤 1：创建或更新 .env

如果 `.env` 不存在，将 `.env.example` 复制为 `.env`。然后逐个询问用户并将答案写入 `.env`。两个笔记本变量是必需的，必须一起写入：

1. **哪个思源笔记本应该承载 wiki？** → 询问笔记本名称（如 `my-knowledge-base`），然后从步骤 0 的 JSON 中解析出 id。
   - 向用户展示完整笔记本列表（id + 名称），让他们选择现有的，或输入新名称来创建。
   - 按精确名称匹配过滤列表。**如果恰好一个匹配**，捕获其 `id` 并将 `SIYUAN_NOTEBOOK_NAME` 和 `SIYUAN_NOTEBOOK_ID` 都写入 `.env`。**如果多个匹配**（同名重复），展示重复项及其 id，让用户选择一个；写入两个变量。**如果没有匹配**，标记为"在步骤 2 中创建"，推迟 id 写入直到 `notebook create` 返回它。
   - id 是除 `fs *` 之外所有 CLI 命令使用的（`--notebook`、`query_sql ... WHERE box=`、`document lookup`、`notebook get-permissions`）。名称仅用于 `fs *` 工作区路径。技能**不得**在运行时从一个推导另一个——两者都直接来自 `.env`。

2. **你的源文档在哪里？** → `SIYUAN_SOURCES_DIR`
   - 文件系统路径，逗号分隔。源仍从本地文件系统读取；只有 wiki 本身存在于思源中。
   - 默认：空（跳过——用户以后可以指向特定文件）。

3. **要导入 Claude 历史吗？** → `CLAUDE_HISTORY_PATH`
   - 默认：从 `~/.claude` 自动发现。
   - 如果 Claude 数据在其他地方，显式设置。

4. **Token 预算警告阈值？** → `WIKI_TOKEN_WARN_THRESHOLD`
   - 默认：`100000`（当全笔记本读取成本超过 100K tokens 时警告）。
   - 设为 `0` 禁用。`wiki-status` 显示 token 占用表并自动发出此警告。

5. **启用暂存写入？** → `WIKI_STAGED_WRITES`
   - 默认：未设置 / `false`（页面直接写入最终 hpath）。
   - 为团队 wiki、高风险领域或任何需要人工对每个 LLM 写入的页面有最终决定权的笔记本设为 `true`。
   - 启用后，所有新建/更新的页面先进入 `/<notebook>/_staging/<category>/`；运行 `/wiki-stage-commit` 审查并提升它们。

同时将相同的 `SIYUAN_NOTEBOOK_ID`、`SIYUAN_NOTEBOOK_NAME` 和 `SIYUAN_WIKI_REPO` 写入 `~/.siyuan-wiki/config`，使跨项目技能（`wiki-update` / `wiki-query`）能从任何地方工作。

## 步骤 2：确保笔记本存在

使用步骤 0 的 JSON 列表按名称查找目标笔记本（大小写敏感精确匹配）：

- **如果恰好一个匹配**，捕获其 `id` 并将 `SIYUAN_NOTEBOOK_ID` + `SIYUAN_NOTEBOOK_NAME` 写入 `.env`（和 `~/.siyuan-wiki/config`）。然后通过 `notebook get-permissions --notebook "<id>"` 验证访问级别。完整功能需要 `rwd` 权限。如果缺少 `d`（`rw`），警告用户破坏性技能（`wiki-lint`、`wiki-rebuild`、`cross-linker` 的 `find_replace`）将拒绝运行，直到他们授予删除权限。如果只有 `r`，停止——连 `wiki-setup` 本身也需要写权限。

- **如果多个匹配**（同名重复），展示重复项及其 id，让用户选择一个。在他们决定后写入 ID + NAME。

- **如果没有匹配**，明确询问："笔记本 `<name>` 不存在。需要我创建吗？"如果同意：

  ```
  siyuan-sisyphus notebook create --name "<SIYUAN_NOTEBOOK_NAME>"
  ```

  CLI 在输出中返回新 id；捕获它并立即将 `SIYUAN_NOTEBOOK_ID` 和 `SIYUAN_NOTEBOOK_NAME` 写入 `.env` 和 `~/.siyuan-wiki/config`。新创建的笔记本可能有短暂的索引延迟（几秒），之后 `document lookup` 和 `query_sql` 才能看到写入其中的文档——本技能的其余部分通过每次写入后立即按路径读取而非搜索来容忍这种延迟。

  **硬性阻塞——需要手动提升权限**（根据 `llm-wiki/SKILL.md` §13 校准说明 10）。新创建的笔记本返回权限 `r`（只读）。`notebook create` 成功，但紧接着的 `fs write` 会报权限错误，直到人工打开思源桌面 UI，右键笔记本，授予 `rwd`。没有 CLI 可提升权限。运行 `notebook create` 后，本技能必须：

  1. 验证新权限级别：`siyuan-sisyphus notebook get-permissions --id "<new-id>"`。
  2. 如果结果不是 `rwd`，**停止并逐字提示人工**：
     > 笔记本 `<name>` 已创建（id `<new-id>`），但其权限为 `<r|rw>`。请打开思源桌面 UI，在侧边栏右键该笔记本，选择"权限"，将其设为 `rwd`（读 + 写 + 删除）。然后回复"可以了" / "ok"，我继续。
  3. 等待肯定回复，然后重新运行 `notebook get-permissions` 确认 `rwd` 后再继续步骤 3。在等待期间**不要**静默重试写入——如果用户在授予权限前回复，骨架创建会中途失败并需要手动清理。

不要静默创建笔记本——始终确认。

## 步骤 3：创建子树骨架

`siyuan-sisyphus fs write` **一次创建一个文档**；它不会自动创建缺失的父文档。当 `/X/Y` 不存在时写入 `/X/Y/Z` 会返回：

```
✗ [internal_error] Parent document not found at "/X/Y".
```

因此骨架必须深度优先种子化：先父文档，再下面的任何子文档。在思源中，像 `concepts` 这样的类别本身就是一个文档——没有单独的"文件夹"概念。直接写入 `/<notebook>/concepts` 创建类别文档，并为后续的 `wiki-ingest` 运行提供父文档来写入子文档。

对 `SIYUAN_CATEGORIES` 中的每个 `cat`（默认：`concepts,entities,skills,references,synthesis,journal`）：

```
siyuan-sisyphus fs write \
  --path "/<SIYUAN_NOTEBOOK_NAME>/<cat>" \
  --markdown "# <Cat>\n\n*Pages in this category will be listed by wiki-ingest.*\n"
```

这一次写入创建类别文档。不需要 `_index` 子文档——类别文档本身扮演这个角色。后续的 `wiki-ingest` 运行在它下面写入 `/<notebook>/<cat>/<page-slug>`；第二级写入成功是因为父文档现在已存在。

同样地种子化特殊子树（每个名称一个文档，此阶段不需要子文档）：

```
siyuan-sisyphus fs write --path "/<SIYUAN_NOTEBOOK_NAME>/projects"  --markdown "# Projects\n"
siyuan-sisyphus fs write --path "/<SIYUAN_NOTEBOOK_NAME>/_archives" --markdown "# Archives\n"
siyuan-sisyphus fs write --path "/<SIYUAN_NOTEBOOK_NAME>/_raw"      --markdown "# Raw / Staging Inbox\n\n*Drop rough notes via fs write into this subtree; the next wiki-ingest run will promote them.*\n"
siyuan-sisyphus fs write --path "/<SIYUAN_NOTEBOOK_NAME>/_staging"  --markdown "# Staging\n\n*Review queue for LLM-written pages when WIKI_STAGED_WRITES=true. Promote via /wiki-stage-commit.*\n"
siyuan-sisyphus fs write --path "/<SIYUAN_NOTEBOOK_NAME>/_meta"     --markdown "# Meta\n"
```

如果类别文档已存在，`fs write`（不带 `--overwrite`）拒绝覆盖它——因此该调用可安全重跑：现有类别保持不变，新类别被添加。检测"已存在"错误并将其视为成功。

## 步骤 4：创建特殊文档

### `/<notebook>/index`

```
siyuan-sisyphus fs write --path "/<SIYUAN_NOTEBOOK_NAME>/index" --overwrite --markdown "$(cat <<'EOF'
---
title: Wiki Index
---

# Wiki Index

*This index is automatically maintained. Last updated: <TIMESTAMP>*

## Concepts

*No pages yet. Use `wiki-ingest` to add your first source.*

## Entities

## Skills

## References

## Synthesis

## Journal
EOF
)"
```

### `/<notebook>/log`

```
siyuan-sisyphus fs write --path "/<SIYUAN_NOTEBOOK_NAME>/log" --overwrite --markdown "$(cat <<'EOF'
---
title: Wiki Log
---

# Wiki Log

- [<TIMESTAMP>] INIT notebook="<SIYUAN_NOTEBOOK_NAME>" categories=concepts,entities,skills,references,synthesis,journal
EOF
)"
```

### `/<notebook>/hot`

```
siyuan-sisyphus fs write --path "/<SIYUAN_NOTEBOOK_NAME>/hot" --overwrite --markdown "$(cat <<'EOF'
---
title: Hot Cache
updated: <TIMESTAMP>
---

# Hot Cache

*A ~500-word semantic snapshot of recent activity. Updated after every major write operation.*

## Recent Activity

- [<TIMESTAMP>] INIT — notebook `<SIYUAN_NOTEBOOK_NAME>` initialized

## Active Threads

*None yet — start ingesting sources to populate.*

## Key Takeaways

*None yet.*

## Flagged Contradictions

*None yet.*
EOF
)"
```

### `/<notebook>/_meta/manifest`

manifest 正文是包裹在围栏代码块中的 JSON，使其既可在思源中人工检查，又可被其他技能机器解析。初始内容：

````
siyuan-sisyphus fs write --path "/<SIYUAN_NOTEBOOK_NAME>/_meta/manifest" --overwrite --markdown '# Manifest

```json
{
  "version": 1,
  "notebook": "<SIYUAN_NOTEBOOK_NAME>",
  "created": "<TIMESTAMP>",
  "sources": {},
  "_meta": {
    "cached_doc_ids": {}
  }
}
```
'
````

写入后，查找并缓存 `/index`、`/log`、`/hot` 和 `/_meta/manifest` 的文档 id：

```
siyuan-sisyphus document lookup --notebook "<SIYUAN_NOTEBOOK_ID>" --hpath "/log"
…
```

更新 `/_meta/manifest` 使 `_meta.cached_doc_ids` 看起来像 `{"log": "<id>", "index": "<id>", "hot": "<id>", "manifest": "<id>"}`。这省去了后续每次摄取的 `document lookup` 调用。

### `/<notebook>/_meta/taxonomy`

```
siyuan-sisyphus fs write --path "/<SIYUAN_NOTEBOOK_NAME>/_meta/taxonomy" --overwrite --markdown "# Taxonomy\n\n*Controlled tag vocabulary. Owned by tag-taxonomy skill.*\n"
```

## 步骤 5：将 Frontmatter 镜像到自定义属性

对 `index`、`log`、`hot`、`manifest`，运行：

```
siyuan-sisyphus block set-attrs \
  --id <doc-id> \
  --attrs '{"custom-title":"<title>","custom-system":"true","custom-updated":"<TIMESTAMP>"}'
```

`custom-system=true` 让 `wiki-status` 和 `wiki-lint` 将这些从页面计数和新鲜度检查中排除。

## 步骤 6：验证设置

通过 `siyuan-sisyphus` 运行健全性检查：

- [ ] `siyuan-sisyphus notebook list --json` 包含 `<SIYUAN_NOTEBOOK_NAME>`。
- [ ] 对每个特殊文档（`index`、`log`、`hot`、`_meta/manifest`、`_meta/taxonomy`）：

  ```
  siyuan-sisyphus document lookup --notebook "<SIYUAN_NOTEBOOK_ID>" --hpath "/<doc>"
  ```

  返回一个文档 id。
- [ ] 对每个类别（`concepts`、`entities`、`skills`、`references`、`synthesis`、`journal`、`projects`、`_archives`、`_raw`、`_staging`）：

  ```
  siyuan-sisyphus search query_sql --stmt "SELECT id, hpath FROM blocks WHERE type='d' AND box='<SIYUAN_NOTEBOOK_ID>' AND hpath LIKE '/<cat>/%' LIMIT 1"
  ```

  返回至少一行（`_index` 占位符）。
- [ ] `.env` 同时设置了 `SIYUAN_NOTEBOOK_ID` 和 `SIYUAN_NOTEBOOK_NAME`（如果两者都存在，值与 `~/.siyuan-wiki/config` 匹配）。
- [ ] `SIYUAN_SOURCES_DIR` 中的源目录（如果有）存在且在本地文件系统上可读。

报告结果并告诉用户他们现在可以：

1. 打开思源并切换到新笔记本以确认结构。
2. 运行 `wiki-status` 查看可摄取的内容。
3. 运行 `wiki-ingest` 添加他们的第一批来源。
4. 运行 `claude-history-ingest` 挖掘 Claude 对话。
6. 随时再次运行 `wiki-status` 检查增量。

## 与 obsidian-wiki 的区别

- 没有 `mkdir` 和 `.obsidian/` 目录——思源没有 vault 配置目录，笔记本级外观在思源客户端内配置。
- 没有 QMD 设置——思源原生的 `search fulltext` 和 `search query_sql` 取代了它。
- `_index` 占位文档是有意的。它们在每个类别根处给思源一个真实文档，使后续在该类别下的 `fs write` 路径能干净地解析，而不会混淆父文档是文件夹还是叶文档。

---

## 多笔记本配置管理

每个配置是 `~/.siyuan-wiki/config.<名称>` 处的完整配置文件。活跃配置是 `~/.siyuan-wiki/config` 符号链接指向的文件。切换配置意味着重新指向该符号链接——它改变跨项目技能（`wiki-ingest` / `wiki-retrieval` 等）回退到全局配置时解析的 `SIYUAN_NOTEBOOK_ID` + `SIYUAN_NOTEBOOK_NAME`。

一个配置文件包含：
- `SIYUAN_NOTEBOOK_ID`（不可变 id 如 `20241205084226-rl6jd3a`）——唯一明确的笔记本键
- `SIYUAN_NOTEBOOK_NAME`（人类标签）——用于 `fs *` 工作区路径和显示
- `SIYUAN_WIKI_REPO`——此 fork 克隆位置
- 可选的每配置 `SIYUAN_PROFILE`（`siyuan-sisyphus` 配置名称；当每个笔记本位于不同思源工作区且有各自 API key 时有用）
- 可选的每配置 `SIYUAN_SOURCES_DIR`、`WIKI_TOKEN_WARN_THRESHOLD`、`WIKI_STAGED_WRITES` 等

### 切换配置（`switch`）

激活一个命名配置。

1. 验证 `~/.siyuan-wiki/config.<名称>` 存在。如不存在，告知用户配置不存在并列出可用项（运行**列表**）。
2. 重新指向符号链接：

   ```bash
   ln -sf ~/.siyuan-wiki/config.<名称> ~/.siyuan-wiki/config
   ```

3. 从新激活的配置读取 `SIYUAN_NOTEBOOK_ID` 和 `SIYUAN_NOTEBOOK_NAME`（两者必须存在——如果任一缺失或为空则中止并给出明确错误）。
4. 运行快速健全性检查，确认笔记本仍存在且可达：

   ```bash
   siyuan-sisyphus notebook get-permissions --notebook "<SIYUAN_NOTEBOOK_ID>"
   ```

   如果失败，原样呈现 CLI 错误。最常见原因：(a) 用户指向的 `siyuan-sisyphus` 配置的 API 看不到此笔记本（修复：在此配置文件中设置 `SIYUAN_PROFILE`），或 (b) 笔记本 id 在思源 UI 中被删除（修复：编辑配置或重建笔记本）。
5. 向用户确认：

   ```
   已切换到配置：<名称>
   笔记本 id：      <SIYUAN_NOTEBOOK_ID>
   笔记本名称：     <SIYUAN_NOTEBOOK_NAME>
   权限：           <rwd | rw | r>
   ```

   如果权限为 `rw` 或 `r`，也注明哪些技能会停止（写入类技能需要 `rwd`）。

### 列表配置（`list`）

显示所有已注册配置及哪个是活跃的。

1. 查找所有匹配 `~/.siyuan-wiki/config.*` 的文件（排除 `config` 本身——那是符号链接）。
2. 解析当前符号链接目标：`readlink ~/.siyuan-wiki/config`
3. 对每个配置文件，读取第一个非空注释行（`#` 前缀）作为人类描述。如无注释则回退到文件后缀作为标签。同时提取 `SIYUAN_NOTEBOOK_NAME` 用于显示。
4. 显示：

   ```
   配置：
     personal   我的个人研究 wiki    (笔记本：模型代理)        ← 活跃
     work       工作项目 wiki        (笔记本：work-knowledge)
   ```

   用 `← 活跃` 标记活跃的。如果符号链接断裂或 `config` 不存在，显示 `(无活跃配置)`。

### 显示配置（`show`）

打印配置的完整内容。

- 如给定名称，读取 `~/.siyuan-wiki/config.<名称>`。
- 如未给定名称，读取 `~/.siyuan-wiki/config`（活跃配置）。
- 如文件不存在，告知用户并列出可用项。
- 原样打印文件内容，做两处脱敏：
  - 任何包含 `API_KEY`、`SECRET` 或 `TOKEN` 的行——显示 `***` 代替值。
  - `SIYUAN_NOTEBOOK_ID` 视为非机密——它是用户思源实例内的公共 id。

### 新建配置（`new`）

以活跃配置为模板脚手架新配置。

1. 检查 `~/.siyuan-wiki/config.<名称>` 不已存在。如已存在则中止。
2. 复制活跃配置：

   ```bash
   cp ~/.siyuan-wiki/config ~/.siyuan-wiki/config.<名称>
   ```

3. 读取复制的配置。配置文件使用 `# --- 节名称 ---` 注释头来分组字段。按如下方式处理各节：
   - 标注为"Notebook-specific"、"Notebook"、"Paths"或类似的节中的字段 → 向用户询问新值。**`SIYUAN_NOTEBOOK_ID` 和 `SIYUAN_NOTEBOOK_NAME` 都必须重新询问**——新配置指向不同笔记本。
   - 标注为"Notebook-independent"、"Global"、"Shared"的节中的字段 → 保持原样。
   - 标注为"Secrets"的节中的字段 → 询问新配置是否使用相同凭据。如不同，提示输入新值。
   - 如无节头，展示所有字段让用户决定。
4. 解析新笔记本 id：
   - 向用户询问目标笔记本的**名称**。
   - 运行 `siyuan-sisyphus notebook list --json` 并解析。按精确名称匹配过滤。
   - 如恰好一个匹配，将其 id 写入 `SIYUAN_NOTEBOOK_ID`，名称写入 `SIYUAN_NOTEBOOK_NAME`。
   - 如多个匹配（同名复用），展示重复项及其 id，让用户选择一个。
   - 如无匹配，询问是否现在通过 `siyuan-sisyphus notebook create --name "<名称>"` 创建笔记本。如同意，捕获返回的 id 并写入两个变量。
5. 将更新后的值写入 `~/.siyuan-wiki/config.<名称>`。
6. 更新顶部注释行描述新配置。
7. 确认并告知用户运行 `/wiki-setup switch <名称>` 激活它，然后运行 `/wiki-setup` 初始化笔记本结构。不要自动切换——让用户决定何时激活。
