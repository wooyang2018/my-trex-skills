import path from "node:path";
import fs from "node:fs";
import os from "node:os";

export type DataSourceMode = "local" | "siyuan";

export interface ServerConfig {
  /** 本地模式：wiki 根目录路径。思源模式下为 null。 */
  wikiRoot: string | null;
  /** 数据源模式 */
  mode: DataSourceMode;
  /** 思源 API 地址（仅 siyuan 模式） */
  siyuanApi?: string;
  /** 思源笔记本 ID（仅 siyuan 模式） */
  siyuanNotebook?: string;
  /** 思源 API token（可选） */
  siyuanToken?: string;
  port: number;
  host: string;
  author: string;
}

export function parseArgs(argv: string[]): ServerConfig {
  const args = argv.slice(2);
  let wikiRoot: string | null = null;
  let port = 4175;
  let host = "127.0.0.1";
  let author = os.userInfo().username || "me";

  // SiYuan 模式参数
  let mode: DataSourceMode = "local";
  let siyuanApi: string | undefined;
  let siyuanNotebook: string | undefined;
  let siyuanToken: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    switch (a) {
      case "--wiki":
      case "-w":
        wikiRoot = args[++i] ?? null;
        break;
      case "--port":
      case "-p":
        port = parseInt(args[++i] ?? "4175", 10);
        break;
      case "--host":
        host = args[++i] ?? host;
        break;
      case "--author":
        author = args[++i] ?? author;
        break;
      // ── SiYuan 模式 ────────────────────────────────────────────────────
      case "--siyuan":
        mode = "siyuan";
        break;
      case "--siyuan-api":
        siyuanApi = args[++i];
        break;
      case "--siyuan-notebook":
        siyuanNotebook = args[++i];
        break;
      case "--siyuan-token":
        siyuanToken = args[++i];
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        if (a.startsWith("--")) {
          console.error(`unknown flag: ${a}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  // ── 验证 ──────────────────────────────────────────────────────────────

  if (mode === "siyuan") {
    if (!siyuanApi) {
      console.error("error: --siyuan-api <url> is required in siyuan mode");
      printHelp();
      process.exit(1);
    }
    if (!siyuanNotebook) {
      console.error("error: --siyuan-notebook <id> is required in siyuan mode");
      printHelp();
      process.exit(1);
    }
    // 思源模式下 wikiRoot 不需要，但审计功能暂不可用
    return {
      wikiRoot: null,
      mode,
      siyuanApi,
      siyuanNotebook,
      siyuanToken,
      port,
      host,
      author,
    };
  }

  // ── 本地模式验证 ──────────────────────────────────────────────────────

  if (!wikiRoot) {
    console.error("error: --wiki <root> is required (or use --siyuan mode)");
    printHelp();
    process.exit(1);
  }

  const resolved = path.resolve(wikiRoot);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    console.error(`error: wiki root does not exist or is not a directory: ${resolved}`);
    process.exit(1);
  }

  return { wikiRoot: resolved, mode, port, host, author };
}

function printHelp(): void {
  console.log(`
Usage:
  npm start -- --wiki <wiki-root> [options]
  npm start -- --siyuan --siyuan-api <url> --siyuan-notebook <id> [options]

Options:
  -w, --wiki             Path to the wiki root (local mode, required).
                         Should contain a 'wiki/' and 'audit/' folder.

  --siyuan               Enable SiYuan mode (direct API access, no files needed).
  --siyuan-api <url>     SiYuan HTTP API URL (e.g. http://localhost:6806).
  --siyuan-notebook <id> SiYuan notebook ID.
  --siyuan-token <tok>   SiYuan API token (optional, for auth-enabled instances).

  -p, --port             Port to listen on (default: 4175).
      --host             Host to bind to (default: 127.0.0.1 — local only).
      --author           Author name written into feedback files (default: $USER).
  -h, --help             Show this help.
`);
}
