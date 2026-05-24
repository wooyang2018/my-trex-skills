# 文件与资源

适用场景：上传图片/附件、导出 markdown、把文档抽出为独立 zip、查询文档关联资源、清理未引用资源、OCR 文本提取。

`file` 工具中有多个 `confirmation required` 动作，触碰用户磁盘文件或写入资源库前必须取得明确批准。

## 上传资源（高危）

```bash
siyuan-sisyphus file upload_asset --assets-dir-path "/assets/" --local-file-path "/绝对路径/图片.png"
```

随后插入 markdown 引用：

```bash
siyuan-sisyphus block append --parent-id <docId> --data-type markdown --data "![说明](assets/图片.png)"
```

工作流建议：

1. 向用户确认本地源路径与目标资源目录（默认 `/assets/`）。
2. `upload_asset` 后获得思源相对路径。
3. 插入 markdown 引用并 `fs read` 验证渲染。

## 导出 markdown

```bash
siyuan-sisyphus file export_md --id <docId> --json
```

返回包含正文 markdown 与文件名建议；适合外部归档或分享。

## 抽取文档为独立包

```bash
siyuan-sisyphus file extract_doc --id <docId> --json
```

把单文档及其引用的资源打包，便于跨实例迁移。

## 文档关联资源

```bash
siyuan-sisyphus file get_doc_assets --id <docId> --json
siyuan-sisyphus file get_doc_assets --id <docId> --asset-type image --json
```

`asset-type` 常见取值：`image`、`audio`、`video`、`pdf`、`other`。

## 未引用资源治理（高危）

```bash
siyuan-sisyphus file list_unused_assets --json
siyuan-sisyphus file remove_unused_assets   # confirmation required
siyuan-sisyphus file delete_asset --path <assetPath>   # confirmation required
```

`remove_unused_assets` 与 `delete_asset` 均不可恢复。执行前：

1. `list_unused_assets` 列清单并输出给用户。
2. 用户确认范围。
3. 执行删除。
4. 再次 `list_unused_assets` 验证清单为空。

## 渲染与 OCR

```bash
siyuan-sisyphus file render --id <docId>
siyuan-sisyphus file get_image_ocr_text --path <assetPath>
```

`get_image_ocr_text` 把图片中的文字抽出，与 `search fulltext_asset_content` 配合，用于"图里的文字"类检索。

## 资源重命名

```bash
siyuan-sisyphus file rename_asset --old-path <旧> --new-path <新>
```

> 资源被多文档引用时，重命名会自动更新所有引用；执行前向用户复述受影响范围。
