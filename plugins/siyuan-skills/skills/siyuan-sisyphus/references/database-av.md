# 属性视图（思源数据库）

适用场景：思源的"数据库块"（attribute view，简称 av）相关操作——读取结构、渲染分页、增列、增/删行、写单元格、按主键查找。结构化、可筛选/排序的数据用 av；只是静态展示的二维表用 markdown 表格。

## 基础读取

```bash
siyuan-sisyphus av get --id <avId> --json
siyuan-sisyphus av render --id <avId> --page 1 --page-size 50 --json
siyuan-sisyphus av search --av-id <avId> --query "关键词" --json
siyuan-sisyphus av get_attribute_view_keys --id <avId> --json
siyuan-sisyphus av get_attribute_view_filter_sort --id <avId> --json
siyuan-sisyphus av get_primary_key_values --av-id <avId> --json
```

`av render` 的输出包含 viewID、列定义、行数据，是与 av 交互的基础视图。任何写操作前都先 `render` 一次，确认列 ID 与行 ID。

## 增列

```bash
siyuan-sisyphus av add_column --av-id <avId> --name "状态" --type select
siyuan-sisyphus av add_column --av-id <avId> --name "截止日" --type date
```

常见列类型：`text`、`number`、`select`、`mSelect`、`date`、`url`、`email`、`phone`、`checkbox`、`relation`、`rollup`、`updated`、`created`、`block`、`mAsset`。具体支持以 `siyuan-sisyphus help av add_column` 为准。

## 增 / 删行

```bash
siyuan-sisyphus av add_rows --av-id <avId> --rows-json '[{"primaryKey":"任务A"},{"primaryKey":"任务B"}]'
siyuan-sisyphus av remove_rows --av-id <avId> --row-ids-json '["<rowId-1>","<rowId-2>"]'
```

`av remove_rows` 在多数场景下不可逆，执行前向用户复述要删除的行。

## 写单元格

`set_cells` 是 av 写入的主入口，必须用 `--cells-json` 数组：

```bash
siyuan-sisyphus av set_cells --av-id <avId> --cells-json '[
  {"rowID":"<rowId>","columnID":"<columnId>","valueType":"text","text":"完成"},
  {"rowID":"<rowId>","columnID":"<dateColumnId>","valueType":"date","date":{"content":1716595200000,"isNotTime":true}}
]'
```

`valueType` 必须与列定义一致。常见值：

- `text` ⇒ 字段 `text`
- `number` ⇒ 字段 `number.content`
- `select` / `mSelect` ⇒ 字段 `mSelect`，传选项数组
- `date` ⇒ 字段 `date.content`（毫秒时间戳）
- `checkbox` ⇒ 字段 `checkbox.checked`
- `url` / `email` / `phone` ⇒ 字段 `url.content` / `email.content` / `phone.content`

不确定时先 `av get` 看现有行的单元格结构，原样仿写。

## 复制 av

```bash
siyuan-sisyphus av duplicate --av-id <avId> --json
```

## av vs markdown 表格

- 静态展示、内容稳定、无需筛选/排序 ⇒ markdown 表格（`| --- |` 语法），用 `block append` 写入。
- 需要排序/筛选/分组、要按主键查、要持续增删行 ⇒ av。
- av 不能由 markdown 表自动转换，需通过 `add_column` + `add_rows` 重建。

## 易错点

- `av render` 默认分页，跨大表必须显式 `--page` / `--page-size`。
- `set_cells` 传错 `valueType` 会被静默忽略或报错；先 `av get` 一行参考。
- 列定义里的选项（`select` 的 options）通常需要先在列上配置，才能在单元格使用。
