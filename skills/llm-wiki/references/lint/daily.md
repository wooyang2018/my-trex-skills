# Wiki Lint — 日常更新 + 状态审计

> 本文件涵盖定期维护和增量状态检查。前置步骤见 `shared.md`。
> 洞察分析见 `insights.md`；审计检查见 `audit.md`。

## 目录

- [日常更新 — Wiki 维护周期](#日常更新--wiki-维护周期)
- [状态审计 — 增量与完整性](#状态审计--增量与完整性)

---

## 日常更新 — Wiki 维护周期

**触发**："日常更新"/"定期维护"。轻量维护遍历。**写入类**，需要 `rwd` 权限。

### 笔记本作用域状态目录

```bash
STATE_DIR="$HOME/.siyuan-wiki/state/<SIYUAN_NOTEBOOK_ID>"
mkdir -p "$STATE_DIR"
```

### 步骤

1. **来源新鲜度检查** — 比较 manifest 中每个来源的文件修改时间：
   - 新鲜（mtime ≤ ingested_at）
   - 过期（mtime > ingested_at）
   - 缺失（文件不再存在）

2. **索引刷新** — 读取 `/<notebook>/index`，通过 `query_sql` 枚举笔记本页面并核对，更新不一致项。

3. **hot 页更新** — 如超过 48 小时，读取最近修改的 10 个 wiki 页面并写入约 500 字语义快照。

4. **写入状态文件**：
   ```bash
   date +%s > "$STATE_DIR/.last_update"
   echo "<stale_count>" > "$STATE_DIR/.pending_delta"
   ```

5. **日志** — 按 `shared.md` 格式追加：`LINT mode=daily-update fresh=N stale=N missing=N index_added=N hot_refreshed=true|false`

6. **报告** — 来源状态、索引状态、hot 页状态、过期来源列表。

### 定时任务设置

首次设置时：验证脚本存在 → 检测 OS 选择调度器（macOS launchd / Linux systemd / cron 回退）→ 安装定时调度器（每天 09:00）→ 可选安装终端通知 → 运行一次初始化。

完成后按 `shared.md` 更新跟踪文件。

---

## 状态审计 — 增量与完整性

**触发**："状态如何"/"wiki 状态"。计算 wiki 当前状态：什么已摄取、什么待处理、增量如何。**只读**模式 — `r`/`rw`/`rwd` 任一均可。

### 步骤

1. **扫描当前来源** — Glob `SIYUAN_SOURCES_DIR` 中的文档、`CLAUDE_HISTORY_PATH` 中的 Claude 历史、manifest 中记录的其他来源。

2. **计算增量** — 比较当前来源与 manifest：
   - 新（磁盘有，manifest 无）
   - 已修改（hash 不同）
   - 已触碰（mtime 新但 hash 同）
   - 未变
   - 已删除

3. **报告状态**：
   - 概览：总页面、可见性统计、已摄取来源数
   - 增量表：新来源、已修改来源
   - Token 占用估算

4. **下一步建议**（按优先级排序）：
   1. 暂存待处理
   2. _raw 待处理
   3. 过期核心页面
   4. 孤立页面
   5. 综合机会
   6. 新/已修改来源
   7. Lint 问题

   空状态输出：`✅ Wiki 健康——无紧急事项。`

完成后按 `shared.md` 日志格式追加：`LINT mode=status pages_scanned=N new_sources=N modified_sources=N pending_delta=N`。
