# 嵌入 Excalidraw 矢量图

适用场景：用户希望在思源文档中插入可继续编辑的 Excalidraw 图，或把现有 Excalidraw SVG/PNG 上传到思源里。本文档假设用户已安装思源「嵌入式系列 - Excalidraw」插件（`siyuan-embed-excalidraw`，作者 Yuxin Zhao）。

核心机制：Excalidraw 的场景数据被无损编码进 SVG 的 `<metadata>` 注释或 PNG 的 `tEXt` 块。所以一张普通看起来的 SVG/PNG 图，**既能被任意阅读器渲染，又能被 Excalidraw 重新打开继续编辑**。脱离思源后（导出 markdown / 分享出去）图像本身依旧可独立查看，迁移和分享无损。

## 识别规则（务必先读）

插件依靠**文件名前缀** + **元数据**两道闸来识别可编辑的 Excalidraw 图：

1. 文件名必须匹配正则 `^assets/(?:.+/)?excalidraw-.+\.(?:svg|png)$`。也就是说 `assets/` 下任意层级里、文件名以 `excalidraw-` 开头、扩展名 `svg` 或 `png` 才会显示编辑按钮。
2. 文件内容必须包含 `application/vnd.excalidraw+json` 的 payload。

只满足前者会出现编辑按钮但报错；只满足后者插件根本不识别。本 skill 推送时**必须**两者都给到位。

文件名建议用插件本身使用的格式：`excalidraw-image-<块ID>.svg` / `.png`（块 ID 用 `system get_current_time --json` 拿时间戳后自行拼，或直接 `excalidraw-image-<uuid>.svg`）。

## SVG 嵌入格式（推荐，可直接 grep 验证）

SVG 把场景数据放在根 `<svg>` 下的 `<metadata>` 元素里，用 4 段 HTML 注释包裹：

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="..." width="..." height="...">
  <!-- svg-source:excalidraw -->
  <metadata>
    <!-- payload-type:application/vnd.excalidraw+json -->
    <!-- payload-version:2 -->
    <!-- payload-start -->BASE64_OF_SCENE_JSON<!-- payload-end -->
  </metadata>
  <!-- 真正的图形元素：<defs>、<g>、<rect>、<path> 等 -->
</svg>
```

要点：

- `<!-- svg-source:excalidraw -->` 是顶层注释，与 metadata 平级。
- `<metadata>` 内部 4 段注释顺序固定：`payload-type` → `payload-version` → `payload-start` → `payload-end`。`payload-start` 和 `payload-end` 之间是 base64 编码的 Excalidraw 场景 JSON（`{"version":1,"encoding":"bstring","compressed":...,"encoded":...}`）。
- `payload-version` 当前固定 `2`。
- 渲染层正常的 `<defs><symbol>...</symbol></defs>` + `<g><use href="#..."/></g>` 仍然保留，离线浏览器一样能看图。

## PNG 嵌入格式

PNG 利用标准 `tEXt` 块写入元数据：

- 关键字：`application/vnd.excalidraw+json`
- 值：base64 编码的场景 JSON（与 SVG 相同结构）

PNG 比 SVG 体积更小但人眼无法直接验证元数据，要查只能解析 PNG chunk。本 skill 默认推荐 SVG。

## 创建 / 写入工作流

不要尝试自己用 CLI 在思源里"创建"一张可编辑 Excalidraw。`siyuan-sisyphus` 不能驱动浏览器内的 Excalidraw 编辑器。下面给的是 CLI 力所能及的两条路：

### 工作流 A：迁移已有 SVG/PNG 到思源

适用：用户在 [excalidraw.com](https://excalidraw.com)、Obsidian Excalidraw、VS Code Excalidraw 等平台已经画好图，导出时勾选了 **Embed scene**。

```bash
# 1. 重命名为 excalidraw- 前缀（缺这步插件不会识别）
cp ~/Downloads/diagram.svg /tmp/excalidraw-diagram-2026.svg

# 2. 上传到思源 assets（confirmation required，需先告知用户）
siyuan-sisyphus file upload-asset \
  --assets-dir-path /assets/ \
  --local-file-path /tmp/excalidraw-diagram-2026.svg \
  --json
# 返回字段：succMap[原文件名] = "assets/excalidraw-diagram-2026-<hash>.svg"
```

注意：

- `file upload-asset` 是 `confirmation required` 动作，且会读本机文件系统，**调用前必须**用一句话告知用户「将上传 `<本地路径>` 到思源 assets」。
- 大于 10 MB 的文件需要追加 `--confirm-large-file`，并在调用前提醒用户。
- 思源会自动给文件名加哈希后缀以避免冲突，`excalidraw-` 前缀仍保留，识别规则成立。

```bash
# 3. 把图片块写到目标文档末尾
DOC_ID=$(siyuan-sisyphus document lookup --notebook <nbId> --hpath "/目录/笔记" 2>&1 | grep -oE '[0-9]{14}-[a-z0-9]{7}' | head -1)
siyuan-sisyphus block append \
  --parent-id "$DOC_ID" \
  --data-type markdown \
  --data "![Excalidraw 图](assets/excalidraw-diagram-2026-<hash>.svg)"
```

### 工作流 B：从场景 JSON 直接合成 SVG 后上传

适用：用户给出 Excalidraw 场景数据（JSON），希望直接落到思源里。这一步 `siyuan-sisyphus` 不参与，只是构造文件后走工作流 A：

1. 用任一 Excalidraw 渲染器（`@excalidraw/utils` 包的 `exportToSvg`，或离线工具）把 JSON 渲染成 SVG。
2. 把 base64 编码的同份 JSON 注入 `<metadata>` 4 段注释里。
3. 文件名用 `excalidraw-` 前缀。
4. 上传，参考工作流 A 步骤 2、3。

不要手写 SVG 形状然后只贴 metadata，那样图像内容和场景数据对不上，下次进 Excalidraw 编辑会被 metadata 覆盖渲染。

## 编辑已嵌入的 Excalidraw 图

`siyuan-sisyphus` 不能直接编辑场景。两种合理出路：

1. **告知用户在思源中操作**：在思源编辑器里点击图像右上角菜单或右键，出现「编辑 Excalidraw」按钮即可弹出 Tab 或 Dialog 编辑。
2. **本地往返编辑**：用 `file get-doc-assets --id <docId> --asset-type image --json` 列出文档使用到的 assets，再用 `file extract-doc --id <docId> --output-path /tmp/extract` 把文档与资源一起抽到本地，本地用 Excalidraw 桌面/网页版打开 SVG 编辑保存，最后通过工作流 A 重新上传（同名覆盖：`file upload-asset` 会改名加哈希，所以要保证不同时间戳，并把旧引用替换为新文件路径）。

```bash
# 列出当前文档的图像资源
siyuan-sisyphus file get-doc-assets --id <docId> --asset-type image --json
```

## 暗黑模式

插件内置一条 CSS：`html[data-theme-mode="dark"] img[src^="assets/"][src*="/excalidraw-"]` 会被加上 `filter: invert(93%) hue-rotate(180deg)`。也就是说**只要文件名包含 `excalidraw-`**，思源暗色主题下会自动反色显示。如果你导入的图本身已经是暗色版，关掉这个滤镜的简便办法是去掉 `excalidraw-` 前缀（但同时也失去编辑能力）。

## 常见错误与排查

| 现象 | 原因 | 修复 |
| --- | --- | --- |
| 图像右上角没有编辑按钮 | 文件名不含 `excalidraw-` 前缀 | 重命名为 `excalidraw-xxx.svg` 后重新 `upload-asset`，并改文档里的图片引用 |
| 编辑按钮存在但点击报错"非 Excalidraw 图像" | 缺少 `application/vnd.excalidraw+json` payload | 重新从 Excalidraw 平台导出，并在导出时勾选「Embed scene」 |
| 上传后文档里图片显示不出 | 路径写错。`upload-asset` 返回 `succMap`，里面的值是 `assets/<新文件名>`，不是 `/assets/...` | 用返回的 `succMap` 值作为 `block append` 中 markdown 的 `![](...)` 的 URL |
| 图像在暗色主题下颜色异常 | 暗色滤镜误命中。所有 `excalidraw-` 前缀图片都被反色 | 接受现状（推荐）或换前缀放弃编辑能力 |
| 多人协作或迁移后编辑能力消失 | 第三方平台导出未勾选 Embed scene | 让作者重新带 metadata 导出，或在 Excalidraw 中把它当作普通图导入后再画一遍 |

## 验证一张 SVG 是否合法 Excalidraw 图

```bash
# 文件名前缀
basename /path/to/x.svg | grep -E '^excalidraw-.+\.(svg|png)$'

# SVG payload（一行命令）
grep -q 'payload-type:application/vnd.excalidraw+json' /path/to/x.svg && echo OK

# 还原 base64 payload 后看 JSON 头几个字段（仅 SVG）
sed -n 's/.*payload-start -->\(.*\)<!-- payload-end.*/\1/p' /path/to/x.svg \
  | base64 -d | head -c 200
```

PNG 没有简单的 grep 办法，需要解析 chunk。`xxd /path/to/x.png | grep -i 'excalidraw'` 能看出大致存在与否。

## 参考资料

- 插件仓库：<https://github.com/YuxinZhaozyx/siyuan-embed-excalidraw>
- Excalidraw 主仓库：<https://github.com/excalidraw/excalidraw>
- 思源 API（assets 上传细节）：<https://github.com/siyuan-note/siyuan/blob/master/API.md>
