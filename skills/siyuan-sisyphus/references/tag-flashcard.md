# 标签与闪卡

适用场景：列出/重命名/删除工作区标签；管理思源闪卡牌组与卡片、做复习。

## 标签

`tag` 工具是工作区级，不针对单个笔记本。

```bash
siyuan-sisyphus tag list
siyuan-sisyphus tag list --keyword "项目" --json
siyuan-sisyphus tag rename --old "旧标签" --new "新标签"
siyuan-sisyphus tag remove --label "废弃标签"   # confirmation required
```

要点：

- 思源没有"创建标签"接口；要新增一个标签，在某个块的 markdown 内容里写 `#标签名#`（前后都是 `#`），思源索引后即出现在 `tag list`。
- 刚写完的标签可能短暂未进入索引，重试一次再判失败。
- `tag remove` 不可恢复，且会影响所有引用了该标签的块；执行前向用户复述。

新增标签的样板：

```bash
siyuan-sisyphus block append --parent-id <docId> --data-type markdown --data "#项目A# 备注：本周交付。"
```

## 闪卡

闪卡基于思源的 riff 模块。读取与列出：

```bash
siyuan-sisyphus flashcard get_decks --json
siyuan-sisyphus flashcard list_cards --deck-id <deckId> --page 1 --page-size 20 --json
siyuan-sisyphus flashcard get_cards --ids-json '["<cardId-1>","<cardId-2>"]' --json
```

把现有块挂成卡：

```bash
siyuan-sisyphus flashcard create_card --deck-id <deckId> --block-ids-json '["<blockId-1>","<blockId-2>"]'
```

> `flashcard create_card` 比手写 `custom-riff-decks` 块属性更可靠，它会同时写属性并向 riff 注册。文档块（`type=d`）不能直接挂卡，先在文档下生成段落/标题块再挂。

复习与移除：

```bash
siyuan-sisyphus flashcard review_card --card-id <cardId> --rating 3
siyuan-sisyphus flashcard remove_card --deck-id <deckId> --card-ids-json '["<cardId>"]'   # confirmation required
```

`rating` 通常 `0~3`（具体含义以 `siyuan-sisyphus help flashcard review_card` 为准）。

## 易错点

- 标签按 `#tag#` 写法激活，不是 markdown 标准的 `#header`；漏掉尾随 `#` 不会生成标签。
- 闪卡的 `deck` 必须先在思源 UI 或前置流程里建好，CLI 的 `create_card` 不会自动建牌组。
- `remove_card` 仅从牌组移除卡，不会删除内容块本身；要删块用 `block` / `fs` 工具。
