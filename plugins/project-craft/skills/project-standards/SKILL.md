---
name: project-standards
description: 当用户需要「编写提交信息」「更新 CHANGELOG」「修改 README」「准备发布」「确认版本号」「新增功能后更新文档」「检查破坏性变更」时，使用此 skill。自主维护项目文档规范的四个维度：提交信息（Conventional Commits）、变更日志（Keep a Changelog）、README（与代码同步）、语义化版本号（SemVer）。触发场景：新功能、Bug 修复、依赖变更、API 变更、项目结构调整、发布准备。
allowed-tools: Read, Write, Edit, Grep, Bash
---

# 项目规范 Skill

统一维护项目文档规范的 Skill，覆盖四个维度：**提交规范**、**变更日志**、**README**、**版本号**。这四个方面紧密联动——规范的提交信息驱动变更日志，变更日志决定版本号，README 反映最终结果。

> 详细参考资料见同目录 `references/` 下的文件。

---

## 文档语言规则

生成或更新任何项目文档（提交信息、CHANGELOG 条目、README 内容）时，**语言跟随用户当前对话语言**：

- 用户用**中文**交流 → 文档内容写**中文**
- 用户用**英文**交流 → 文档内容写**英文**
- 用户用**其他语言**交流 → 文档内容使用该语言
- 用户**显式指定语言**（如"用英文写"、"write in English"）→ 以指定语言为准，优先级最高

**代码、命令、技术标识符**（commit type、tag 名、变量名等）始终保持英文，不受语言规则影响。

示例：
```bash
# 用户说中文 → commit message 写中文
feat(auth): 添加 Google OAuth2 登录支持

# 用户说英文 → commit message 写英文
feat(auth): add Google OAuth2 login support

# 但 type、scope 始终英文，无论哪种语言
```

---

## 触发时机

| 场景 | 触发的动作 |
|---|---|
| 编写或审查提交信息 | 执行 Conventional Commits 格式规范 |
| 新增功能 / 修复 Bug | 建议在 CHANGELOG `[Unreleased]` 添加条目 + 更新 README |
| 变更依赖 | 更新 README 安装说明 / 环境变量章节 |
| 修改 API、路由或配置 | 更新 README 使用说明 / 配置章节 |
| 准备发布 | 确定版本号（SemVer）、将 `[Unreleased]` 提升为版本块、打 Tag |
| 检测到破坏性变更 | 在提交 footer 标记 `BREAKING CHANGE`、升 MAJOR、添加迁移说明 |
| 架构或目录结构调整 | 更新 README 架构章节 |

---

## 一、提交规范（Conventional Commits）

### 格式

```
<类型>[可选作用域]: <描述>

[可选正文]

[可选页脚]
```

### 类型 → 变更日志映射

| 类型 | 变更日志章节 | 版本影响 |
|---|---|---|
| `feat` | Added（新增） | MINOR 升级 |
| `fix` | Fixed（修复） | PATCH 升级 |
| `perf` | Changed（变更） | PATCH 升级 |
| `refactor` | Changed（变更） | —（默认隐藏） |
| `docs` | — | —（隐藏） |
| `style` | — | —（隐藏） |
| `test` | — | —（隐藏） |
| `chore` | — | —（隐藏） |
| `ci` | — | —（隐藏） |
| `build` | — | —（隐藏） |
| `revert` | Removed（移除） | PATCH 升级 |
| `feat!` / `BREAKING CHANGE` | **Breaking Changes（破坏性变更）** | **MAJOR 升级** |

### 规则

- 主题行：祈使语气，首字母不大写，不加句号，≤ 50 字符
- 正文：每行 ≤ 72 字符，解释*做了什么*和*为什么*（而非*怎么做的*）
- 页脚：`Closes #N`、`Fixes #N`、`BREAKING CHANGE: <描述>`

### 示例

```bash
# 新功能
feat(auth): 添加 Google OAuth2 登录支持

# Bug 修复（含 Issue 引用）
fix(checkout): 修复支付处理中的竞态条件

Closes #123

# 破坏性变更
feat(api)!: 修改用户接口响应格式

BREAKING CHANGE: 接口现在返回 `userId` 而非 `id`。
迁移方式：更新所有 API 调用方，使用新字段名。

# 依赖 / 工具链
chore(deps): 升级 React 至 18.3.0
```

### 分支命名

```
<类型>/<Issue 编号>-<简短描述>

feature/123-user-auth
fix/456-null-pointer
hotfix/critical-security-patch
release/v2.1.0
docs/update-api-reference
```

规则：只用连字符、全小写、≤ 50 字符、有 Issue 时必须带编号。

---

## 二、变更日志（Keep a Changelog）

### 格式

```markdown
# Changelog

本文件记录项目所有值得关注的变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added（新增）
- <feat 提交摘要>

### Changed（变更）
- <perf / refactor 提交摘要>

### Fixed（修复）
- <fix 提交摘要>

### Removed（移除）
- <revert / 删除功能摘要>

### Security（安全）
- <安全补丁说明>

## [1.2.0] - 2025-05-17

### Added
- 新增基于 JWT 的用户认证

### Fixed
- 修复缓存层内存泄漏

[Unreleased]: https://github.com/owner/repo/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/owner/repo/compare/v1.1.0...v1.2.0
```

### 维护规则

1. 每次 `feat` / `fix` / `perf` 提交都要在 `[Unreleased]` 下添加对应条目
2. 条目使用**用户可理解的语言**——禁止出现类名、文件路径或内部术语
3. 按**用户影响**排序（破坏性变更优先），而非提交时间顺序
4. **发布时**：将 `[Unreleased]` 重命名为 `[X.Y.Z] - 今日日期`，在文末添加比较链接，新建空的 `[Unreleased]` 块
5. `docs` / `chore` / `test` / `ci` 提交**不写入** CHANGELOG

### 自动检测逻辑

检测到以下 `git diff` 或文件变化时，自动建议添加 CHANGELOG 条目：

- `src/features/`、`app/`、`routes/`、`api/` 下有新文件 → `### Added`
- 业务逻辑文件被修改 → `### Changed`
- 提交信息含 Bug 修复关键词或 Issue 引用 → `### Fixed`
- 公开 API 或导出被删除 → `### Removed`
- 提及安全通告或 CVE → `### Security`

---

## 三、README（与代码同步）

### 变更 → 章节映射

| 代码变更 | 需更新的 README 章节 |
|---|---|
| `package.json` 新增依赖 | 安装说明、环境变量 |
| 新增路由 / 接口 | 使用说明 / API 参考 |
| `.env.example` 变更 | 配置 / 环境变量 |
| `docker-compose.yml` 变更 | 开发环境搭建 |
| 新增功能文件 | 功能特性列表 |
| 架构重构 | 架构说明章节 |
| 破坏性 API 变更 | 使用说明 / 迁移指南 |

### 更新原则

- **保留**现有的 emoji 风格、标题层级、语气和格式
- **补充**缺失章节（前置依赖、环境变量、测试方法）
- **更新**版本号、Node/运行时要求、命令语法
- **同步** README 顶部的"最新变更"摘要块与 CHANGELOG 内容
- 不修改与本次变更无关的章节

### README 基础结构

```markdown
# 项目名称
> 一句话描述

[徽标：CI、覆盖率、版本]

## 功能特性
- 特性 1
- 特性 2

## 安装

```bash
npm install
```

## 使用

```javascript
// 最简示例
```

## 配置

| 变量 | 必填 | 说明 |
|---|---|---|
| `API_KEY` | 是 | ... |

## 开发

```bash
npm run dev
```

## 贡献指南
...

## 许可证
MIT
```

---

## 四、语义化版本号

### 规则

```
MAJOR.MINOR.PATCH

MAJOR — 破坏性变更（feat! 或 BREAKING CHANGE 页脚）
MINOR — 向后兼容的新功能（feat）
PATCH — Bug 修复、性能优化、安全补丁（fix、perf）
```

### 决策树

```
有新提交待发布？
├── 包含破坏性变更？  → 升 MAJOR，MINOR 和 PATCH 归零
├── 包含 feat？       → 升 MINOR，PATCH 归零
└── 只有 fix/perf？   → 升 PATCH
```

### 发布检查清单

```bash
# 1. 确认 [Unreleased] 条目已全部补齐
# 2. 根据上方决策树确定版本号
# 3. 将 CHANGELOG.md 中的 [Unreleased] 改为 [X.Y.Z] - <今日日期>
# 4. 在 CHANGELOG.md 底部添加比较链接
# 5. 更新 package.json / pyproject.toml 等文件中的版本字段
# 6. 提交：chore(release): vX.Y.Z
# 7. 打标签：git tag -a vX.Y.Z -m "Release vX.Y.Z"
# 8. 推送：git push --follow-tags origin main
```

### 预发布标签

```
2.0.0-alpha.1   — 早期不稳定版
2.0.0-beta.2    — 功能完整，修复阶段
2.0.0-rc.1      — 发布候选版
```

---

## 五、集成发布工作流

当用户说「准备发布」或「发布新版本」时，按以下步骤执行：

1. **审查提交** — `git log <上一个 tag>..HEAD --oneline`
2. **分类提交** → 判断 MAJOR / MINOR / PATCH
3. **起草 CHANGELOG 块** — 提升 `[Unreleased]`，填入发布日期
4. **更新版本号** — 修改 manifest 文件
5. **更新 README** — 升级版本徽标、运行时要求、「最新变更」摘要块
6. **提交** — `chore(release): vX.Y.Z`
7. **打 Tag** — 使用注释标签
8. **输出摘要** — 供 PR / GitHub Release 描述使用

---

## 最佳实践

- **每次提交只包含一个逻辑变更** — 使变更日志生成更可靠
- **像写变更日志一样写提交信息** — 主题行就是变更日志条目
- **不要手动编辑自动生成的变更日志** — 让提交驱动内容
- **功能和 README 在同一个 PR 中更新** — 文档永远不滞后于代码
- **每个提交都引用 Issue** — `Closes #N` 保证可追溯性
- **Release Tag 使用 GPG 签名** — 保证发布的可验证性

---

## 参考资料

详细规范和工具配置（commitlint、standard-version、semantic-release、git-cliff、commitizen、GitHub Actions）见同目录 `references/`：

- `references/git-conventions.md` — 完整分支策略、PR 模板、团队工作流
- `references/changelog-automation.md` — Node/Python/Rust/GitHub Actions 工具配置
- `references/readme-updater.md` — README 模板与自动检测逻辑详解
