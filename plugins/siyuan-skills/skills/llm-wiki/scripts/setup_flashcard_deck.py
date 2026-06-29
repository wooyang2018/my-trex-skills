#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""setup_flashcard_deck.py — 确保 wiki-cards 闪卡牌组存在，并将其 ID
持久化到 ~/.siyuan-wiki/config 的 SIYUAN_FLASHCARD_DECK_ID 字段。

为什么需要这个脚本：
  - siyuan-sisyphus CLI 的 get_decks / create_card / list_cards 等命令
    需要一个已存在的自定义牌组 ID，但 CLI 本身不能创建牌组。
  - SiYuan kernel API createRiffDeck 可以创建牌组，但需要手动拼 curl
    和从 JSON 响应里提取 deck ID，容易出错。
  - 本脚本把「检查存在 → 创建 → 写 config」三步合一，幂等可重复执行。

流程：
  1. 调 siyuan-sisyphus flashcard get_decks 检查 wiki-cards 是否已存在。
  2. 若不存在，读 ~/.siyuan-sisyphus/config.json 拿 API URL + token，
     调 POST /api/riff/createRiffDeck 创建牌组。
  3. 将 deck ID 写入 ~/.siyuan-wiki/config 的 SIYUAN_FLASHCARD_DECK_ID。

CLI:
    python3 setup_flashcard_deck.py [--quiet]

退出码:
    0  成功（牌组就绪，config 已更新）
    1  ~/.siyuan-wiki/config 不存在
    2  SiYuan 不可达 / CLI 错误
    3  牌组创建失败
"""

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

WIKI_CONFIG_PATH = os.path.expanduser("~/.siyuan-wiki/config")
SIYUAN_CONFIG_PATH = os.path.expanduser("~/.siyuan-sisyphus/config.json")
DECK_NAME = "wiki-cards"
CONFIG_KEY = "SIYUAN_FLASHCARD_DECK_ID"


# ── config 读写 ──────────────────────────────────────────────────────

def read_wiki_config():
    """解析 ~/.siyuan-wiki/config 的 key="value" 行，返回 dict。"""
    config = {}
    if not os.path.exists(WIKI_CONFIG_PATH):
        return config
    with open(WIKI_CONFIG_PATH, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r'^([A-Z_]+)="(.*)"$', line)
            if m:
                config[m.group(1)] = m.group(2)
    return config


def write_deck_id_to_config(deck_id):
    """将 SIYUAN_FLASHCARD_DECK_ID 写入或更新到 ~/.siyuan-wiki/config。

    若该 key 已存在则原地替换；不存在则追加到文件末尾。
    """
    lines = []
    found = False

    if os.path.exists(WIKI_CONFIG_PATH):
        with open(WIKI_CONFIG_PATH, "r") as f:
            for line in f:
                stripped = line.strip()
                if stripped.startswith(CONFIG_KEY + "="):
                    lines.append(f'{CONFIG_KEY}="{deck_id}"\n')
                    found = True
                else:
                    lines.append(line)

    if not found:
        lines.append(f'{CONFIG_KEY}="{deck_id}"\n')

    with open(WIKI_CONFIG_PATH, "w") as f:
        f.writelines(lines)


# ── SiYuan 交互 ──────────────────────────────────────────────────────

def get_decks_via_cli():
    """通过 siyuan-sisyphus CLI 列出所有闪卡牌组。"""
    result = subprocess.run(
        ["siyuan-sisyphus", "flashcard", "get_decks", "--json"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"Error: siyuan-sisyphus get_decks failed (exit {result.returncode})",
              file=sys.stderr)
        if result.stderr:
            print(f"  stderr: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(2)
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        print(f"Error: get_decks returned invalid JSON: {e}", file=sys.stderr)
        sys.exit(2)
    return data.get("decks", [])


def get_siyuan_api_info():
    """从 ~/.siyuan-sisyphus/config.json 读取 API URL 和 token。"""
    with open(SIYUAN_CONFIG_PATH, "r") as f:
        config = json.load(f)
    profile = config["profiles"][config["currentProfile"]]
    return profile["apiUrl"], profile.get("token", "")


def create_deck_via_api():
    """通过 SiYuan kernel API createRiffDeck 创建 wiki-cards 牌组。

    返回新创建的 deck ID。使用 urllib，无外部依赖。
    """
    api_url, token = get_siyuan_api_info()

    payload = json.dumps({"name": DECK_NAME}).encode("utf-8")
    req = urllib.request.Request(
        f"{api_url}/api/riff/createRiffDeck",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    if token:
        req.add_header("Authorization", f"Token {token}")

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
    except urllib.error.URLError as e:
        print(f"Error: cannot reach SiYuan API: {e}", file=sys.stderr)
        sys.exit(3)

    if result.get("code") != 0:
        print(f"Error: createRiffDeck failed: {result.get('msg', 'unknown error')}",
              file=sys.stderr)
        sys.exit(3)

    return result["data"]["id"]


# ── 主流程 ───────────────────────────────────────────────────────────

def main():
    quiet = "--quiet" in sys.argv

    # 前置检查：wiki config 必须存在（setup.md 前面的步骤已创建）
    if not os.path.exists(WIKI_CONFIG_PATH):
        print(f"Error: {WIKI_CONFIG_PATH} not found — run wiki setup first.",
              file=sys.stderr)
        sys.exit(1)

    # Step 1: 检查 wiki-cards 牌组是否已存在
    decks = get_decks_via_cli()
    wiki_decks = [d for d in decks if d.get("name") == DECK_NAME]

    if len(wiki_decks) > 1:
        # SiYuan createRiffDeck 不检查重名，可能产生重复牌组
        print(f"Warning: found {len(wiki_decks)} decks named '{DECK_NAME}', "
              f"using the one with the most cards.", file=sys.stderr)
        wiki_decks.sort(key=lambda d: d.get("size", 0), reverse=True)

    if wiki_decks:
        deck_id = wiki_decks[0]["id"]
        card_count = wiki_decks[0].get("size", 0)
        if not quiet:
            print(f"Found existing '{DECK_NAME}' deck: {deck_id} ({card_count} cards)",
                  file=sys.stderr)
    else:
        # Step 2: 牌组不存在，创建
        deck_id = create_deck_via_api()
        if not quiet:
            print(f"Created '{DECK_NAME}' deck: {deck_id}", file=sys.stderr)

    # Step 3: 写入 config
    write_deck_id_to_config(deck_id)
    if not quiet:
        print(f"Updated {WIKI_CONFIG_PATH}: {CONFIG_KEY}=\"{deck_id}\"",
              file=sys.stderr)

    # 最后一行 stdout 始终是 deck ID，方便管道使用
    print(deck_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
