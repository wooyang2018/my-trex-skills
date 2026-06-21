import { execFile } from "node:child_process";

export interface SiyuanCliOptions {
  profile?: string;
  timeoutMs: number;
}

export class SiyuanCliError extends Error {
  constructor(
    message: string,
    readonly args: readonly string[],
    readonly stdout: string,
    readonly stderr: string,
  ) {
    super(message);
    this.name = "SiyuanCliError";
  }
}

export class SiyuanCli {
  constructor(private readonly opts: SiyuanCliOptions) {}

  run(args: string[]): Promise<string> {
    const fullArgs = this.opts.profile ? ["--profile", this.opts.profile, ...args] : args;
    return new Promise((resolve, reject) => {
      execFile(
        "siyuan-sisyphus",
        fullArgs,
        {
          timeout: this.opts.timeoutMs,
          maxBuffer: 16 * 1024 * 1024,
        },
        (err, stdout, stderr) => {
          const out = stdout.toString();
          const errOut = stderr.toString();
          if (err) {
            const timedOut = "killed" in err && err.killed;
            const msg = timedOut
              ? `siyuan-sisyphus timed out after ${this.opts.timeoutMs}ms`
              : `siyuan-sisyphus failed: ${err.message}`;
            reject(new SiyuanCliError(msg, fullArgs, out, errOut));
            return;
          }
          resolve(out);
        },
      );
    });
  }

  async json<T>(args: string[]): Promise<T> {
    const stdout = await this.run(args);
    try {
      return JSON.parse(stdout) as T;
    } catch {
      const sliced = sliceJson(stdout);
      if (sliced) return JSON.parse(sliced) as T;
      throw new SiyuanCliError("siyuan-sisyphus did not return JSON", args, stdout, "");
    }
  }

  async dataArray<T>(args: string[]): Promise<T[]> {
    const value = await this.json<unknown>(args);
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
      return (value as { data: T[] }).data;
    }
    throw new SiyuanCliError("siyuan-sisyphus JSON response did not contain an array", args, JSON.stringify(value), "");
  }
}

function sliceJson(text: string): string | null {
  const trimmed = text.trim();
  const starts = [trimmed.indexOf("{"), trimmed.indexOf("[")].filter((x) => x >= 0);
  if (starts.length === 0) return null;
  const start = Math.min(...starts);
  const opener = trimmed[start];
  const closer = opener === "{" ? "}" : "]";
  const end = trimmed.lastIndexOf(closer);
  if (end <= start) return null;
  return trimmed.slice(start, end + 1);
}

export function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function hpathToRel(hpath: string): string {
  return hpath.replace(/^\/+/, "");
}

export function relToHpath(relPath: string): string {
  const rel = normalizeRelPath(relPath);
  return rel ? `/${rel}` : "/";
}

export function normalizeRelPath(input: string): string {
  return input
    .replace(/^\/+/, "")
    .replace(/^wiki\/?/, "")
    .replace(/\.md$/i, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

export function workspacePath(workspaceNotebook: string, relPath: string): string {
  const rel = normalizeRelPath(relPath);
  return rel ? `/${workspaceNotebook}/${rel}` : `/${workspaceNotebook}`;
}
