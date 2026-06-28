---
name: cobra-viper
description: >-
  Applies to ANY Cobra/Viper CLI build, review, or refactoring —
  even simple commands with 1-2 flags. Do not skip based on perceived simplicity.
  Triggers: creating CLI commands, adding flags, binding env vars, designing
  command hierarchy, fixing Viper config issues.
  This skill catches mistakes LLMs consistently make in Cobra/Viper:
  business logic inside RunE, Viper state leaks between tests, broken
  flag-to-viper bindings, env vars not picked up, missing persistent flags,
  non-idiomatic command structure.
---

# Go CLI 架构：Cobra & Viper

使用 Cobra 和 Viper 构建健壮的、配置驱动的命令行界面的惯用模式与最佳实践。

## 何时激活

- 用 Go 编写新的 CLI 应用
- 向现有 Cobra 应用添加命令、子命令或标志
- 集成 Viper 进行配置文件、环境变量或标志管理
- 审查或重构使用 Cobra 和/或 Viper 的 CLI 代码
- 为 CLI 工具设计命令结构或配置 schema
- 测试 CLI 命令

## 核心哲学

### 命令优先架构

将你的应用二进制文件视为命令路由器。CLI 框架（Cobra）应仅处理标志、参数和路由。你的核心业务逻辑应完全不知道 CLI 层的存在，使其高度可测试和可复用。

### 统一配置

配置应该是环境感知的和统一的。Viper 充当单一事实来源，在传递给应用逻辑之前将默认值、配置文件、环境变量和命令行标志合并为统一状态。

## 快速参考

| 场景 | 做法 |
|------|------|
| 错误处理 | `RunE` 而非 `Run`，错误向上传播 |
| 全局设置 | `PersistentPreRunE` on root |
| 标志作用域 | `PersistentFlags` = 全局继承, `Flags` = 仅本命令 |
| 配置读取 | `viper.Unmarshal(&cfg)` 反序列化到类型化结构体 |
| 环境变量 | `SetEnvPrefix` + `AutomaticEnv` + `SetEnvKeyReplacer` |
| 测试方式 | 内存中 `cmd.SetArgs` + `cmd.Execute()`，测试间 `viper.Reset()` |
| 命令深度 | 最多两层（`app cmd subcmd`），三层令用户困惑 |
| 业务逻辑 | 核心逻辑包**绝不**导入 cobra/viper |

## CLI 包组织

**反模式：** 把所有命令和核心逻辑深藏在 `internal/` 目录树中，或把所有东西塞进 `main.go`。

### 可发现的扁平结构

命令路由和业务逻辑应该存放在标准的、逻辑命名的包中。`cmd/` 包处理 CLI 表面积，其他顶层包处理领域逻辑。

```
mycli/
├── main.go               # 最小入口点：严格只调用 cmd.Execute()
├── cmd/                  # Cobra 路由层
│   ├── root.go           # 基础命令、全局标志和 Viper 设置
│   ├── serve.go          # 'serve' 子命令
│   └── build.go          # 'build' 子命令
├── engine/               # 核心业务逻辑（以你的领域命名）
│   ├── server.go
│   └── compiler.go
├── go.mod
└── go.sum
```

`main.go` 故意保持最小：

```go
package main

import "github.com/spf13/myapp/cmd"

func main() {
    cmd.Execute()
}
```

### 将命令与执行解耦

`cmd/` 包中的文件应该恰好做三件事：

1. 定义 Cobra 命令、它的别名和帮助文本。
2. 为该特定命令绑定 Viper 标志和配置。
3. 调用核心逻辑包（如 `engine`）中的函数，传入解析后的配置和命令上下文。

你的核心逻辑（`engine` 包）应该**绝对不**从 `github.com/spf13/cobra` 或 `github.com/spf13/viper` 导入任何东西。

## Cobra 最佳实践

### 1. 使用 `RunE` 实现原生错误处理

避免 `Run`。如果命令失败，使用 `RunE` 将错误向上传递到执行链。这允许根命令优雅一致地处理错误，而不是依赖分散的 `log.Fatal` 调用（它们会绕过 `defer` 语句）。

```go
// 惯用：返回错误由执行器处理
var serverCmd = &cobra.Command{
    Use:   "server",
    Short: "Starts the primary application server",
    RunE: func(cmd *cobra.Command, args []string) error {
        server := engine.NewServer()
        if err := server.Start(); err != nil {
            return fmt.Errorf("server failure: %w", err)
        }
        return nil
    },
}
```

### 2. 应用错误时静默使用说明

默认情况下，Cobra 在返回错误时打印完整帮助文本。如果错误是运行时失败（如网络超时）而非语法错误，这会令人困惑。

```go
// 在 cmd/root.go 中
rootCmd := &cobra.Command{
    Use:           "mycli",
    SilenceUsage:  true, // 运行时错误不打印帮助
    SilenceErrors: true, // 让 main.go 处理错误打印
}
```

### 3. 上下文感知命令

现代 Go 严重依赖 `context.Context` 进行取消和超时。将 Cobra 命令的上下文直接传递给你的业务逻辑。此上下文自动监听操作系统终止信号（如 `SIGINT` 或 `Ctrl+C`）。

```go
RunE: func(cmd *cobra.Command, args []string) error {
    // 向下传递上下文以实现优雅关闭
    return engine.Process(cmd.Context(), args)
}
```

### 4. `PersistentPreRunE` 用于共享设置

在根命令上使用 `PersistentPreRunE`，在标志解析后、任何子命令运行前执行设置（日志、配置验证）：

```go
rootCmd = &cobra.Command{
    Use:               "myapp",
    PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
        // 此时读取 viper 值是安全的 —— 标志 + 配置 + 环境变量都已合并
        return setupLogger(viper.GetString("log-level"))
    },
}
```

Cobra 自动为每个子命令运行 `PersistentPreRunE`。如果子命令也定义了 `PersistentPreRunE`，你必须显式调用父级的 —— Cobra 不会自动链接它们。

### 5. 标志设计

```go
// 持久标志 —— 被所有子命令继承
rootCmd.PersistentFlags().String("config", "", "config file path")
rootCmd.PersistentFlags().Bool("verbose", false, "enable verbose output")

// 本地标志 —— 仅用于此命令
serveCmd.Flags().String("addr", ":8080", "listen address")

// 必需标志 —— Cobra 在 RunE 调用前验证
serveCmd.Flags().String("name", "", "required name")
serveCmd.MarkFlagRequired("name")

// 互斥标志
serveCmd.MarkFlagsMutuallyExclusive("json", "yaml")
```

- 使用 `PersistentFlags` 处理跨切面关注点（配置、详细程度、输出格式）。
- 使用 `Flags` 处理命令特定选项。
- 始终为常用选项提供短标志（`-v`、`-o`）。

### 6. Shell 补全

Cobra 免费生成 shell 补全：

```go
// 标志的自定义补全
serveCmd.RegisterFlagCompletionFunc("output", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
    return []string{"json", "yaml", "table"}, cobra.ShellCompDirectiveNoFileComp
})
```

```bash
myapp completion bash        > /etc/bash_completion.d/myapp
myapp completion zsh         > "${fpath[1]}/_myapp"
myapp completion fish        > ~/.config/fish/completions/myapp.fish
myapp completion powershell  | Out-File -Encoding utf8 "$PROFILE\myapp.ps1"
```

## Viper 配置模式

### 1. 反序列化到类型化结构体

**反模式：** 在业务逻辑深处调用 `viper.GetString("database.host")`。这将你的领域与 Viper 紧耦合，并在代码中散布魔法字符串。

相反，定义一个强类型配置结构体，在路由层（`cmd/`）将 Viper 的状态反序列化到其中，然后向下传递该结构体。

```go
type Config struct {
    Host string `mapstructure:"host"`
    Port int    `mapstructure:"port"`
}

func initConfig() (*Config, error) {
    var cfg Config
    if err := viper.Unmarshal(&cfg); err != nil {
        return nil, fmt.Errorf("unable to decode config: %w", err)
    }
    return &cfg, nil
}
```

### 2. 绑定层次

Viper 按此顺序（最高 → 最低优先级）无缝合并配置源：

1. **显式 `Set()`** 代码调用
2. **标志**（通过 `BindPFlag` 绑定）
3. **环境变量**（`MYCLI_PORT`）
4. **配置文件**（`~/.mycli.yaml`、`./.mycli.yaml`）
5. **默认值**（`viper.SetDefault`）

你必须显式绑定每个源。绑定环境变量对容器化部署至关重要：

```go
func init() {
    // 1. 定义标志
    rootCmd.PersistentFlags().Int("port", 8080, "Server port")

    // 2. 将标志绑定到 Viper
    viper.BindPFlag("port", rootCmd.PersistentFlags().Lookup("port"))

    // 3. 启用环境变量（如 MYCLI_PORT）
    viper.SetEnvPrefix("mycli")
    viper.AutomaticEnv()

    // 4. 设置后备默认值
    viper.SetDefault("port", 8080)
}
```

### 3. 环境变量映射

使用 `viper.SetEnvPrefix("MYAPP")` 和 `viper.AutomaticEnv()` 时：

| Viper 键 | 环境变量 |
|-----------|---------|
| `log-level` | `MYAPP_LOG_LEVEL` |
| `serve.addr` | `MYAPP_SERVE_ADDR` |
| `db.password` | `MYAPP_DB_PASSWORD` |

带点或连字符的嵌套键需要替换器才能正确映射到环境变量名：

```go
viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_", ".", "_"))
```

### 4. 配置文件设置（`cmd/root.go`）

```go
func initConfig() {
    if cfgFile != "" {
        viper.SetConfigFile(cfgFile)
    } else {
        home, err := os.UserHomeDir()
        cobra.CheckErr(err)

        viper.AddConfigPath(home)
        viper.AddConfigPath(".")
        viper.SetConfigType("yaml")
        viper.SetConfigName(".myapp")
    }

    viper.SetEnvPrefix("MYAPP")
    viper.AutomaticEnv()

    if err := viper.ReadInConfig(); err != nil {
        if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
            fmt.Fprintf(os.Stderr, "Error reading config: %v\n", err)
            os.Exit(1)
        }
    }
}
```

使用 YAML 作为默认格式 —— 它可读且支持嵌套：

```yaml
# ~/.myapp.yaml
log-level: debug

serve:
  addr: ":9090"
  port: 9090

db:
  host: localhost
  port: 5432
  name: myapp
```

## 版本命令

```go
// 通过 -ldflags 在构建时设置
var (
    version = "dev"
    commit  = "none"
    date    = "unknown"
)

var versionCmd = &cobra.Command{
    Use:   "version",
    Short: "Print version information",
    Run: func(cmd *cobra.Command, args []string) {
        fmt.Printf("myapp %s (commit: %s, built: %s)\n", version, commit, date)
    },
}
```

```bash
go build -ldflags="-X 'github.com/spf13/myapp/cmd.version=1.2.3' \
                   -X 'github.com/spf13/myapp/cmd.commit=$(git rev-parse --short HEAD)' \
                   -X 'github.com/spf13/myapp/cmd.date=$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
```

## 测试 CLI 命令

**反模式：** 通过编译二进制文件并使用 `os/exec` 来测试 CLI 命令。这极其缓慢、脆弱，且难以衡量测试覆盖率。

因为 Cobra 命令只是 Go 结构体，你可以通过重定向它们的输入、输出和参数直接在内存中测试。

```go
// 惯用：内存中 CLI 测试
func TestServerCommand(t *testing.T) {
    // 在测试之间重置 viper 状态 —— Viper 是单例；测试污染是真实的
    viper.Reset()

    buf := new(bytes.Buffer)
    cmd := serverCmd
    cmd.SetOut(buf)
    cmd.SetErr(buf)

    // 像用户在命令行上一样传递参数
    cmd.SetArgs([]string{"--port", "9090"})

    if err := cmd.Execute(); err != nil {
        t.Fatalf("unexpected error: %v", err)
    }

    if !strings.Contains(buf.String(), "Starting server on 9090") {
        t.Errorf("expected output to contain port 9090, got: %s", buf.String())
    }
}
```

- 测试之间始终 `viper.Reset()` —— Viper 全局状态会在测试用例之间泄漏。
- 使用 `cmd.SetOut` / `cmd.SetErr` 捕获输出，无需猴子补丁 `os.Stdout`。
- 永远不要通过编译二进制文件 + `os/exec` 测试；使用内存中执行获得速度和覆盖率。

## 常见错误

- **在 `initConfig` 之前访问 Viper**：在 `cobra.OnInitialize` 回调运行之前 Viper 值是空的。不要在 `init()` 函数或 `var` 块中读取 Viper。
- **忘记 `BindPFlag`**：标志不会自动对 Viper 可见。你必须显式绑定它们。
- **缺少 `SetEnvKeyReplacer`**：带点的嵌套键（如 `serve.addr`）不加替换器无法匹配 `MYAPP_SERVE_ADDR`。
- **业务逻辑中导入 Cobra/Viper**：`engine` 包绝不能导入 Cobra 或 Viper。传递类型化配置结构体代替。
- **测试中修改全局命令状态**：`rootCmd` 是包级变量。并行运行的测试会产生竞态。使用工厂函数实现完全可测试的 CLI。
- **过度嵌套子命令**：两层（`app command subcommand`）通常是正确的深度。三层或更多会让用户困惑。
