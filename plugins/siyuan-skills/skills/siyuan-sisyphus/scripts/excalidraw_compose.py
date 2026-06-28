#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""excalidraw_compose.py — 把一份 Excalidraw elements JSON 封装成
思源 siyuan-embed-excalidraw 插件可编辑的 SVG。

调用方（通常是 LLM/Agent）只负责想清楚要画什么，把 elements 数组落到一份
JSON 文件里，然后调本脚本即可拿到一个可上传到思源的 .svg 文件。

CLI:
    python3 excalidraw_compose.py \\
        --scene-json /tmp/red-apple.scene.json \\
        --output     /tmp/excalidraw-red-apple.svg

输入 JSON 接受两种形式：
  形式 A —— 完整 scene 对象（elements 数组在 scene.elements）::

      {
        "type": "excalidraw",
        "version": 2,
        "source": "https://excalidraw.com",
        "elements": [ ... ],
        "appState": { "viewBackgroundColor": "#ffffff" },
        "files": {}
      }

  形式 B —— 直接传 elements 数组::

      [
        {"type": "ellipse", "x": 100, "y": 120, "width": 160, "height": 150,
         "strokeColor": "#c92a2a", "backgroundColor": "#fa5252",
         "fillStyle": "solid"},
        ...
      ]

  形式 B 时脚本会用默认 appState 与 source 自动包成完整 scene。

每个 element 至少需要 type / x / y / width / height （文字元素需 text）。
其它字段（id / seed / versionNonce / strokeStyle / roughness / opacity /
groupIds / boundElements / frameId / isDeleted / locked / updated / link /
roundness / angle / version 等）脚本会补默认值。

支持的 element type：rectangle / diamond / ellipse / line / arrow /
freedraw / text。其它类型（image / iframe / embeddable / frame / magicframe）
脚本不渲染 SVG body 但仍会写进 metadata（思源里点编辑按钮可继续编辑）。

stdout 输出一行 JSON::

    {"output":"...","size":12345,"elements":3,"selfcheck_ok":true}

selfcheck_ok=true 表示脚本写完后又把自己生成的 SVG 反向 inflate 出 scene、
确认 elements 数与输入一致；为 false 时脚本以非零状态码退出。

文件名约定：basename **必须**以 ``excalidraw-`` 开头，否则
siyuan-embed-excalidraw 不会识别为可编辑图，脚本会输出警告（仍写文件）。
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import random
import sys
import zlib
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape as xml_escape

# ---------------------------------------------------------------------------
# 默认值与工具
# ---------------------------------------------------------------------------

_DEFAULT_SOURCE = "https://excalidraw.com"
_DEFAULT_APPSTATE: dict[str, Any] = {
    "gridSize": None,
    "gridStep": 5,
    "gridModeEnabled": False,
    "viewBackgroundColor": "#ffffff",
}
_ELEMENT_DEFAULTS: dict[str, Any] = {
    "angle": 0,
    "strokeColor": "#1e1e1e",
    "backgroundColor": "transparent",
    "fillStyle": "solid",
    "strokeWidth": 2,
    "strokeStyle": "solid",
    "roughness": 1,
    "opacity": 100,
    "groupIds": [],
    "frameId": None,
    "roundness": None,
    "boundElements": None,
    "updated": 1,
    "link": None,
    "locked": False,
    "isDeleted": False,
}
_RENDERABLE_TYPES = {
    "rectangle", "diamond", "ellipse",
    "line", "arrow", "freedraw", "text",
}


def _stable_id(seed_str: str) -> str:
    """根据内容指纹生成稳定 id，便于 LLM 重跑同一份 JSON 得到一致 SVG。"""
    return hashlib.sha1(seed_str.encode("utf-8")).hexdigest()[:16]


def _stable_int(seed_str: str, mod: int = 2**31) -> int:
    return int(hashlib.sha1(seed_str.encode("utf-8")).hexdigest(), 16) % mod


def _normalize_elements(raw_elements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """补齐 Excalidraw element 必需字段，保持调用方原值优先。"""
    normalized: list[dict[str, Any]] = []
    for idx, src in enumerate(raw_elements):
        if not isinstance(src, dict):
            raise ValueError(f"element[{idx}] is not an object: {src!r}")
        if "type" not in src:
            raise ValueError(f"element[{idx}] missing required 'type'")

        e = dict(_ELEMENT_DEFAULTS)
        e.update(src)  # caller 值覆盖默认

        seed_basis = json.dumps(src, sort_keys=True, ensure_ascii=False) + f"|{idx}"
        e.setdefault("id", _stable_id(seed_basis))
        e.setdefault("seed", _stable_int(seed_basis + "|seed"))
        e.setdefault("version", 1)
        e.setdefault("versionNonce", _stable_int(seed_basis + "|nonce"))
        e.setdefault("x", 0)
        e.setdefault("y", 0)
        e.setdefault("width", 0)
        e.setdefault("height", 0)

        if e["type"] == "text":
            e.setdefault("text", "")
            e.setdefault("fontSize", 20)
            e.setdefault("fontFamily", 1)  # 1=Virgil, 2=Helvetica, 3=Cascadia
            e.setdefault("textAlign", "left")
            e.setdefault("verticalAlign", "top")
            e.setdefault("baseline", e.get("fontSize", 20))
            e.setdefault("containerId", None)
            e.setdefault("originalText", e["text"])
            e.setdefault("autoResize", True)
            e.setdefault("lineHeight", 1.25)

        if e["type"] in {"line", "arrow", "freedraw"}:
            # 这些类型必须有 points（相对 x/y）
            if "points" not in e or not e["points"]:
                # 默认两点：起点到 (width,height)
                e["points"] = [[0, 0], [e["width"], e["height"]]]
            e.setdefault("lastCommittedPoint", None)
            if e["type"] == "arrow":
                e.setdefault("startBinding", None)
                e.setdefault("endBinding", None)
                e.setdefault("startArrowhead", None)
                e.setdefault("endArrowhead", "arrow")
                e.setdefault("elbowed", False)
            if e["type"] == "freedraw":
                e.setdefault("pressures", [])
                e.setdefault("simulatePressure", True)

        normalized.append(e)
    return normalized


def _build_scene(scene_or_elements: Any) -> dict[str, Any]:
    """把输入归一化成完整 scene 对象。"""
    if isinstance(scene_or_elements, list):
        elements = scene_or_elements
        appState = dict(_DEFAULT_APPSTATE)
        source = _DEFAULT_SOURCE
        files: dict[str, Any] = {}
    elif isinstance(scene_or_elements, dict):
        if "elements" not in scene_or_elements:
            raise ValueError("scene object missing 'elements' field")
        elements = scene_or_elements["elements"]
        appState = {**_DEFAULT_APPSTATE, **(scene_or_elements.get("appState") or {})}
        source = scene_or_elements.get("source") or _DEFAULT_SOURCE
        files = scene_or_elements.get("files") or {}
    else:
        raise ValueError(
            "scene JSON must be either an elements array or a scene object"
        )

    if not isinstance(elements, list):
        raise ValueError("'elements' must be an array")

    return {
        "type": "excalidraw",
        "version": 2,
        "source": source,
        "elements": _normalize_elements(elements),
        "appState": appState,
        "files": files,
    }


# ---------------------------------------------------------------------------
# Payload 编码（zlib + latin-1 + base64）
# ---------------------------------------------------------------------------


def _encode_payload(scene: dict[str, Any]) -> str:
    """生成 SVG 内 <!-- payload-start -->...<!-- payload-end --> 之间那串 base64。

    复刻 @excalidraw/excalidraw 0.18.0 的 encode 流程：
    1. JSON 序列化（紧凑，无空格）
    2. zlib.deflate（默认 wbits=15，对应 zlib 头 0x78 0x9c）
    3. 字节按 latin-1 解为字符串（每字节 -> 0-255 单字符），塞到
       outer JSON 的 "encoded" 字段
    4. outer JSON: {"version":"1","encoding":"bstring","compressed":true,"encoded":"..."}
    5. outer JSON 整体按 latin-1 转回字节，再 base64
    """
    inner_bytes = json.dumps(scene, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    deflated = zlib.compress(inner_bytes)  # 默认级别等价于 Excalidraw 里的 deflate
    encoded_str = deflated.decode("latin-1")  # 1byte -> 1char

    outer = {
        "version": "1",
        "encoding": "bstring",
        "compressed": True,
        "encoded": encoded_str,
    }
    # ensure_ascii=False 保留 latin-1 字节，再用 latin-1 转回 bytes
    outer_text = json.dumps(outer, ensure_ascii=False, separators=(",", ":"))
    outer_bytes = outer_text.encode("latin-1")
    return base64.b64encode(outer_bytes).decode("ascii")


def _decode_payload(b64: str) -> dict[str, Any]:
    """反向校验：base64 -> latin-1 outer JSON -> latin-1 deflate bytes -> scene。"""
    outer_text = base64.b64decode(b64).decode("latin-1")
    outer = json.loads(outer_text)
    raw = outer["encoded"].encode("latin-1")
    return json.loads(zlib.decompress(raw).decode("utf-8"))


# ---------------------------------------------------------------------------
# SVG body：极简几何渲染（非手绘风），只为非思源场景预览
# ---------------------------------------------------------------------------


def _bbox(elements: list[dict[str, Any]]) -> tuple[float, float, float, float]:
    if not elements:
        return (0.0, 0.0, 400.0, 300.0)
    xs1, ys1, xs2, ys2 = [], [], [], []
    for e in elements:
        x, y = float(e.get("x", 0)), float(e.get("y", 0))
        w, h = float(e.get("width", 0)), float(e.get("height", 0))
        xs1.append(x); ys1.append(y)
        xs2.append(x + w); ys2.append(y + h)
    pad = 20.0
    return (min(xs1) - pad, min(ys1) - pad,
            max(xs2) - min(xs1) + 2 * pad,
            max(ys2) - min(ys1) + 2 * pad)


def _svg_attrs(e: dict[str, Any]) -> str:
    stroke = xml_escape(str(e.get("strokeColor", "#1e1e1e")))
    fill = e.get("backgroundColor") or "transparent"
    if fill == "transparent":
        fill_attr = "fill=\"none\""
    else:
        fill_attr = f"fill=\"{xml_escape(str(fill))}\""
    sw = float(e.get("strokeWidth", 2))
    opacity = float(e.get("opacity", 100)) / 100.0
    style = e.get("strokeStyle", "solid")
    dash = ""
    if style == "dashed":
        dash = " stroke-dasharray=\"8,4\""
    elif style == "dotted":
        dash = " stroke-dasharray=\"2,4\""
    return (
        f"stroke=\"{stroke}\" stroke-width=\"{sw}\" {fill_attr} "
        f"opacity=\"{opacity:.3f}\"{dash}"
    )


def _render_element(e: dict[str, Any]) -> str:
    t = e["type"]
    x, y = float(e.get("x", 0)), float(e.get("y", 0))
    w, h = float(e.get("width", 0)), float(e.get("height", 0))
    angle = float(e.get("angle", 0))
    transform = ""
    if angle:
        cx, cy = x + w / 2, y + h / 2
        deg = angle * 180 / 3.141592653589793
        transform = f" transform=\"rotate({deg:.3f} {cx:.3f} {cy:.3f})\""

    if t == "rectangle":
        return (
            f"<rect x=\"{x}\" y=\"{y}\" width=\"{w}\" height=\"{h}\" "
            f"{_svg_attrs(e)}{transform}/>"
        )
    if t == "diamond":
        cx, cy = x + w / 2, y + h / 2
        pts = f"{cx},{y} {x+w},{cy} {cx},{y+h} {x},{cy}"
        return f"<polygon points=\"{pts}\" {_svg_attrs(e)}{transform}/>"
    if t == "ellipse":
        rx, ry = w / 2, h / 2
        cx, cy = x + rx, y + ry
        return (
            f"<ellipse cx=\"{cx}\" cy=\"{cy}\" rx=\"{rx}\" ry=\"{ry}\" "
            f"{_svg_attrs(e)}{transform}/>"
        )
    if t in {"line", "arrow", "freedraw"}:
        pts = e.get("points") or [[0, 0], [w, h]]
        d_pts = " ".join(f"{x+float(p[0])},{y+float(p[1])}" for p in pts)
        marker = ""
        if t == "arrow" and e.get("endArrowhead"):
            marker = " marker-end=\"url(#exc-arrow)\""
        return f"<polyline points=\"{d_pts}\" fill=\"none\" {_svg_attrs(e)}{marker}{transform}/>"
    if t == "text":
        text = xml_escape(str(e.get("text", "")))
        size = float(e.get("fontSize", 20))
        color = xml_escape(str(e.get("strokeColor", "#1e1e1e")))
        # 用 dominant-baseline=hanging 让 (x,y) 视为左上角
        lines = text.split("\n")
        tspans = "".join(
            f"<tspan x=\"{x}\" dy=\"{0 if i == 0 else size*1.25}\">{line}</tspan>"
            for i, line in enumerate(lines)
        )
        return (
            f"<text x=\"{x}\" y=\"{y}\" font-family=\"Helvetica, Arial, sans-serif\" "
            f"font-size=\"{size}\" fill=\"{color}\" "
            f"dominant-baseline=\"hanging\"{transform}>{tspans}</text>"
        )
    # 不支持的类型先不渲染（仍保留在 metadata 里供思源编辑）
    return f"<!-- unsupported element type: {xml_escape(t)} -->"


def _render_svg_body(elements: list[dict[str, Any]], bg: str) -> tuple[str, tuple[float, float, float, float]]:
    bbox = _bbox(elements)
    minx, miny, vw, vh = bbox
    parts = [
        "<defs>",
        "  <marker id=\"exc-arrow\" viewBox=\"0 0 10 10\" refX=\"9\" refY=\"5\""
        " markerWidth=\"6\" markerHeight=\"6\" orient=\"auto-start-reverse\">",
        "    <path d=\"M0,0 L10,5 L0,10 z\" fill=\"context-stroke\"/>",
        "  </marker>",
        "</defs>",
    ]
    if bg and bg != "transparent":
        parts.append(
            f"<rect x=\"{minx}\" y=\"{miny}\" width=\"{vw}\" height=\"{vh}\" "
            f"fill=\"{xml_escape(bg)}\"/>"
        )
    for e in elements:
        if e.get("isDeleted"):
            continue
        if e["type"] not in _RENDERABLE_TYPES:
            continue
        parts.append(_render_element(e))
    return "\n  ".join(parts), bbox


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------


def compose_svg(scene_input: Any) -> tuple[bytes, dict[str, Any]]:
    scene = _build_scene(scene_input)
    payload_b64 = _encode_payload(scene)

    # selfcheck：反向 inflate
    decoded_scene = _decode_payload(payload_b64)
    selfcheck_ok = (
        decoded_scene.get("type") == "excalidraw"
        and len(decoded_scene.get("elements", [])) == len(scene["elements"])
    )

    body, (minx, miny, vw, vh) = _render_svg_body(
        scene["elements"], scene["appState"].get("viewBackgroundColor", "#ffffff")
    )

    # metadata 注释必须全部挤在一行：复刻上游 default.json 的格式，
    # 兼容那些用 `<!-- payload-start -->(.*?)<!-- payload-end -->` 单行
    # 正则匹配的 SVG parser。
    metadata = (
        "<metadata>"
        "<!-- payload-type:application/vnd.excalidraw+json -->"
        "<!-- payload-version:2 -->"
        f"<!-- payload-start -->{payload_b64}<!-- payload-end -->"
        "</metadata>"
    )
    svg_text = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        f"<svg xmlns=\"http://www.w3.org/2000/svg\" "
        f"viewBox=\"{minx} {miny} {vw} {vh}\" "
        f"width=\"{vw:.0f}\" height=\"{vh:.0f}\">\n"
        f"  {metadata}\n"
        f"  {body}\n"
        "</svg>\n"
    )
    info = {
        "elements": len(scene["elements"]),
        "viewBackgroundColor": scene["appState"].get("viewBackgroundColor"),
        "selfcheck_ok": selfcheck_ok,
    }
    return svg_text.encode("utf-8"), info


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Compose a SiYuan-editable Excalidraw SVG from a scene/elements JSON. "
            "The Agent supplies the JSON; this script handles the bstring payload "
            "encoding plus a basic geometric SVG body."
        ),
    )
    parser.add_argument(
        "--scene-json", required=True,
        help="Path to a JSON file containing either a full scene object or an elements array.",
    )
    parser.add_argument(
        "--output", required=True,
        help="Output .svg path (basename should start with 'excalidraw-').",
    )
    args = parser.parse_args(argv)

    src_path = Path(args.scene_json)
    if not src_path.exists():
        print(f"[error] scene-json not found: {src_path}", file=sys.stderr)
        return 2
    try:
        scene_input = json.loads(src_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"[error] invalid JSON in {src_path}: {exc}", file=sys.stderr)
        return 2

    try:
        svg_bytes, info = compose_svg(scene_input)
    except ValueError as exc:
        print(f"[error] {exc}", file=sys.stderr)
        return 2

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(svg_bytes)

    if not out.name.startswith("excalidraw-"):
        print(
            f"[warn] basename '{out.name}' does not start with 'excalidraw-'; "
            "siyuan-embed-excalidraw will skip this file.",
            file=sys.stderr,
        )

    summary = {
        "output": str(out.resolve()),
        "size": len(svg_bytes),
        "elements": info["elements"],
        "viewBackgroundColor": info["viewBackgroundColor"],
        "selfcheck_ok": info["selfcheck_ok"],
    }
    print(json.dumps(summary, ensure_ascii=False))
    return 0 if info["selfcheck_ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
