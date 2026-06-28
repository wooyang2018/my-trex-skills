# go-dev

Go 开发技能集插件，面向惯用 Go 编程、CLI 应用架构与规格文档审查。

## Skills

| Skill | 说明 |
|-------|------|
| `go` | 惯用 Go 编程模式 — 包设计、错误处理、接口、并发、测试、项目布局。由 spf13 编写。 |
| `cobra-viper` | Cobra & Viper CLI 架构 — 命令优先设计、配置管理、环境变量绑定、内存测试。 |
| `go-spec-reviewer` | Go 设计规格文档审查 — 在实现前验证 spec 的完整性、一致性和惯用性。 |

## 来源

Skills 源自 [spf13/go-skills](https://github.com/spf13/go-skills)，涵盖 Go 团队前负责人、Cobra/Viper/Hugo/Afero 作者的最佳实践。

## Claude Code 安装

将此插件目录添加到 Claude Code 的插件路径即可使用：

```bash
claude --plugin-dir /path/to/go-dev
```

## Codex 安装

从仓库根目录注册 marketplace：

```bash
codex plugin marketplace add /path/to/agent-plugins
```

然后在 Codex app 的插件页启用 `go-dev`。
