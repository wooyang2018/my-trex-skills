---
name: go
description: >-
  Call BEFORE writing new Go files to load idiomatic patterns,
  and AFTER completing Go implementation to catch outdated APIs.
  Triggers: new .go file creation, Go code review, refactoring,
  package structure decisions, error handling, concurrency design.
  This skill catches mistakes LLMs consistently make in Go:
  sort.Slice→slices.SortFunc, interface{}→any, Java-style package
  nesting (service/repository/controller), log+return anti-pattern,
  old build constraints, missing error context wrapping.
---

# 惯用 Go：Go 的方式

构建健壮、高效、可维护应用的惯用 Go 模式与最佳实践。

## 何时激活

- 编写新的 Go 代码
- 审查或审计现有 Go 代码
- 重构 Go 代码（尤其是看起来像 Java/Spring Boot 模式的 Go 代码）
- 设计 Go 包、模块或 API
- 在标准库和第三方库之间做选择
- 任何关于 Go 项目结构、错误处理、并发或测试的问题

## 核心原则

### 1. 清晰优于聪明

Go 偏好可读性和简洁性，而非抽象和技巧。代码应该显而易见。如果你需要读三遍才能理解一个函数的控制流，那它需要重写。

```go
// 惯用：直接、线性的控制流
func GetUser(id string) (*User, error) {
    user, err := db.FindUser(id)
    if err != nil {
        return nil, fmt.Errorf("finding user %s: %w", id, err)
    }
    return user, nil
}
```

### 2. 让零值可用

设计类型时让零值无需初始化即可使用。这消除了样板构造函数。`sync.Mutex` 和 `bytes.Buffer` 是这方面的黄金标准。

```go
// 惯用：立即可用
type Counter struct {
    mu    sync.Mutex
    count int
}

func (c *Counter) Inc() {
    c.mu.Lock()
    c.count++
    c.mu.Unlock()
}
```

### 3. 尽早返回，保持快乐路径靠左

立即处理错误和边界情况并返回。不要用 `else` 块处理主逻辑。函数的"快乐路径"不应该有缩进。

## 快速参考

| 关注点 | 惯用做法 | 反模式 |
|--------|---------|--------|
| 包结构 | 扁平、领域命名（`auth/`、`billing/`） | 整洁架构层（`service/`、`repository/`、`controller/`） |
| 接口 | 消费者定义，1-3 方法 | 实现者预先定义大接口 |
| 错误 | `fmt.Errorf("doing X: %w", err)` | 静默吞掉、panic、日志+返回双重处理 |
| 并发 | 信号量模式 + errgroup | 静态 worker 池 |
| 测试 | 表驱动 + fake + `t.Helper()` | 重型 BDD/mock 框架（Ginkgo） |
| 零值 | 设计类型让零值可用 | 强制构造函数 |
| 泛型 | 消除重复算法（3+ 类型） | 泛型 Repository/Service 多态 |
| 标准库 | 优先使用 `slices`/`maps`/`cmp`（详见 stdlib-modern.md） | 手写 helper 或引入第三方 |

## 包组织：默认扁平

**反模式：** 使用深层嵌套的目录树或默认大量依赖 `internal/` 文件夹来人为强制"整洁架构"层次。这会导致循环依赖和难以导航。

### 1. 单包默认

从扁平开始。如果你在构建微服务或简单工具，把所有东西放在根目录（或 `main.go` 旁边）。只在你真正需要新命名空间来澄清代码时，或需要解耦一个严格独立的领域时，才创建新包。

### 2. `internal/` 的正确用法

`internal/` 目录有特定的编译器强制：它阻止其他模块导入其中的代码。

- **对于应用程序：** 如果你在构建可执行二进制文件，没有人能导入你的代码。在这里使用 `internal/` 通常只是增加不必要的路径深度。
- **对于库：** 谨慎使用 `internal/`。它应该保留给复杂子系统，在你需要在自己的包之间共享导出类型、但必须阻止最终用户依赖这些类型的情况下使用。

```
// 惯用：扁平的、面向功能的库或简单应用
myproject/
├── main.go           # 入口点（如果是应用程序）
├── server.go         # 核心逻辑
├── config.go         # 配置
├── parser.go         # 领域特定的解析
├── parser_test.go
├── go.mod
└── go.sum
```

### 3. 服务应用的领域包

当应用确实有独立的、可独立测试的领域时，给每个领域一个顶层包。规则仍然是**一层深** —— 无 `internal/` 嵌套，无整洁架构层次。每个包负责一个关注点。`main.go` 将它们组装在一起。

创建包的信号：这个领域能用一句话描述吗？它对其他包一无所知吗？如果是，它就值得拥有自己的包。

```
// 惯用：具有不同领域包的 Web 服务
myservice/
├── main.go        # 组装所有部分；此处无业务逻辑
├── config/        # Config 结构体，环境变量加载
├── auth/          # 身份验证，会话中间件
├── db/            # 数据存储客户端 + 所有查询
├── storage/       # 对象存储（S3, R2, GCS）
├── billing/       # 支付提供商 + 信用账本
├── jobs/          # 任务生命周期 + 队列调度 + Worker 处理（同一领域，一个包）
├── web/           # HTTP 处理器 + HTML 模板 + 静态资源（设计上紧耦合）
├── transcribe/    # 领域特定处理 —— 独立的纯函数
├── Makefile
├── Dockerfile
└── .env.example
```

**领域包规则：**
- 每个包有**一个明确的目的** —— 以它做什么命名，而不是它是什么层（`jobs/` 而非 `service/`）
- 包之间不横向导入 —— 循环是错误边界的信号；`main` 是组装点
- 总是一起出现的相关子关注点放在一个包中（如任务创建 + Worker 处理器都在 `jobs/` 中，因为它们共享任务生命周期领域）
- HTTP 处理器和它们渲染的模板放在一起的 `web/` —— 它们在设计上就是紧耦合的
- 不要创建 `utils/`、`helpers/` 或 `common/` 包 —— 这些是所有权不清的症状

**要拒绝的反模式：** 整洁架构 / DDD 层（`service/`、`repository/`、`controller/`、`domain/`）。这些以层命名的包导致循环导入、迫使接口泛滥，且在 Go 中增加零清晰度。以领域命名的包（`auth/`、`billing/`、`jobs/`）是"太扁平"和"过度工程化"之间的正确中间地带。

## 接口设计

### 1. 接口是发现的，不是预先设计的

先编写具体类型。只在你发现多个类型需要被消费者互换使用时才定义接口。

### 2. 在使用处定义接口

接口属于*消费*它们的包，而非*实现*它们的包。这解耦了你的包。

```go
// internal/processor/processor.go

// 惯用：消费者精确定义它需要什么。
// 具体的 'UserStore' 甚至不需要知道这个接口的存在。
type UserFetcher interface {
    GetUser(id string) (*User, error)
}

type Processor struct {
    fetcher UserFetcher
}
```

### 3. 接受接口，返回结构体

要求尽可能小的接口作为输入参数（如 `io.Reader` 而非 `*os.File`），但返回具体结构体，这样调用者就不必使用类型断言来访问特定字段或方法。

## 库 API 设计

### 领域对象作为入口点

当设计一个包装有状态资源（金库、数据库连接、配置存储）的 Go 库时，让该资源结构体成为主对象。它的方法返回领域类型的子对象。**避免：**

- 把 config/resource 结构体作为每个包级函数的第一个参数传递
- 包级全局状态（如 pflag 的默认 `FlagSet`）用于可能被嵌入的库代码

**应该这样做：**

```go
// 打开主资源一次
v, err := vault.Open(path)

// 领域操作是主对象的方法
// 每次调用都是无状态的（重新加载） —— 结构体上无缓存状态
idx, err := v.People()             // 返回 *people.Index, error
note, err := v.Daily(time.Now())   // 返回 *daily.Note, error
mtgs, err := v.Meetings()          // 返回 *meetings.Index, error

// 领域类型在子包中 —— 调用者使用类型推断
p, err := idx.FindOne("Steve")     // *people.Person
```

**为什么用这个模式：**

- 主结构体（`Vault`）是单一入口点 —— 调用者只需一个 import 就能开始
- 子包定义丰富的领域类型（`people.Person`、`daily.Note`）—— 每个类型与拥有它的逻辑在一起
- 无全局状态意味着库可安全用于并发、多实例和测试
- 无状态方法调用（每次重新加载）保持结构体简单 —— 无需缓存失效逻辑
- 类型推断（`:=`）意味着调用者很少需要显式导入子包来声明变量

**何时使用全局实例代替：** 仅用于 CLI 专用工具（如 `pflag` 本身），确实只有一个实例，且最终用户易用性优先于库的正确性。

## 并发模式

**反模式：** 重型静态 Worker 池。Go 的调度器非常高效；你不需要像其他语言管理 OS 线程那样手动管理工作池。

### 1. 通过通信共享内存

如果你能通过 channel 传递数据，就不要用 mutex 保护共享数据。Channel 编排执行；mutex 序列化执行。

### 2. 有界并发（信号量模式）

如果你需要限制并发，使用缓冲 channel 作为信号量，而不是固定的 Worker 池。

```go
func FetchAll(urls []string, maxConcurrent int) error {
    sem := make(chan struct{}, maxConcurrent)
    g, ctx := errgroup.WithContext(context.Background())

    for _, url := range urls {
        url := url // 注意：Go 1.22+ 原生处理此问题

        sem <- struct{}{} // 达到最大并发时阻塞

        g.Go(func() error {
            defer func() { <-sem }() // 释放令牌
            return fetch(ctx, url)
        })
    }

    return g.Wait()
}
```

### 3. 永远不要启动一个你不知道它如何停止的 Goroutine

每个 `go func()` 必须有明确的退出条件，通常由 `context.Context` 或关闭的 channel 控制。

## 配置与结构体设计

### 函数式选项用于复杂初始化

当结构体有很多可选配置参数时，避免庞大的构造函数。使用函数式选项模式。

```go
type Server struct {
    addr    string
    timeout time.Duration
}

type Option func(*Server)

func WithTimeout(d time.Duration) Option {
    return func(s *Server) { s.timeout = d }
}

func NewServer(addr string, opts ...Option) *Server {
    s := &Server{
        addr:    addr,
        timeout: 30 * time.Second, // 合理的默认值
    }
    for _, opt := range opts {
        opt(s)
    }
    return s
}
```

## 错误处理

### 1. 错误是值

错误不是要捕获的异常；它们是要处理的值。显式检查它们。

### 2. 包装以添加上下文，而非堆栈跟踪

返回错误时，添加关于你正在尝试做什么的上下文。

```go
// 惯用
data, err := os.ReadFile(path)
if err != nil {
    return fmt.Errorf("loading config file %s: %w", path, err)
}
```

## 测试模式

**反模式：** 依赖重型 BDD 框架（如 Ginkgo）或复杂的 mock 生成工具。Go 测试就应该是 Go 编程。

### 1. 表驱动测试

Go 中单元测试的绝对标准。使用 `t.Run()` 遍历包含输入和期望输出的结构体切片。

```go
func TestParseConfig(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        wantErr bool
    }{
        {"valid config", "port=8080", false},
        {"invalid format", "port=abc", true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            _, err := ParseConfig(tt.input)
            if (err != nil) != tt.wantErr {
                t.Fatalf("ParseConfig() error = %v, wantErr %v", err, tt.wantErr)
            }
        })
    }
}
```

### 2. 有意义的 Helper 配合 `t.Helper()`

提取重复的断言逻辑时，始终调用 `t.Helper()`，确保失败指向实际的测试用例，而非 helper 函数行。

### 3. Fake 和 Stub 优于重型 Mock

利用 Go 的隐式接口编写简单的手动 fake。这保持测试依赖轻量且测试逻辑透明。

### 4. Golden File 和 `testdata` 目录

对于需要复杂输入或产生大输出的测试，使用名为 `testdata` 的目录。`go test` 工具显式忽略这些目录。

### 5. 文件系统抽象（Afero 模式）

不要在业务逻辑深处硬编码 `os` 包调用。接受文件系统接口，以便测试可以在内存中运行，不接触磁盘。`github.com/spf13/afero` 是这方面的行业标准。

```go
import "github.com/spf13/afero"

type FileProcessor struct {
    fs afero.Fs
}

func NewFileProcessor(fs afero.Fs) *FileProcessor {
    return &FileProcessor{fs: fs}
}
```

在测试中，注入 `afero.NewMemMapFs()` 以完全消除磁盘 I/O，防止不稳定的慢测试。

### 6. `cmp` 优于 DeepEqual

比较复杂结构体或 map 时，使用 `github.com/google/go-cmp/cmp` 获得丰富、可读的差异，而非严格的 `reflect.DeepEqual`。

## 泛型（Go 1.18+）

泛型的存在是为了消除重复算法，而非创建类型层次结构。如果你在用继承或多态的思维考虑泛型，停下来 —— 你在写 Java。

### 何时使用泛型

当你有**相同的算法**需要操作**多个具体类型**时使用泛型：

```go
// 好：泛型算法，具体类型作为输入
func Map[S, T any](slice []S, f func(S) T) []T {
    result := make([]T, len(slice))
    for i, v := range slice {
        result[i] = f(v)
    }
    return result
}

// 好：约束表达了有意义的需求
func Min[T cmp.Ordered](a, b T) T {
    if a < b {
        return a
    }
    return b
}
```

### 何时不使用泛型

```go
// 坏：用于多态的泛型接口 —— 这是 Java
type Repository[T any] interface {
    Find(id string) (T, error)
    Save(entity T) error
}

// 好：满足你实际需求的具体接口
type UserStore interface {
    FindUser(id string) (*User, error)
    SaveUser(u *User) error
}
```

- **不要**创建泛型基类型、泛型服务或泛型仓库
- **不要**用 `any` 作为约束来表示"我还不知道类型"。这是设计异味
- **要**在需要 map 键或相等检查时使用 `comparable`
- **要**在需要 `<`、`>`、`<=`、`>=` 时使用 `cmp.Ordered`
- 从具体实现开始。只在 3 个以上类型重复相同逻辑时才泛型化

## 调试：Go 工具链不是问题所在

**Go 工具极其可靠。它几乎永远不会是 bug 的源头。**

调试时，不要浪费时间怀疑 `go run`、`go build`、`go test` 或构建缓存。Go 工具链说到做到：

- `go run` 始终从源码重新编译。它不使用过期的缓存二进制文件。
- `go build` 是确定性的且正确的。
- `go test` 运行实际编译的测试二进制文件。
- 构建缓存以源码内容为键 —— 如果源码改变了，缓存自动失效。

**如果编辑代码后错误仍然存在，解释是以下之一 —— 按可能性排序：**

1. 编辑没有修复底层逻辑错误。
2. 编辑的是错误的文件、错误的函数或错误的包。
3. 有第二个调用点有同样的 bug 但没有更新。
4. 错误来自于不同于正在编辑的代码路径。

**应该做什么而不是怪工具：**

- 仔细重读错误消息。Go 的错误消息是准确的。
- 确认你编辑的文件确实是正在编译的文件（`go list -f '{{.GoFiles}}' .`）。
- 在确切位置添加 `fmt.Println` 或 `t.Log` 以验证执行到达了那里。
- 检查已更改函数的所有调用点都已更新。

在先穷尽所有代码层面的解释之前，不要建议清除构建缓存（`go clean -cache`）、重启 Go 工具链或任何其他工具级干预。工具没有在骗你。

## 标准库：使用新包

LLM 经常建议第三方工具或编写手动 helper，而这些功能自 Go 1.21 起就在标准库中了。**始终先检查 stdlib。**

### `slices` 包（Go 1.21）

```go
import "slices"

// 搜索和测试
slices.Contains(s, "value")
slices.Index(s, "value")           // 未找到返回 -1
slices.ContainsFunc(s, func(v string) bool { return v == "x" })

// 排序
slices.Sort(s)                     // 原地排序，适用于任何有序类型
slices.SortFunc(s, func(a, b T) int { return cmp.Compare(a.Name, b.Name) })
slices.IsSorted(s)

// 操作
slices.Reverse(s)
slices.Compact(s)                  // 移除连续重复项
slices.Delete(s, i, j)            // 移除 [i, j) 元素
slices.Clone(s)                   // 浅拷贝
slices.Concat(s1, s2, s3)         // 连接多个切片（1.22）
```

永远不要在 `slices.Sort(s)` 存在时写 `sort.Slice(s, func(i, j int) bool { return s[i] < s[j] })`。

### `maps` 包（Go 1.21）

```go
import "maps"

maps.Keys(m)        // 返回键的迭代器（1.23）/ []K（更早版本）
maps.Values(m)      // 返回值的迭代器
maps.Clone(m)       // 浅拷贝
maps.Copy(dst, src) // 将 src 的所有条目复制到 dst
maps.Delete(m, func(k, v T) bool { ... })  // 删除匹配谓词的条目
maps.Equal(m1, m2)  // 报告两个 map 是否相等
```

### `cmp` 包（Go 1.21）

```go
import "cmp"

cmp.Compare(a, b)    // 返回 -1、0 或 1；适用于任何 cmp.Ordered 类型
cmp.Or(a, b, c)      // 返回第一个非零值 —— 替代三元运算符变通方案
min(a, b)            // 自 Go 1.21 起内置
max(a, b)            // 自 Go 1.21 起内置
```

`cmp.Or` 对默认值模式特别有用：

```go
// 代替：if cfg.Timeout == 0 { cfg.Timeout = 30 * time.Second }
cfg.Timeout = cmp.Or(cfg.Timeout, 30*time.Second)
```

### `errors.Join`（Go 1.20）

```go
// 组合多个错误 —— 无需第三方库
err := errors.Join(err1, err2, err3)

// 与 errors.Is 和 errors.As 正确配合
if errors.Is(err, ErrNotFound) { ... }
```

使用此方法代替 `fmt.Errorf("%w; %w", err1, err2)` 或任何 `multierr` 包。

## 并发：现代模式

### `sync/atomic` 类型化值（Go 1.19）

使用类型化的原子值代替基于函数的 API：

```go
// 旧的（仍然有效但新代码请避免）
var count int64
atomic.AddInt64(&count, 1)
val := atomic.LoadInt64(&count)

// 新的 —— 类型安全，无指针运算
var count atomic.Int64
count.Add(1)
val := count.Load()

// 其他类型化原子量
var flag  atomic.Bool
var ptr   atomic.Pointer[MyStruct]
var val32 atomic.Int32
var val64 atomic.Uint64
```

### `context.WithoutCancel`（Go 1.21）

当你需要分离上下文的取消但保留其值时（如后台任务应该在请求之后继续运行）：

```go
// 后台任务应该在 HTTP 请求上下文取消后继续运行
bgCtx := context.WithoutCancel(requestCtx)
go doBackgroundWork(bgCtx)
```

## HTTP：使用改进的 stdlib 路由器（Go 1.22）

LLM 对任何超出简单路由的需求都会反射性地推荐 gorilla/mux 或 chi。自 Go 1.22 起，标准 `net/http` ServeMux 原生处理方法和路径参数路由。

```go
mux := http.NewServeMux()

// 方法限定路由
mux.HandleFunc("GET /users", listUsers)
mux.HandleFunc("POST /users", createUser)

// 路径参数 —— 通过 r.PathValue 访问
mux.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")
    // ...
})

// 通配符
mux.HandleFunc("GET /files/{path...}", serveFile)
```

只在你需要中间件链、命名路由生成或正则约束时才使用 chi 或 gorilla/mux。对于纯方法 + 路径路由，stdlib 已足够。

## 语法：使用当前 Go

LLM 经常生成过时的语法。了解当前惯用写法：

### Range over Integer（Go 1.22）

```go
// 旧的
for i := 0; i < 10; i++ { ... }

// 新的
for i := range 10 { ... }
```

### 构建约束

```go
// 旧的（已弃用 —— 不要生成）
// +build linux darwin

// 当前
//go:build linux || darwin
```

`//go:build` 形式自 Go 1.17 起是必需的。永远不要生成旧的 `// +build` 语法。

### `any` 代替 `interface{}`

```go
// 旧的
func Print(v interface{}) { ... }

// 当前 —— `any` 是 interface{} 的内置别名，自 Go 1.18 起
func Print(v any) { ... }
```

## 结构化日志 `log/slog`（Go 1.21）

LLM 最常犯错的模式：

```go
// 通过上下文传递 logger 用于请求级日志
func HandleRequest(ctx context.Context, r *Request) {
    logger := slog.With("request_id", r.ID, "user_id", r.UserID)
    // 后续所有日志调用自动携带这些字段
    logger.Info("handling request")
    process(ctx, logger, r)
}

// 分组相关字段
logger.With(slog.Group("http",
    slog.String("method", r.Method),
    slog.String("path", r.URL.Path),
    slog.Int("status", status),
))

// 使用正确的级别 —— LLM 过度使用 Info
logger.Debug("cache miss", "key", key)     // 内部状态，高频
logger.Info("server started", "addr", addr) // 生命周期事件
logger.Warn("retrying", "attempt", n)       // 可恢复的问题
logger.Error("request failed", "err", err)  // 需要关注
```

- **永远不要**在 `main` 之外使用包级 `log` 或 `slog` 全局变量。将 `*slog.Logger` 作为依赖传递。
- **永远不要**同时记录日志又返回错误。在边界记录日志，通过调用栈返回错误。
- 仅在 `main` 中或库中未提供 logger 时使用 `slog.Default()` 作为后备。

## 补充：各版本新特性速查

以下为按版本整理的额外现代 Go 特性，与上文不重复。编写代码时应主动使用项目 `go.mod` 中声明版本及以下的所有特性。

### 基础（Go 1.0+ / 1.8+）

```go
// 使用 time.Since 代替 time.Now().Sub(start)
elapsed := time.Since(start)

// 使用 time.Until 代替 deadline.Sub(time.Now())
remaining := time.Until(deadline)
```

### 错误匹配（Go 1.13+）

```go
// 使用 errors.Is 代替 err == target（支持 wrapped errors）
if errors.Is(err, os.ErrNotExist) {
    // ...
}
```

### 字符串/字节切割（Go 1.18+）

```go
// strings.Cut 代替 Index + 手动切片
before, after, found := strings.Cut(s, "=")

// bytes.Cut 同理
key, value, ok := bytes.Cut(line, []byte(":"))
```

### fmt.Appendf（Go 1.19+）

```go
// 高效追加格式化文本到已有 []byte，避免 []byte(fmt.Sprintf(...)) 的额外分配
buf = fmt.Appendf(buf, "user=%s age=%d", name, age)
```

### 字符串工具（Go 1.20+）

```go
// strings.Clone —— 复制字符串，释放底层大缓冲区的引用
s2 := strings.Clone(s)

// bytes.Clone —— 复制 []byte
b2 := bytes.Clone(b)

// CutPrefix / CutSuffix —— 比 HasPrefix + TrimPrefix 更简洁
if rest, ok := strings.CutPrefix(path, "/api/"); ok {
    handle(rest)
}
if base, ok := strings.CutSuffix(filename, ".go"); ok {
    fmt.Println(base)
}
```

### context 增强（Go 1.20+）

```go
// WithCancelCause —— 取消时携带原因
ctx, cancel := context.WithCancelCause(parent)
cancel(fmt.Errorf("timeout exceeded"))

// Cause —— 获取导致取消的错误
if err := context.Cause(ctx); err != nil {
    log.Println("cancelled because:", err)
}
```

### clear 内置函数（Go 1.21+）

```go
// 清空 map 的所有条目
clear(m)

// 将 slice 所有元素置零（长度不变）
clear(s)
```

### sync.OnceFunc / OnceValue（Go 1.21+）

```go
// 代替 sync.Once + 外部函数的笨拙组合
initDB := sync.OnceFunc(func() {
    db = connectDB()
})

// 带返回值的惰性初始化
getConfig := sync.OnceValue(func() *Config {
    return loadConfig()
})
cfg := getConfig()
```

### context.AfterFunc / WithTimeoutCause（Go 1.21+）

```go
// AfterFunc —— 上下文取消时自动执行清理
stop := context.AfterFunc(ctx, func() {
    conn.Close()
})
defer stop()

// WithTimeoutCause —— 超时取消时携带自定义错误
ctx, cancel := context.WithTimeoutCause(parent, 5*time.Second,
    fmt.Errorf("operation X timed out"))
defer cancel()

// WithDeadlineCause —— 同理，以 deadline 为准
ctx, cancel := context.WithDeadlineCause(parent, deadline, myErr)
```

### 循环变量语义修复（Go 1.22+）

自 Go 1.22 起，`for` 循环的每次迭代拥有**独立的变量副本**，在 goroutine 中捕获循环变量不再需要 `v := v` 的旧技巧：

```go
// Go 1.22+ 安全：无需重新声明
for _, item := range items {
    go func() {
        process(item) // 每个 goroutine 捕获的是独立副本
    }()
}
```

### reflect.TypeFor（Go 1.22+）

```go
// 代替笨拙的 reflect.TypeOf((*T)(nil)).Elem()
t := reflect.TypeFor[MyStruct]()
```

### 迭代器收集与排序（Go 1.23+）

```go
// slices.Collect —— 从迭代器收集为切片
keys := slices.Collect(maps.Keys(m))

// slices.Sorted —— 收集并排序一步到位
sortedKeys := slices.Sorted(maps.Keys(m))

// 直接迭代
for k := range maps.Keys(m) {
    process(k)
}
```

### time.Tick 可被 GC 回收（Go 1.23+）

自 Go 1.23 起，未引用的 ticker 可被垃圾回收器正常回收，即使未调用 Stop。不再需要为了 GC 而优先使用 `time.NewTicker`：

```go
// Go 1.23+ 安全：不再泄漏
for t := range time.Tick(1 * time.Second) {
    doWork(t)
}
```

### t.Context()（Go 1.24+）

测试中需要 context 时，**始终**使用 `t.Context()` 代替手动创建：

```go
func TestFoo(t *testing.T) {
    ctx := t.Context() // 测试结束时自动取消
    result := doSomething(ctx)
    // ...
}
```

### omitzero JSON 标签（Go 1.24+）

对 `time.Duration`、`time.Time`、结构体、切片、map 等类型，**始终**使用 `omitzero` 代替 `omitempty`（后者对这些类型行为不正确）：

```go
type Config struct {
    Timeout  time.Duration `json:"timeout,omitzero"`
    StartAt  time.Time     `json:"start_at,omitzero"`
    Metadata map[string]string `json:"metadata,omitzero"`
}
```

### b.Loop()（Go 1.24+）

基准测试中**始终**使用 `b.Loop()` 代替 `for i := 0; i < b.N; i++`：

```go
func BenchmarkProcess(b *testing.B) {
    for b.Loop() {
        process()
    }
}
```

### strings.SplitSeq / FieldsSeq（Go 1.24+）

在 for-range 中迭代分割结果时，**始终**使用 Seq 变体（避免分配中间 slice）：

```go
// 代替 strings.Split
for part := range strings.SplitSeq(s, ",") {
    process(part)
}

// 代替 strings.Fields
for word := range strings.FieldsSeq(text) {
    index(word)
}

// bytes 包同理
for chunk := range bytes.SplitSeq(data, []byte("\n")) {
    handle(chunk)
}
```

### wg.Go()（Go 1.25+）

使用 `sync.WaitGroup` 启动 goroutine 时，**始终**使用 `wg.Go()` 代替 `wg.Add(1)` + `go func() { defer wg.Done(); ... }()`：

```go
var wg sync.WaitGroup
for _, item := range items {
    wg.Go(func() {
        process(item)
    })
}
wg.Wait()
```

### new(val) 表达式（Go 1.26+）

Go 1.26 扩展了 `new()` 使其接受表达式，返回指向该值的指针。类型自动推断。**始终**使用 `new(val)` 代替 `x := val; &x` 模式：

```go
type Config struct {
    Timeout *int
    Debug   *bool
    Name    *string
}

cfg := Config{
    Timeout: new(30),      // *int
    Debug:   new(true),    // *bool
    Name:    new("prod"),  // *string
}
```

### errors.AsType[T]（Go 1.26+）

**始终**使用 `errors.AsType` 代替 `errors.As` + 预声明变量：

```go
// 代替：var pathErr *os.PathError; if errors.As(err, &pathErr) { ... }
if pathErr, ok := errors.AsType[*os.PathError](err); ok {
    fmt.Println("path:", pathErr.Path)
}
```
