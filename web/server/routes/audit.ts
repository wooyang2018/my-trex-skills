import type { Request, Response } from "express";
import {
  computeAnchor,
  filenameFor,
  fromMarkdown,
  makeId,
  toMarkdown,
  type AuditEntry,
  type Severity,
} from "../../shared/audit/index.js";
import type { ServerConfig } from "../config.js";
import {
  normalizeRelPath,
  sqlString,
  SiyuanCli,
  workspacePath,
} from "../content/siyuan-cli.js";

const VALID_SEVERITIES: readonly Severity[] = ["info", "suggest", "warn", "error"];

interface AuditDocRow {
  id: string;
  hpath: string;
  name?: string;
  updated?: string;
}

export function handleAuditList(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    const cli = makeCli(cfg);
    const target = req.query.target as string | undefined;
    const mode = (req.query.mode as string | undefined) ?? "open";

    try {
      const entries: AuditEntry[] = [];
      const docs = await listAuditDocs(cli, cfg);
      for (const doc of docs) {
        const rel = normalizeRelPath(doc.hpath);
        if (rel === "audit" || rel === "audit/resolved") continue;
        if (!matchesMode(rel, mode)) continue;
        try {
          const text = await readMarkdown(cli, cfg, rel);
          const entry = fromMarkdown(text);
          if (target && normalizeTarget(entry.target) !== normalizeTarget(target)) continue;
          if (mode === "open" && entry.status !== "open") continue;
          if (mode === "resolved" && entry.status !== "resolved") continue;
          entries.push(entry);
        } catch (err) {
          // SiYuan's SQL index can briefly return deleted documents; skip them.
        }
      }

      entries.sort((a, b) => a.created.localeCompare(b.created));
      res.json({ entries });
    } catch (err) {
      console.error("failed to list audits", err);
      res.status(500).json({ error: "failed to list audits", detail: String(err) });
    }
  };
}

export function handleAuditCreate(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    const cli = makeCli(cfg);
    try {
      const {
        target,
        rawMarkdown,
        selStart,
        selEnd,
        comment,
        severity,
        author,
      } = req.body as {
        target?: string;
        rawMarkdown?: string;
        selStart?: number;
        selEnd?: number;
        comment?: string;
        severity?: string;
        author?: string;
      };

      if (!target || typeof target !== "string") {
        res.status(400).json({ error: "target is required" });
        return;
      }
      if (!rawMarkdown || typeof rawMarkdown !== "string") {
        res.status(400).json({ error: "rawMarkdown is required" });
        return;
      }
      if (typeof selStart !== "number" || typeof selEnd !== "number") {
        res.status(400).json({ error: "selStart and selEnd must be numbers" });
        return;
      }
      if (!comment || !comment.trim()) {
        res.status(400).json({ error: "comment is required" });
        return;
      }
      if (!severity || !VALID_SEVERITIES.includes(severity as Severity)) {
        res.status(400).json({ error: `severity must be one of ${VALID_SEVERITIES.join(", ")}` });
        return;
      }

      await cli.run(["fs", "read", "--path", workspacePath(cfg.workspaceNotebook, target), "--page-size", "1"]);
      await ensureAuditRoots(cli, cfg);

      const anchor = computeAnchor(rawMarkdown, selStart, selEnd);
      const id = makeId();
      const slug = comment.trim().split(/\s+/).slice(0, 5).join(" ");
      const docName = filenameFor(id, slug).replace(/\.md$/i, "");
      const relPath = `audit/${docName}`;
      const entry: AuditEntry = {
        id,
        target,
        target_lines: anchor.target_lines,
        anchor_before: anchor.anchor_before,
        anchor_text: anchor.anchor_text,
        anchor_after: anchor.anchor_after,
        severity: severity as Severity,
        author: (author && author.trim()) || cfg.author,
        source: "web-viewer",
        created: new Date().toISOString(),
        status: "open",
        body: `# Comment\n\n${comment.trim()}\n\n# Resolution\n\n<!-- filled in when the audit is processed -->\n`,
      };

      await cli.run([
        "fs",
        "write",
        "--path",
        workspacePath(cfg.workspaceNotebook, relPath),
        "--markdown",
        toMarkdown(entry),
        "--overwrite",
      ]);
      await writeAuditAttrs(cli, cfg, relPath, entry);
      res.json({ id, filename: docName, path: `wiki/${relPath}`, entry });
    } catch (err) {
      console.error("failed to create audit", err);
      res.status(500).json({ error: "failed to create audit", detail: String(err) });
    }
  };
}

export function handleAuditResolve(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    const cli = makeCli(cfg);
    try {
      const id = req.params.id;
      if (!id || !/^\d{8}-\d{6}-[0-9a-f]{4}$/.test(id)) {
        res.status(400).json({ error: "invalid id" });
        return;
      }
      const { resolution } = req.body as { resolution?: string };
      const doc = (await listAuditDocs(cli, cfg)).find((row) =>
        normalizeRelPath(row.hpath).split("/").pop()?.startsWith(id),
      );
      if (!doc) {
        res.status(404).json({ error: "no audit with that id" });
        return;
      }

      const rel = normalizeRelPath(doc.hpath);
      const text = await readMarkdown(cli, cfg, rel);
      const entry = fromMarkdown(text);
      const today = new Date().toISOString().slice(0, 10);
      const newBody = replaceResolution(
        entry.body,
        `${today} · accepted.\n${(resolution ?? "").trim() || "(no details)"}\n`,
      );
      const resolvedEntry: AuditEntry = { ...entry, status: "resolved", body: newBody };

      await cli.run([
        "fs",
        "write",
        "--path",
        workspacePath(cfg.workspaceNotebook, rel),
        "--markdown",
        toMarkdown(resolvedEntry),
        "--overwrite",
      ]);
      await writeAuditAttrs(cli, cfg, rel, resolvedEntry);
      res.json({ id, path: `wiki/${rel}`, status: "resolved" });
    } catch (err) {
      console.error("failed to resolve audit", err);
      res.status(500).json({ error: "failed to resolve audit", detail: String(err) });
    }
  };
}

function makeCli(cfg: ServerConfig): SiyuanCli {
  return new SiyuanCli({ profile: cfg.profile, timeoutMs: cfg.cliTimeoutMs });
}

async function listAuditDocs(cli: SiyuanCli, cfg: ServerConfig): Promise<AuditDocRow[]> {
  return cli.dataArray<AuditDocRow>([
    "search",
    "query_sql",
    "--sql",
    `SELECT id, hpath, name, updated FROM blocks WHERE box=${sqlString(cfg.notebookId)} AND type='d' AND hpath LIKE '/audit/%' ORDER BY updated DESC LIMIT 1000`,
    "--json",
  ]);
}

async function readMarkdown(cli: SiyuanCli, cfg: ServerConfig, rel: string): Promise<string> {
  const result = await cli.json<{ content?: string }>([
    "fs",
    "read",
    "--path",
    workspacePath(cfg.workspaceNotebook, rel),
    "--page-size",
    "8000",
    "--json",
  ]);
  if (typeof result.content !== "string") {
    throw new Error(`fs read did not return content for ${rel}`);
  }
  return result.content;
}

function matchesMode(rel: string, mode: string): boolean {
  if (mode === "all") return true;
  if (mode === "resolved") return rel.startsWith("audit/resolved/");
  return !rel.startsWith("audit/resolved/");
}

async function ensureAuditRoots(cli: SiyuanCli, cfg: ServerConfig): Promise<void> {
  await ensureDoc(cli, cfg, "audit", "# Audit\n");
}

async function ensureDoc(cli: SiyuanCli, cfg: ServerConfig, rel: string, markdown: string): Promise<void> {
  try {
    await lookupDocId(cli, cfg, rel);
    return;
  } catch {
    await cli.run(["fs", "write", "--path", workspacePath(cfg.workspaceNotebook, rel), "--markdown", markdown]);
  }
}

async function writeAuditAttrs(
  cli: SiyuanCli,
  cfg: ServerConfig,
  rel: string,
  entry: AuditEntry,
): Promise<void> {
  const docId = await lookupDocId(cli, cfg, rel);
  await cli.run([
    "block",
    "set_attrs",
    "--id",
    docId,
    "--attrs-json",
    JSON.stringify({
      "custom-title": entry.id,
      "custom-category": "audit",
      "custom-tags": `audit,${entry.severity},${entry.status}`,
      "custom-sources": entry.target,
      "custom-summary": entry.body.replace(/^#\s*Comment\s*/i, "").split(/^#\s*Resolution/im)[0]?.trim() ?? "",
      "custom-status": entry.status,
      "custom-target": entry.target,
      "custom-updated": new Date().toISOString(),
    }),
  ]);
}

async function lookupDocId(cli: SiyuanCli, cfg: ServerConfig, rel: string): Promise<string> {
  const rows = await cli.dataArray<{ id: string }>([
    "search",
    "query_sql",
    "--sql",
    `SELECT id FROM blocks WHERE box=${sqlString(cfg.notebookId)} AND type='d' AND hpath=${sqlString(`/${normalizeRelPath(rel)}`)} LIMIT 1`,
    "--json",
  ]);
  const id = rows[0]?.id;
  if (!id) throw new Error(`document lookup did not return id for ${rel}`);
  return id;
}

function normalizeTarget(target: string): string {
  return normalizeRelPath(target);
}

function replaceResolution(body: string, newBlock: string): string {
  const re = /# Resolution[\s\S]*$/;
  if (re.test(body)) {
    return body.replace(re, `# Resolution\n\n${newBlock}`);
  }
  return `${body.trimEnd()}\n\n# Resolution\n\n${newBlock}`;
}
