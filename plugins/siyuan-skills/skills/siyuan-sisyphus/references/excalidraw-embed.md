# 嵌入 Excalidraw 矢量图

适用场景：用户希望由 Agent 在思源文档中**新画**一张可继续编辑的 Excalidraw 矢量图（"画一只红苹果""画一个登录流程图"等）。本文档假设用户已安装思源「嵌入式系列 - Excalidraw」插件（`siyuan-embed-excalidraw`，作者 Yuxin Zhao）。

核心机制：Excalidraw 的场景数据被无损编码进 SVG `<metadata>` 注释。所以一张普通看起来的 SVG，**既能被任意阅读器渲染，又能被 Excalidraw 重新打开继续编辑**——脱离思源后（导出 markdown / 分享出去）图像本身依旧可独立查看。

## 识别规则（务必先读）

插件依靠**文件名前缀** + **元数据**两道闸来识别可编辑的 Excalidraw 图：

1. 文件名必须匹配正则 `^assets/(?:.+/)?excalidraw-.+\.svg$`。也就是说 `assets/` 下任意层级里、文件名以 `excalidraw-` 开头、扩展名 `svg` 才会显示编辑按钮。
2. 文件内容必须包含 `application/vnd.excalidraw+json` 的 payload。

只满足前者会出现编辑按钮但报错；只满足后者插件根本不识别。本 skill 推送时**必须**两者都给到位。skill 内置的 `scripts/excalidraw_compose.py` 自动满足条件 2；条件 1 由 `--output` 参数的文件名负责，basename 不以 `excalidraw-` 开头脚本会输出 `[warn]`。

> 插件也支持 `.png` 扩展名（PNG 通过 `tEXt` chunk 携带场景），但本 skill 的脚本只输出 SVG。SVG 体积可控、可直接 grep 验证、且是插件作者 default.json 使用的格式。

## SVG 嵌入格式（可直接 grep 验证）

SVG 把场景数据放在根 `<svg>` 下的 `<metadata>` 元素里，用 3 段 HTML 注释包裹：

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="..." width="..." height="...">
  <metadata><!-- payload-type:application/vnd.excalidraw+json --><!-- payload-version:2 --><!-- payload-start -->BASE64_OF_OUTER_JSON<!-- payload-end --></metadata>
  <!-- 真正的图形元素：<rect>、<ellipse>、<text> 等 -->
</svg>
```

`payload-start` 和 `payload-end` 之间那串 base64 解码后是一个 outer JSON：

```json
{"version":"1","encoding":"bstring","compressed":true,"encoded":"<bstring>"}
```

`encoded` 字段是 **zlib 压缩后的字节按 latin-1 1对1 还原成字符串**（不是普通 base64！）。把它再用 latin-1 还原成字节、`zlib.decompress`、`utf-8` 解码，才能拿到真正的 Excalidraw scene JSON：

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [ /* ... 一个个图形 ... */ ],
  "appState": { "viewBackgroundColor": "#ffffff", "gridSize": null, "gridStep": 5, "gridModeEnabled": false },
  "files": {}
}
```

要点：

- `<metadata>` 内部三段注释最好挤在一行（复刻插件作者 default.json 的格式）。多行也能工作，但少数 SVG parser 用单行正则 `<!-- payload-start -->(.*?)<!-- payload-end -->` 匹配，单行最稳。
- `payload-version` 当前固定 `"2"`。
- `<svg>` 里的图形元素只是给非思源场景下的预览看的——思源里点编辑按钮时，Excalidraw 是从 metadata 反序列化重建场景，**不读 SVG body**。这意味着 body 长什么样不影响"可编辑性"。
- `siyuan-embed-excalidraw` 的 MIME 校验只判断整张 SVG 文件 base64 后是否包含字面串 `application/vnd.excalidraw+json`，所以 payload-type 注释不能省。

以上格式细节由 `scripts/excalidraw_compose.py` 自动满足；写在这里是给需要排查问题或升级脚本的开发者看的，不是给 Agent 当作"手拼指南"。

## 创建写入工作流

`siyuan-sisyphus` 不能驱动浏览器内 Excalidraw 编辑器，但可以让 Agent 想清楚要画什么、把 **elements 数组**写成 JSON，再用 skill 内置脚本把 JSON 封装成可编辑 SVG。

**总流程（必须按顺序）**：

1. Agent 想清楚 elements，写到一份 JSON 文件
2. 跑 `scripts/excalidraw_compose.py` → 输出 SVG（含 metadata + 几何 SVG body）
3. `file upload-asset` 上传到思源 assets
4. `block append/update` 在文档里引用 `assets/excalidraw-xxx.svg`

```bash
# 1. Agent 写 elements JSON
cat > /tmp/red-apple.scene.json <<'JSON'
[
  {"type":"ellipse","x":120,"y":160,"width":200,"height":200,
   "strokeColor":"#c92a2a","backgroundColor":"#fa5252","fillStyle":"solid","strokeWidth":3},
  {"type":"rectangle","x":210,"y":120,"width":12,"height":50,
   "strokeColor":"#5c3a21","backgroundColor":"#8b5a2b","fillStyle":"solid","strokeWidth":2,"angle":0.15},
  {"type":"ellipse","x":225,"y":110,"width":80,"height":40,
   "strokeColor":"#2f9e44","backgroundColor":"#69db7c","fillStyle":"solid","strokeWidth":2,"angle":-0.4},
  {"type":"text","x":160,"y":380,"width":140,"height":30,
   "text":"red apple","fontSize":24,"strokeColor":"#212529"}
]
JSON

# 2. 封装为可编辑 SVG（脚本会自动补全 id/seed/version 等必需字段；自检反向 inflate 通过才退 0）
python3 ${SKILL_DIR}/scripts/excalidraw_compose.py \
  --scene-json /tmp/red-apple.scene.json \
  --output     /tmp/excalidraw-red-apple.svg
# stdout: {"output":"/tmp/excalidraw-red-apple.svg","size":2678,"elements":4,
#          "viewBackgroundColor":"#ffffff","selfcheck_ok":true}

# 3. 自检通过后再上传（confirmation required，提前告知用户上传路径）
siyuan-sisyphus file upload-asset \
  --assets-dir-path /assets/ \
  --local-file-path /tmp/excalidraw-red-apple.svg \
  --json
# 返回字段：succMap[原文件名] = "assets/excalidraw-red-apple-<时间>-<hash>.svg"

# 4. 把图片块写到目标文档
DOC_ID=$(siyuan-sisyphus document lookup --notebook <nbId> --hpath "/目录/笔记" 2>&1 | grep -oE '[0-9]{14}-[a-z0-9]{7}' | head -1)
siyuan-sisyphus block append \
  --parent-id "$DOC_ID" \
  --data-type markdown \
  --data "![红苹果](assets/excalidraw-red-apple-<时间>-<hash>.svg)"
```

注意：

- `file upload-asset` 是 `confirmation required` 动作，**调用前必须**用一句话告知用户「将上传 `<本地路径>` 到思源 assets」。
- 大于 10 MB 的文件需要追加 `--confirm-large-file`，并在调用前提醒用户。
- 思源会自动给文件名加哈希后缀以避免冲突，`excalidraw-` 前缀仍保留，识别规则成立。
- `block append` 中 markdown 的 `![](...)` URL **必须**用 `succMap` 返回的值（形如 `assets/excalidraw-xxx-<hash>.svg`），不要写成 `/assets/...`。

### 脚本输入约定（Agent 必读）

输入 JSON 接受两种形式，**任选其一**：

形式 A —— 完整 scene 对象（如果你需要自定义 `appState`、背景色、`source` 等）：

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "appState": { "viewBackgroundColor": "#fff8e7" },
  "files": {},
  "elements": [ ... ]
}
```

形式 B —— 直接是 elements 数组（最常用，appState 用默认白底）：

```json
[
  {"type":"rectangle","x":50,"y":50,"width":120,"height":80, "strokeColor":"#1971c2","backgroundColor":"#a5d8ff","fillStyle":"solid"}
]
```

每个 element 至少要有 `type` + `x` + `y` + `width` + `height`（`text` 多一个 `text`，`line/arrow/freedraw` 可加 `points`）。其它字段（`id` `seed` `version` `versionNonce` `groupIds` `frameId` `boundElements` `roundness` `isDeleted` `locked` `link` `updated` `strokeStyle` `roughness` `opacity` `angle`）脚本会用合理默认补齐。

**支持的 element type**：

| type | 用途 | 必需字段（除 type/x/y/width/height） |
| --- | --- | --- |
| `rectangle` | 矩形 | — |
| `diamond` | 菱形 | — |
| `ellipse` | 椭圆 / 圆 | — |
| `line` | 直线 / 折线 | `points`（可选，默认起止两点） |
| `arrow` | 箭头 | `points`（可选）；`endArrowhead` 默认 `arrow` |
| `freedraw` | 手绘曲线 | `points` |
| `text` | 文本 | `text` |

颜色用十六进制 `#rrggbb`；填充风格 `fillStyle` 可选 `hachure` / `cross-hatch` / `solid`（脚本几何 body 把 hachure/cross-hatch 也按 solid 渲染，但思源里点编辑按钮后 Excalidraw 会按真实风格重绘）。`angle` 单位是弧度，不是度。

### 自检约定

脚本生成 SVG 后会立刻反向 inflate 出 scene 自检：

- `selfcheck_ok=true`：scene type 正确、elements 数与输入一致 → 退码 0
- `selfcheck_ok=false`：编码出的 payload 解不出来 → 退码 1，**不要**继续上传

stderr 还可能输出 `[warn] basename ... does not start with 'excalidraw-'` —— Agent 收到这条警告必须立刻改文件名重跑，否则插件不识别。

### 编辑闭环

Agent 写好的图上传后，用户在思源点图右上角"编辑 Excalidraw"按钮即可进入 Excalidraw 编辑器，里面会显示 Agent 画的几何形状（注意：思源里看到的是 Excalidraw 真实手绘风格，比脚本几何 body 多了抖动质感，这是 Excalidraw 自己的渲染层做的，与脚本无关）。用户编辑保存后插件会**自动覆盖**同一张 svg，文件名仍以 `excalidraw-` 开头，编辑能力保留。

如需 Agent 调整已上传的图：重新写 JSON、生成新 SVG、上传（思源会改名加新哈希）、用 `block update` 把旧图块的 markdown 改成新 URL。`siyuan-sisyphus` 不能直接编辑场景。

### 禁止事项

- 不要 Agent 自己手拼 `<metadata>` 注释和 base64 payload。`encoded` 字段不是普通 base64 而是 zlib + latin-1 字符串，肉眼拼极易拼成 `encoded:"{}"`：MIME 校验通过、点编辑后 Excalidraw 反序列化得到空 elements，画布空白。**必须**走脚本。
- 不要用任何 Node/Excalidraw 包替代脚本路径——当前环境通常没有这些依赖；这套 Python + 标准库流程是 zero-dep 的。
- 不要修改脚本里的 `_encode_payload` 编码顺序：`json → utf-8 → zlib → latin-1 → 塞 outer.encoded → outer json → latin-1 → base64`。任何一步换编码都会导致思源里打开报错。

## 暗黑模式

插件内置一条 CSS：`html[data-theme-mode="dark"] img[src^="assets/"][src*="/excalidraw-"]` 会被加上 `filter: invert(93%) hue-rotate(180deg)`。也就是说**只要文件名包含 `excalidraw-`**，思源暗色主题下会自动反色显示。脚本生成的图都是白底浅色风格，反色后在暗色主题下会变深底，效果良好；如果 Agent 故意为暗色主题画了深底图，反色后会变浅底——这是已知 trade-off，没法绕过（去掉 `excalidraw-` 前缀就同时失去编辑能力）。

## 常见错误与排查

| 现象 | 原因 | 修复 |
| --- | --- | --- |
| 图像右上角没有编辑按钮 | 文件名不含 `excalidraw-` 前缀 | 用脚本时检查 `--output` basename；上传后用 `succMap` 返回的路径，不要手改 |
| 编辑按钮存在但点击报错"非 Excalidraw 图像" | 缺少 `application/vnd.excalidraw+json` payload | 不应出现：脚本必带此 payload。若出现说明 SVG 被外部程序改写过，重新跑脚本即可 |
| 编辑按钮存在、点击后画布空白或弹错 | 内嵌 payload 通过了 MIME 校验但 `encoded` 字段不是合法压缩 bstring（例如 Agent 试图绕过脚本手拼） | 走脚本重生成；脚本 `selfcheck_ok=false` 时不要继续上传 |
| 上传后文档里图片显示不出 | 路径写错。`upload-asset` 返回 `succMap`，里面的值是 `assets/<新文件名>`，不是 `/assets/...` | 用返回的 `succMap` 值作为 `block append` 中 markdown 的 `![](...)` 的 URL |
| 暗色主题下颜色看起来奇怪 | 暗色滤镜对所有 `excalidraw-` 前缀图都生效；如 Agent 主动用了深底反色后会变浅 | 默认让脚本走白底（`viewBackgroundColor:"#ffffff"`），不要为暗色主题专门画深底图 |

## 参考资料

- 插件仓库：<https://github.com/YuxinZhaozyx/siyuan-embed-excalidraw>
- Excalidraw 主仓库：<https://github.com/excalidraw/excalidraw>
- 思源 API（assets 上传细节）：<https://github.com/siyuan-note/siyuan/blob/master/API.md>
