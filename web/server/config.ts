import os from "node:os";

export type DataSourceMode = "siyuan-cli";

export interface ServerConfig {
  mode: DataSourceMode;
  notebookId: string;
  notebookName: string;
  profile?: string;
  cliTimeoutMs: number;
  cacheTtlMs: number;
  port: number;
  host: string;
  author: string;
}

export function parseArgs(argv: string[]): ServerConfig {
  const args = argv.slice(2);
  let notebookId = "";
  let notebookName = "";
  let profile: string | undefined;
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
      case "--notebook-name":
        notebookName = args[++i] ?? "";
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

  if (!notebookId || !notebookName) {
    console.error("error: --notebook-id and --notebook-name are required");
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

  return {
    mode: "siyuan-cli",
    notebookId,
    notebookName,
    profile,
    cliTimeoutMs,
    cacheTtlMs,
    port,
    host,
    author,
  };
}

function printHelp(): void {
  console.log(`
Usage:
  npm start -- --notebook-id <id> --notebook-name <name> [options]

Options:
      --notebook-id <id>     SiYuan notebook id used by query_sql and document lookup.
      --notebook-name <name> SiYuan notebook name used by fs paths.
      --profile <name>      Optional siyuan-sisyphus profile.
      --cli-timeout-ms <n>  CLI timeout per command (default: 15000).
      --cache-ttl-ms <n>    Tree/registry/graph cache TTL (default: 30000).
  -p, --port                Port to listen on (default: 4175).
      --host                Host to bind to (default: 127.0.0.1).
      --author              Author name written into feedback documents (default: $USER).
  -h, --help                Show this help.
`);
}
