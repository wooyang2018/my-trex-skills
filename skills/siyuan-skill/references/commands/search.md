# 搜索内容命令

搜索思源笔记内容（SQL 搜索）。

## 命令格式

```bash
siyuan search <query> [options]
```

**别名**：`find`

## 参数说明

| 参数 | 类型 | 说明 | 示例 |
|-----|------|------|------|
| `--type, -T <type>` | string | 按单个类型过滤 | `-T d` |
| `--types <types>` | string | 按多个类型过滤（逗号分隔） | `--types d,p,h` |
| `--sort-by, -s <sortBy>` | string | 排序方式（relevance/date） | `-s date` |
| `--limit, -l <limit>` | number | 结果数量限制 | `-l 5` |
| `--path, -P <path>` | string | 搜索路径（仅搜索指定路径下的内容） | `-P /AI/openclaw` |
| `--notebook, -n <notebookId>` | string | 指定笔记本ID | `-n 20260227231831-yq1lxq2` |
| `--where <condition>` | string | 自定义WHERE条件 | `--where "length(content) > 100"` |

## 支持的类型

- `d` - 文档
- `p` - 段落
- `h` - 标题
- `l` - 列表
- `i` - 列表项
- `tb` - 表格
- `c` - 代码块
- `s` - 分隔线
- `img` - 图片

## 使用示例

```bash
siyuan search "关键词"
siyuan search "关键词" --type d
siyuan search "关键词" --types p,h
siyuan search "关键词" --path /AI/openclaw
siyuan search "关键词" --sort-by date --limit 5
siyuan search "关键词" --where "length(content) > 100 AND updated > '20260101000000'"
```

## 安全特性

- 所有搜索查询经过 SQL 转义
- 笔记本 ID 和父文档 ID 必须符合思源笔记格式（14-32位字母数字）
- 类型参数只接受预定义的合法值
- `--where` 参数会过滤注释和危险字符

## 相关文档

- [最佳实践](../advanced/best-practices.md)
