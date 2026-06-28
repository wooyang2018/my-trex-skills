---
name: project-init
description: 当用户说「初始化新项目」「一键初始化」「新项目需要哪些配置文件」，或单独说「创建 .gitignore」「生成 gitignore」「添加 gitignore」「更新 .gitignore」「生成 editorconfig」「创建 .editorconfig」「统一缩进风格」「添加 license」「生成 LICENSE」「选择开源许可证」「生成 .env.example」「创建环境变量模板」「整理环境变量」时，使用此 skill。覆盖新项目初始化的四类配置文件：.gitignore、.editorconfig、LICENSE、.env.example。
allowed-tools: Read, Write, Edit, Grep, Bash
---

# project-init Skill

为新项目生成四类标准配置文件：`.gitignore`、`.editorconfig`、`LICENSE`、`.env.example`。可一次性初始化全套，也可单独生成其中任意一个。

> gitignore 官方模板见 `templates/`（[github/gitignore](https://github.com/github/gitignore) subtree），许可证官方文本见 `licenses/_licenses/`（[github/choosealicense.com](https://github.com/github/choosealicense.com) subtree）。

---

## 全套初始化流程

用户要求「初始化项目」时，按以下顺序执行，每步完成后报告进度：

```
1. 检测技术栈（后续各步共用）
2. 生成 .gitignore
3. 生成 .editorconfig
4. 生成 LICENSE
5. 生成 .env.example
6. 输出初始化摘要
```

**处理已有文件**：检测到目标文件已存在时，询问「跳过 / 覆盖 / 合并」，不要静默覆盖。

**第 1 步——检测技术栈**，在所有文件生成之前执行一次：

```bash
ls package.json pyproject.toml go.mod Cargo.toml pom.xml build.gradle Gemfile composer.json 2>/dev/null
git config user.name
git config user.email
```

记录：主要语言/框架、git 用户信息（供 LICENSE 使用）、已存在的配置文件。

**第 6 步——初始化摘要**，所有文件生成后输出：

```
✅ 初始化完成

已生成文件：
  .gitignore       — Node + macOS 模板
  .editorconfig    — 2 空格缩进（JS/TS）
  LICENSE          — MIT，2026，[作者名]
  .env.example     — 扫描到 8 个环境变量

建议的后续步骤：
  □ 在 README 中添加 License badge
  □ 将 .env.example 中的变量填入本地 .env
  □ 提交：git add . && git commit -m "chore: init project configuration"
```

---

## .gitignore

检测项目根目录的指示性文件，从 `templates/` 读取对应模板合成 `.gitignore`。

**技术栈 → 模板路径对照：**

| 检测到的文件 | 模板路径 |
|---|---|
| `package.json` | `templates/Node.gitignore` |
| `package.json` + `next.config.*` | `templates/Node.gitignore`、`templates/community/JavaScript/NextJS.gitignore` |
| `requirements.txt` / `pyproject.toml` / `setup.py` | `templates/Python.gitignore` |
| `go.mod` | `templates/Go.gitignore` |
| `Cargo.toml` | `templates/Rust.gitignore` |
| `pom.xml` | `templates/Java.gitignore` |
| `build.gradle` | `templates/Java.gitignore`、`templates/Gradle.gitignore` |
| `*.xcodeproj` / `*.xcworkspace` | `templates/Swift.gitignore` |
| `composer.json` | `templates/PHP.gitignore` |
| `Gemfile` | `templates/Ruby.gitignore` |
| macOS 系统 | `templates/Global/macOS.gitignore`（始终添加） |

用 `Read` 工具读取各模板文件，按以下顺序合成：
1. 操作系统（macOS / Linux / Windows）
2. 编辑器 / IDE（`.idea/`、`.vscode/` 等，可检测时添加）
3. 语言 / 运行时
4. 框架
5. 自定义规则区块

每个区块清晰标注来源：
```gitignore
# ============================================================
# [模板名称] — github.com/github/gitignore
# ============================================================
```

**合并已有文件**：提取不属于标准模板的行作为自定义规则，保留在底部 `# 自定义` 区块，永不删除。

**规则**：禁止 curl 拉取——只读 `templates/` 下的文件。更新模板：
```bash
git subtree pull --prefix=plugins/project-craft/skills/project-init/templates https://github.com/github/gitignore.git main --squash
```

---

## .editorconfig

根据技术栈选择缩进风格，生成 `.editorconfig`。

**缩进规则：**

| 检测到 | 缩进 |
|---|---|
| `package.json`（JS/TS） | 2 空格 |
| `pyproject.toml` / `setup.py` | 4 空格（PEP 8） |
| `go.mod` | tab（gofmt 规范） |
| `Cargo.toml` | 4 空格 |
| `pom.xml` / `build.gradle` | 4 空格 |
| `Gemfile` | 2 空格 |
| 无法判断 | 询问用户 |

标准结构：

```ini
# EditorConfig — https://editorconfig.org
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{js,jsx,ts,tsx,json,yaml,yml,css,html}]
indent_style = space
indent_size = 2

[*.py]
indent_style = space
indent_size = 4

[*.go]
indent_style = tab
indent_size = 4

[Makefile]
indent_style = tab

[*.md]
trim_trailing_whitespace = false
```

只添加检测到的语言对应的 section；`Makefile` 和 `*.md` 的规则始终包含。

---

## LICENSE

引导用户选择许可证，写入 `LICENSE` 文件（无扩展名，GitHub 可自动识别）。

**作者信息**：优先从 `git config user.name` 读取，读取不到则询问用户。

**推荐逻辑：**

| 场景 | 推荐 |
|---|---|
| 个人开源、希望最大传播 | **MIT** |
| 希望衍生作品也必须开源 | **GPL-3.0** |
| 库/框架，允许商业使用但须署名 | **Apache-2.0** |
| 库，允许商业使用，衍生改动须开源 | **LGPL-2.1** |
| 完全公共领域 | **Unlicense** |

若用户已明确指定（如「MIT」），跳过推荐直接生成。

从 `licenses/_licenses/<spdx-id>.txt` 读取对应文件（YAML frontmatter + 许可证正文），提取 `---` 之后的正文部分，替换占位符：

- `[year]` → `date +%Y` 的输出
- `[fullname]` → 作者姓名

常用文件名对照：

| 许可证 | 文件路径 |
|---|---|
| MIT | `licenses/_licenses/mit.txt` |
| Apache 2.0 | `licenses/_licenses/apache-2.0.txt` |
| GPL 3.0 | `licenses/_licenses/gpl-3.0.txt` |
| LGPL 2.1 | `licenses/_licenses/lgpl-2.1.txt` |
| Unlicense | `licenses/_licenses/unlicense.txt` |
| AGPL 3.0 | `licenses/_licenses/agpl-3.0.txt` |
| MPL 2.0 | `licenses/_licenses/mpl-2.0.txt` |

更新许可证数据：
```bash
git subtree pull --prefix=plugins/project-craft/skills/project-init/licenses https://github.com/github/choosealicense.com.git gh-pages --squash
```

---

## .env.example

扫描源码中的环境变量引用，生成带注释的 `.env.example`。

**扫描命令：**

```bash
# Node.js / TypeScript
grep -r "process\.env\." --include="*.{js,ts,jsx,tsx,mjs}" -h . \
  | grep -oP 'process\.env\.\K[A-Z_][A-Z0-9_]*' | sort -u

# Python
grep -r "os\.environ\|os\.getenv" --include="*.py" -h . \
  | grep -oP '(?:environ\[|getenv\()["\x27]\K[A-Z_][A-Z0-9_]*' | sort -u

# Go
grep -r 'os\.Getenv' --include="*.go" -h . \
  | grep -oP 'os\.Getenv\("\K[A-Z_][A-Z0-9_]*' | sort -u
```

**分组规则：**

| 变量名含 | 分组 |
|---|---|
| `DB_` / `DATABASE_` / `POSTGRES_` / `MYSQL_` | 数据库 |
| `JWT_` / `SESSION_` / `AUTH_` / `SECRET_` / `TOKEN_` | 认证 |
| `SMTP_` / `MAIL_` / `EMAIL_` | 邮件 |
| `AWS_` / `S3_` / `GCS_` | 云存储 |
| 其余 | 应用配置 |

**合并已有文件**：新扫描到的变量追加到底部并标注 `# 新增`，不覆盖已有条目。

**安全检查**：写入后提示变量名含 `SECRET`、`KEY`、`PASSWORD` 的条目，确认值已留空。

**确认 .gitignore 排除 .env**：
```bash
grep -E '^\.env$|^\.env\.local$|^\.env\*' .gitignore 2>/dev/null
```
未排除时提示用户，或经同意后自动追加。
