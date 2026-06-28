# 变更日志自动化参考

从提交、PR 和发布记录中自动生成变更日志的工具配置与模式，遵循 Keep a Changelog 格式和语义化版本规范。

---

## 核心概念

### 1. Keep a Changelog 格式

```markdown
# Changelog

本文件记录项目所有值得关注的变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added
- 新功能 X

## [1.2.0] - 2024-01-15

### Added
- 用户头像
- 深色模式支持

### Changed
- 加载性能提升 40%

### Deprecated
- 旧版认证 API（请改用 v2）

### Removed
- 移除旧版支付网关

### Fixed
- 修复登录超时问题 (#123)

### Security
- 更新依赖以修复 CVE-2024-1234

[Unreleased]: https://github.com/user/repo/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/user/repo/compare/v1.1.0...v1.2.0
```

### 2. Conventional Commits

```
<类型>[可选作用域]: <描述>

[可选正文]

[可选页脚]
```

| 类型 | 说明 | 变更日志章节 |
|---|---|---|
| `feat` | 新功能 | Added |
| `fix` | Bug 修复 | Fixed |
| `docs` | 文档 | （通常排除） |
| `style` | 格式化 | （通常排除） |
| `refactor` | 代码重构 | Changed |
| `perf` | 性能优化 | Changed |
| `test` | 测试 | （通常排除） |
| `chore` | 维护 | （通常排除） |
| `ci` | CI 变更 | （通常排除） |
| `build` | 构建系统 | （通常排除） |
| `revert` | 回滚提交 | Removed |

### 3. 语义化版本

```
MAJOR.MINOR.PATCH

MAJOR：破坏性变更（feat! 或 BREAKING CHANGE）
MINOR：新功能（feat）
PATCH：Bug 修复（fix）
```

---

## 工具配置

### 方案一：Conventional Changelog（Node.js）

```bash
# 安装工具
npm install -D @commitlint/cli @commitlint/config-conventional
npm install -D husky
npm install -D standard-version
# 或
npm install -D semantic-release

# 配置 commitlint
cat > commitlint.config.js << 'EOF'
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat','fix','docs','style','refactor','perf','test','chore','ci','build','revert'],
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-max-length': [2, 'always', 72],
  },
};
EOF

# 配置 husky
npx husky init
echo "npx --no -- commitlint --edit \$1" > .husky/commit-msg
```

### 方案二：standard-version

```javascript
// .versionrc.js
module.exports = {
  types: [
    { type: "feat", section: "新功能" },
    { type: "fix", section: "Bug 修复" },
    { type: "perf", section: "性能优化" },
    { type: "revert", section: "回滚" },
    { type: "docs", section: "文档", hidden: true },
    { type: "style", section: "样式", hidden: true },
    { type: "chore", section: "杂项", hidden: true },
    { type: "refactor", section: "代码重构", hidden: true },
    { type: "test", section: "测试", hidden: true },
    { type: "build", section: "构建系统", hidden: true },
    { type: "ci", section: "CI/CD", hidden: true },
  ],
  commitUrlFormat: "{{host}}/{{owner}}/{{repository}}/commit/{{hash}}",
  compareUrlFormat: "{{host}}/{{owner}}/{{repository}}/compare/{{previousTag}}...{{currentTag}}",
  issueUrlFormat: "{{host}}/{{owner}}/{{repository}}/issues/{{id}}",
  releaseCommitMessageFormat: "chore(release): {{currentTag}}",
};
```

```json
// package.json scripts
{
  "scripts": {
    "release": "standard-version",
    "release:minor": "standard-version --release-as minor",
    "release:major": "standard-version --release-as major",
    "release:patch": "standard-version --release-as patch",
    "release:dry": "standard-version --dry-run"
  }
}
```

### 方案三：semantic-release（完全自动化）

```javascript
// release.config.js
module.exports = {
  branches: [
    "main",
    { name: "beta", prerelease: true },
    { name: "alpha", prerelease: true },
  ],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md" }],
    ["@semantic-release/npm", { npmPublish: true }],
    ["@semantic-release/github", { assets: ["dist/**/*.js", "dist/**/*.css"] }],
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};
```

### 方案四：GitHub Actions 工作流

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      release_type:
        description: "发布类型"
        required: true
        default: "patch"
        type: choice
        options: [patch, minor, major]

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - name: 配置 Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: 运行 semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: npx semantic-release

  # 备选：手动发布（使用 standard-version）
  manual-release:
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - run: npm ci

      - name: 配置 Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: 升级版本号并生成 changelog
        run: npx standard-version --release-as ${{ inputs.release_type }}

      - name: 推送变更
        run: git push --follow-tags origin main

      - name: 创建 GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          body_path: RELEASE_NOTES.md
          generate_release_notes: true
```

### 方案五：git-cliff（Rust，速度快）

```toml
# cliff.toml
[changelog]
header = """
# Changelog

本文件记录项目所有值得关注的变更。

"""
body = """
{% if version %}\
    ## [{{ version | trim_start_matches(pat="v") }}] - {{ timestamp | date(format="%Y-%m-%d") }}
{% else %}\
    ## [Unreleased]
{% endif %}\
{% for group, commits in commits | group_by(attribute="group") %}
    ### {{ group | upper_first }}
    {% for commit in commits %}
        - {% if commit.scope %}**{{ commit.scope }}:** {% endif %}\
            {{ commit.message | upper_first }}\
            {% if commit.github.pr_number %} ([#{{ commit.github.pr_number }}](https://github.com/owner/repo/pull/{{ commit.github.pr_number }})){% endif %}\
    {% endfor %}
{% endfor %}
"""
trim = true

[git]
conventional_commits = true
filter_unconventional = true
commit_parsers = [
    { message = "^feat", group = "新功能" },
    { message = "^fix", group = "Bug 修复" },
    { message = "^doc", group = "文档" },
    { message = "^perf", group = "性能优化" },
    { message = "^refactor", group = "代码重构" },
    { message = "^test", group = "测试" },
    { message = "^chore\\(release\\)", skip = true },
    { message = "^chore", group = "杂项" },
]
tag_pattern = "v[0-9]*"
sort_commits = "oldest"
```

```bash
# 生成 changelog
git cliff -o CHANGELOG.md

# 指定范围生成
git cliff v1.0.0..v2.0.0 -o RELEASE_NOTES.md

# 预览不写入
git cliff --unreleased --dry-run
```

### 方案六：Python（commitizen）

```toml
# pyproject.toml
[tool.commitizen]
name = "cz_conventional_commits"
version = "1.0.0"
version_files = [
    "pyproject.toml:version",
    "src/__init__.py:__version__",
]
tag_format = "v$version"
update_changelog_on_bump = true
changelog_incremental = true
changelog_start_rev = "v0.1.0"

[tool.commitizen.customize]
bump_pattern = "^(feat|fix|perf|refactor)"
bump_map = {"feat" = "MINOR", "fix" = "PATCH", "perf" = "PATCH", "refactor" = "PATCH"}
```

```bash
# 安装
pip install commitizen

# 交互式创建提交
cz commit

# 升级版本并更新 changelog
cz bump --changelog

# 检查提交格式
cz check --rev-range HEAD~5..HEAD
```

---

## Release Notes 模板

### GitHub Release 模板

```markdown
## 变更内容

### 🚀 新功能
- <功能描述> by @<作者> in #<PR>

### 🐛 Bug 修复
- <修复描述> by @<作者> in #<PR>

### 📚 文档
- <文档更新描述> by @<作者> in #<PR>

### 🔧 维护
- <维护变更描述> by @<作者> in #<PR>

## 新贡献者
- @<用户名> 首次贡献，见 #<PR>

**完整变更记录**：https://github.com/owner/repo/compare/v<上个版本>...v<当前版本>
```

### 内部 Release Notes 模板

```markdown
# Release v2.1.0 - 2024-01-15

## 摘要

本次发布引入深色模式支持，结账性能提升 40%，并包含重要安全更新。

## 亮点

### 🌙 深色模式
用户可在设置中切换深色模式，偏好自动保存并跨设备同步。

### ⚡ 性能
- 结账流程速度提升 40%
- Bundle 体积减少 15%

## 破坏性变更
本次发布无破坏性变更。

## 升级指南
无需特殊步骤，按标准部署流程操作。

## 已知问题
- 深色模式首次加载时可能闪烁（修复计划于 v2.1.1）

## 依赖更新

| 包名 | 旧版本 | 新版本 | 原因 |
|---|---|---|---|
| react | 18.2.0 | 18.3.0 | 性能优化 |
| lodash | 4.17.20 | 4.17.21 | 安全补丁 |
```

---

## 最佳实践

**应该做：**
- 遵循 Conventional Commits — 支撑自动化
- 写清晰的提交信息 — 未来的你会感谢
- 引用 Issue — 将提交与工单关联
- 统一使用作用域 — 团队约定好规范
- 自动化发布 — 减少人为错误

**不应该做：**
- 不要在一个提交中混入多个变更
- 不要跳过 commitlint 校验
- 不要手动编辑自动生成的 changelog
- 不要漏掉破坏性变更标记（用 `!` 或页脚）
- 不要忽略 CI 流水线
