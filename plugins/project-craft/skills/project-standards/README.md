# Project Standards

自主维护项目文档规范的统一 Skill，覆盖提交规范、变更日志、README 同步和语义化版本号四个维度。

## 功能特性

- **提交规范**：执行 Conventional Commits 格式，type/scope/描述/footer 完整校验
- **变更日志**：检测代码变更，自动建议 `[Unreleased]` 条目；发布时一键提升为版本块
- **README 同步**：监听依赖、路由、配置、功能文件的变化，映射到对应 README 章节
- **语义化版本**：根据提交类型自动判断 MAJOR/MINOR/PATCH，输出完整发布检查清单
- **语言自适应**：文档语言跟随用户对话语言，代码标识符始终保持英文

## 目录结构

```
skills/project-standards/
├── SKILL.md                          # 主 skill 文件
└── references/
    ├── git-conventions.md            # 完整分支策略、PR 模板、团队工作流
    ├── changelog-automation.md       # 工具配置（commitlint/semantic-release/git-cliff 等）
    └── readme-updater.md             # README 模板与自动检测逻辑
```

## 触发时机

| 场景 | 触发动作 |
|---|---|
| 编写或审查提交信息 | 执行 Conventional Commits 格式规范 |
| 新增功能 / 修复 Bug | 建议 CHANGELOG 条目 + README 更新 |
| 变更依赖 | 更新 README 安装说明 / 环境变量 |
| 修改 API、路由或配置 | 更新 README 使用说明 / 配置章节 |
| 准备发布 | 确定版本号、提升 CHANGELOG、打 Tag |
| 破坏性变更 | 标记 BREAKING CHANGE、升 MAJOR、添加迁移说明 |

## 安装

```bash
npx skills-installer add @okarinhuang/agent-plugins/project-standards
```
