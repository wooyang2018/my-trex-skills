import { execFile } from "node:child_process";
import { spawn } from "node:child_process";

export const selectionMarker = "WEB_E2E_SELECTION_MARKER";

export function uniqueName(prefix = "__web-e2e") {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${stamp}-${random}`;
}

export function startServer(port) {
  const child = spawn("npm", ["run", "start", "--", "--port", String(port)], {
    cwd: new URL("..", import.meta.url),
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return {
    child,
    output: () => output,
    async stop() {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    },
  };
}

export async function waitForServer(base, getOutput) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/config`);
      if (res.ok) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`server did not start on ${base}\n${getOutput()}`);
}

export async function fetchText(url, getOutput, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  assert(res.ok, `${url} returned ${res.status}: ${text.slice(0, 500)}`, getOutput);
  return text;
}

export async function fetchJson(url, getOutput, init) {
  return JSON.parse(await fetchText(url, getOutput, init));
}

export async function postJson(url, body, getOutput) {
  return fetchJson(url, getOutput, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function patchJson(url, body, getOutput) {
  return fetchJson(url, getOutput, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function createTestPage(cfg, name) {
  const rel = `references/${name}`;
  const page = `wiki/${rel}`;
  const workspacePath = `/${cfg.workspaceNotebook}/${rel}`;
  const now = new Date().toISOString();
  const markdown = [
    "This temporary page is created by the web end-to-end test.",
    "",
    `The selectable anchor is ${selectionMarker}, and it must survive rendering.`,
    "",
    "## Verification",
    "",
    "- The page body is readable.",
    "- The audit endpoint can target this page.",
    "",
  ].join("\n");

  await execCli(["fs", "write", "--path", workspacePath, "--markdown", markdown, "--overwrite", "--json"]);
  const docId = await lookupDocId(cfg.notebookId, `/${rel}`);
  await execCli([
    "block",
    "set_attrs",
    "--id",
    docId,
    "--attrs-json",
    JSON.stringify({
      "custom-title": name,
      "custom-category": "references",
      "custom-tags": "web-e2e,temporary",
      "custom-sources": "e2e",
      "custom-summary": `Temporary web e2e page containing ${selectionMarker}`,
      "custom-created": now,
      "custom-updated": now,
    }),
  ]);

  return { name, rel, page, workspacePath, docId, markdown };
}

export async function cleanupTestDocs(cfg, docs) {
  for (const doc of docs.reverse()) {
    if (!doc?.workspacePath) continue;
    const path = String(doc.workspacePath);
    if (!path.includes("__web-e2e") && !path.includes("/audit/")) continue;
    try {
      await execCli(["fs", "rm", "--path", path, "--yes", "--json"]);
    } catch {
      // If deletion says the document is already gone, the read check below
      // will pass. Otherwise the cleanup should fail loudly.
    }
    await assertDeleted(path);
  }
}

async function assertDeleted(path) {
  let stillReadable = false;
  try {
    await execCli(["fs", "read", "--path", path, "--page-size", "1", "--json"]);
    stillReadable = true;
  } catch {
    // fs read fails when the document has actually been removed.
  }
  if (stillReadable) {
    throw new Error(`cleanup failed; document is still readable at ${path}`);
  }
}

export async function lookupDocId(notebookId, hpath) {
  const rows = await cliData([
    "search",
    "query_sql",
    "--sql",
    `SELECT id,hpath FROM blocks WHERE box='${sqlEscape(notebookId)}' AND type='d' AND hpath='${sqlEscape(hpath)}' LIMIT 1`,
    "--json",
  ]);
  const id = rows[0]?.id;
  if (!id) throw new Error(`document not found at ${hpath}`);
  return id;
}

export async function cliJson(args) {
  const stdout = await execCli(args);
  try {
    return JSON.parse(stdout);
  } catch {
    const sliced = sliceJson(stdout);
    if (sliced) return JSON.parse(sliced);
    throw new Error(`CLI did not return JSON: ${stdout.slice(0, 500)}`);
  }
}

export async function cliData(args) {
  const value = await cliJson(args);
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  throw new Error(`CLI response did not contain data array: ${JSON.stringify(value)}`);
}

export function execCli(args) {
  return new Promise((resolve, reject) => {
    execFile("siyuan-sisyphus", args, { encoding: "utf-8", maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${err.message}\n${stdout}\n${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export function assert(condition, message, getOutput = () => "") {
  if (!condition) throw new Error(`${message}\n\nserver output:\n${getOutput()}`);
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

function sliceJson(text) {
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
