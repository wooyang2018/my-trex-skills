import fs from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

export type DataSourceMode = "siyuan-cli";

export interface ServerConfig {
  mode: DataSourceMode;
  notebookId: string;
  workspaceNotebook: string;
  profile?: string;
  cliTimeoutMs: number;
  cacheTtlMs: number;
  port: number;
  host: string;
  author: string;
}

export function parseArgs(argv: string[]): ServerConfig {
  const fileConfig = readGlobalConfig();
  const args = argv.slice(2);
  let notebookId = fileConfig.SIYUAN_NOTEBOOK_ID ?? "";
  let profile: string | undefined = fileConfig.SIYUAN_PROFILE || undefined;
  let cliTimeoutMs = 15_000;
  let cacheTtlMs = 30_000;
  let port = 4175;
  let host = "127.0.0.1";
  let author = os.userInfo().username || "me";

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    switch (a) {
      case "--notebook-id":
        notebookId = args[++i] ?? "";
        break;
      case "--profile":
        profile = args[++i];
        break;
      case "--cli-timeout-ms":
        cliTimeoutMs = parseInt(args[++i] ?? "15000", 10);
        break;
      case "--cache-ttl-ms":
        cacheTtlMs = parseInt(args[++i] ?? "30000", 10);
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

  if (!notebookId) {
    console.error("error: --notebook-id is required or SIYUAN_NOTEBOOK_ID must be set in ~/.siyuan-wiki/config");
    printHelp();
    process.exit(1);
  }
  if (!Number.isFinite(cliTimeoutMs) || cliTimeoutMs < 1000) {
    console.error("error: --cli-timeout-ms must be at least 1000");
    process.exit(1);
  }
  if (!Number.isFinite(cacheTtlMs) || cacheTtlMs < 0) {
    console.error("error: --cache-ttl-ms must be 0 or greater");
    process.exit(1);
  }

  const workspaceNotebook = resolveWorkspaceNotebook(notebookId, profile, cliTimeoutMs);

  return {
    mode: "siyuan-cli",
    notebookId,
    workspaceNotebook,
    profile,
    cliTimeoutMs,
    cacheTtlMs,
    port,
    host,
    author,
  };
}

function resolveWorkspaceNotebook(notebookId: string, profile: string | undefined, timeoutMs: number): string {
  const args = profile
    ? ["--profile", profile, "notebook", "list", "--json"]
    : ["notebook", "list", "--json"];
  try {
    const stdout = execFileSync("siyuan-sisyphus", args, {
      encoding: "utf-8",
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
    });
    const notebooks = JSON.parse(stdout) as Array<{ id?: string; name?: string }>;
    const notebook = notebooks.find((item) => item.id === notebookId);
    if (!notebook?.name) {
      console.error(`error: notebook id not found in siyuan-sisyphus notebook list: ${notebookId}`);
      process.exit(1);
    }
    return notebook.name;
  } catch (err) {
    console.error(`error: failed to resolve notebook name for ${notebookId}: ${String(err)}`);
    process.exit(1);
  }
}

function readGlobalConfig(): Record<string, string> {
  const configPath = path.join(os.homedir(), ".siyuan-wiki", "config");
  if (!fs.existsSync(configPath)) return {};
  const out: Record<string, string> = {};
  const text = fs.readFileSync(configPath, "utf-8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1]!;
    let value = match[2]!.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function printHelp(): void {
  console.log(`
Usage:
  npm start -- [--notebook-id <id>] [options]

Options:
      --notebook-id <id>     SiYuan notebook id. Defaults to SIYUAN_NOTEBOOK_ID
                             from ~/.siyuan-wiki/config.
      --profile <name>      Optional siyuan-sisyphus profile.
      --cli-timeout-ms <n>  CLI timeout per command (default: 15000).
      --cache-ttl-ms <n>    Tree/registry/graph cache TTL (default: 30000).
  -p, --port                Port to listen on (default: 4175).
      --host                Host to bind to (default: 127.0.0.1).
      --author              Author name written into feedback documents (default: $USER).
  -h, --help                Show this help.
`);
}
