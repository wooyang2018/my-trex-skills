# Git 规范参考

完整的 Git 规范、工作流最佳实践与标准化提交格式指南。

---

## Conventional Commits

### 格式

```
<类型>[可选作用域]: <描述>

[可选正文]

[可选页脚]
```

### 提交类型

**主要类型：**
- **feat**：面向用户的新功能
- **fix**：面向用户的 Bug 修复
- **docs**：仅文档变更
- **style**：代码风格调整（格式化、缺少分号等）
- **refactor**：既不修复 Bug 也不新增功能的代码重构
- **perf**：性能优化
- **test**：新增或修正测试
- **build**：构建系统或依赖项变更
- **ci**：CI 配置文件和脚本变更
- **chore**：不修改 src 或 test 文件的其他变更
- **revert**：回滚之前的提交

### 示例

**简单提交：**
```bash
feat: 添加用户认证功能

基于 JWT 实现认证系统，支持 refresh token。
包含受保护路由的中间件。

Closes #123
```

**破坏性变更：**
```bash
feat!: 重新设计 API 响应格式

BREAKING CHANGE: API 现在返回 camelCase 而非 snake_case。
迁移指南见 docs/migration-v2.md。

Refs: #456
```

**带作用域：**
```bash
fix(auth): 修复 token 过期边界情况

token 校验现已正确处理时区偏移。
为 5 分钟宽限期内过期的 token 添加重试逻辑。
```

**多段落：**
```bash
refactor(database): 优化查询性能

- 为高频查询字段添加索引
- 实现连接池
- 用 Redis 缓存常见查询
- 减少用户关联中的 N+1 查询

生产环境测试性能提升 60%。

Reviewed-by: Jane Doe <jane@example.com>
Refs: #789
```

### 提交信息规则

1. **主题行：**
   - 使用祈使语气（"添加"而非"已添加"）
   - 首字母不大写
   - 不加句号
   - 最多 50 字符（软限制）
   - 与正文之间空一行

2. **正文：**
   - 每行 ≤ 72 字符
   - 解释做了什么以及为什么，而非怎么做
   - 多条内容用列表
   - 引用相关 Issue 和 PR

3. **页脚：**
   - 破坏性变更以 `BREAKING CHANGE:` 开头
   - 引用 Issue：`Closes #123`、`Fixes #456`、`Refs #789`
   - 联合作者：`Co-authored-by: Name <email>`

---

## 分支命名规范

### 格式

```
<类型>/<Issue 编号>-<简短描述>
```

### 分支类型

**常用前缀：**
- `feature/` 或 `feat/` — 新功能
- `fix/` 或 `bugfix/` — Bug 修复
- `hotfix/` — 紧急生产修复
- `release/` — 发布准备
- `docs/` — 文档更新
- `refactor/` — 代码重构
- `test/` — 测试新增或修正
- `chore/` — 维护任务
- `experimental/` 或 `spike/` — 概念验证

### 示例

```bash
# 功能分支
feature/123-user-authentication
feat/456-add-payment-gateway
feature/oauth-integration

# Bug 修复分支
fix/789-resolve-memory-leak
bugfix/login-redirect-loop
fix/456-null-pointer-exception

# 紧急修复分支
hotfix/critical-security-patch
hotfix/production-database-issue

# 发布分支
release/v1.2.0
release/2024-Q1

# 文档分支
docs/api-reference-update
docs/123-add-contributing-guide

# 重构分支
refactor/database-layer
refactor/456-simplify-auth-flow

# 实验性分支
experimental/graphql-api
spike/performance-optimization
```

### 分支命名规则

1. 单词间用**连字符**（不用下划线）
2. **全小写**（避免大写）
3. **简短但有描述性**（最多 50 字符）
4. 有 Issue 时**包含 Issue 编号**
5. **不使用特殊字符**（只允许连字符和正斜杠）
6. **不加尾部斜杠**
7. 团队内**保持一致**

---

## 受保护分支策略

### 主要分支

**main/master：**
- 随时可部署的生产就绪代码
- 受保护，需要 review
- 不允许直接提交
- 只能从 release 或 hotfix 分支合并

**develop：**
- 功能集成分支
- 预生产测试
- 受 CI 检查保护
- 功能分支的合并目标

**staging：**
- 预生产环境
- QA 测试分支
- 包含新功能的生产镜像

### 保护规则

```yaml
# GitHub 分支保护示例
main:
  require_pull_request_reviews:
    required_approving_review_count: 2
    dismiss_stale_reviews: true
    require_code_owner_reviews: true

  require_status_checks:
    strict: true
    contexts:
      - continuous-integration
      - code-quality
      - security-scan

  enforce_admins: true
  require_linear_history: true
  allow_force_pushes: false
  allow_deletions: false
```

---

## 语义化版本号

### 版本格式

```
MAJOR.MINOR.PATCH[-预发布标识][+构建元数据]
```

**示例：**
- `1.0.0` — 初始发布
- `1.2.3` — 含 patch 的小版本更新
- `2.0.0-alpha.1` — 预发布 alpha 版
- `1.5.0-rc.2+20240321` — 含构建元数据的 RC 版

### 版本升级规则

**MAJOR（X.0.0）：**
- 破坏性变更
- API 不兼容
- 大规模重新设计
- 移除已废弃功能

**MINOR（x.Y.0）：**
- 向后兼容的新功能
- 废弃功能（仍可用）
- 较大的内部变更

**PATCH（x.y.Z）：**
- Bug 修复
- 安全补丁
- 性能优化
- 文档更新

### Git Tag 管理

```bash
# 创建注释标签
git tag -a v1.2.3 -m "Release version 1.2.3

- 新增用户认证
- 修复缓存内存泄漏
- 改善 API 性能"

# 推送标签到远端
git push origin v1.2.3

# 推送所有标签
git push --tags

# 创建预发布标签
git tag -a v2.0.0-beta.1 -m "v2.0.0 Beta 版"

# 删除标签
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3
```

---

## 工作流模式

### Git Flow

**分支结构：**
- `main` — 生产发布
- `develop` — 下个版本开发
- `feature/*` — 新功能
- `release/*` — 发布准备
- `hotfix/*` — 紧急修复

**功能工作流：**
```bash
# 开始功能
git checkout develop
git pull origin develop
git checkout -b feature/123-new-feature

# 开发功能
git add .
git commit -m "feat: 实现用户认证"

# 完成功能
git checkout develop
git pull origin develop
git merge --no-ff feature/123-new-feature
git push origin develop
git branch -d feature/123-new-feature
```

**发布工作流：**
```bash
# 开始发布
git checkout develop
git checkout -b release/v1.2.0

# 准备发布（升级版本号、更新 changelog）
git commit -m "chore: 准备发布 v1.2.0"

# 合并到 main
git checkout main
git merge --no-ff release/v1.2.0
git tag -a v1.2.0 -m "Release v1.2.0"

# 合并回 develop
git checkout develop
git merge --no-ff release/v1.2.0

# 清理
git branch -d release/v1.2.0
```

**Hotfix 工作流：**
```bash
# 从 main 开始 hotfix
git checkout main
git checkout -b hotfix/critical-bug

# 修复并提交
git commit -m "fix: 修复严重安全漏洞"

# 合并到 main
git checkout main
git merge --no-ff hotfix/critical-bug
git tag -a v1.2.1 -m "Hotfix v1.2.1"

# 合并到 develop
git checkout develop
git merge --no-ff hotfix/critical-bug

# 清理
git branch -d hotfix/critical-bug
```

### GitHub Flow

**简化工作流：**
- `main` — 随时可部署
- `feature/*` — 所有变更都在功能分支

```bash
# 创建功能分支
git checkout -b feature/add-logging
git push -u origin feature/add-logging

# 提交变更
git commit -m "feat: 添加结构化日志"
git push origin feature/add-logging

# 在 GitHub 上发起 PR
# review 通过且 CI 绿色后合并到 main
# 从 main 部署
```

### 主干开发（Trunk-Based Development）

**单一主分支：**
- 短生命周期功能分支（< 2 天）
- 频繁集成到 main
- 未完成功能用 feature flag 隔离
- 持续集成

```bash
# 创建短生命周期分支
git checkout -b update-api-docs
git push -u origin update-api-docs

# 小步提交
git commit -m "docs: 更新 API 端点文档"
git push origin update-api-docs

# 当天发起 PR 并合并
# main 分支配合 feature flag 始终可部署
```

---

## PR 规范

### PR 标题格式

使用 Conventional Commits 格式：
```
feat(auth): 添加 OAuth2 提供商支持
fix(api): 修复限流边界情况
docs: 更新安装指南
```

### PR 描述模板

```markdown
## 摘要
变更内容及动机的简要说明。

## 变更内容
- 具体变更列表
- 架构决策参考
- 标注破坏性变更

## 测试
- 单元测试已新增/更新
- 集成测试通过
- 手动测试已完成

## 截图（如适用）
[UI 变更附截图]

## 相关 Issue
Closes #123
Refs #456

## 检查清单
- [ ] 测试已新增/更新
- [ ] 文档已更新
- [ ] CHANGELOG 已更新
- [ ] 破坏性变更已记录
- [ ] 代码已经团队 review
```

### Review 指南

**Reviewer 检查清单：**
- [ ] 代码符合风格指南
- [ ] 提交信息符合规范
- [ ] 测试覆盖充分
- [ ] 文档已更新
- [ ] 无安全漏洞
- [ ] 已考虑性能影响
- [ ] 破坏性变更有充分理由

---

## 变更日志管理

### Keep a Changelog 格式

```markdown
# Changelog

本文件记录项目所有值得关注的变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added
- 基于 JWT 的用户认证
- API 限流中间件

### Changed
- 更新数据库 schema 以提升性能

### Deprecated
- 旧认证接口（请改用 /api/v2/auth）

### Removed
- 移除旧版 XML API 支持

### Fixed
- 修复缓存层内存泄漏
- 修复并发请求中的竞态条件

### Security
- 修补 SQL 注入漏洞

## [1.2.0] - 2024-03-15

### Added
- 实时通知系统
- 用户资料自定义

### Fixed
- 修复登录重定向循环
- 修复 Session 超时处理
```

---

## 最佳实践

1. **频繁提交：** 小而聚焦的提交更易 review 和回滚
2. **写清晰的信息：** 未来的你会感谢现在的你
3. **每次提交只做一件事：** 每个提交应只解决一个逻辑问题
4. **提交前先测试：** 确保代码可用再提交
5. **引用 Issue：** 将提交与 Issue 追踪系统关联
6. **自审变更：** 提交前用 `git diff --staged` 检查
7. **保持历史整洁：** 对功能分支做 rebase 以保持线性历史
8. **签名提交：** 使用 GPG 签名做验证
9. **正确使用 .gitignore：** 绝不提交敏感或生成文件
10. **记录规范：** 将团队约定保存在仓库文档中

---

## 团队规模参考

### 小团队（2-5 人）

```
- 简化工作流
- 可直接提交到 main（配合 PR review）
- 大型变更使用功能分支
- 用标签管理发布
- 优先保持线性历史
```

### 中型团队（5-20 人）

```
- Git Flow 变体
- 保护 main 和 develop 分支
- 功能分支必须
- 版本用 release 分支
- 紧急情况用 hotfix 工作流
- squash merge 保持历史整洁
```

### 大型团队（20+ 人）

```
- 主干开发 + feature flag
- 保护 main 分支
- 极短生命周期功能分支
- 未完成工作用 feature flag
- 自动化测试和部署
- 每天多次集成
```
