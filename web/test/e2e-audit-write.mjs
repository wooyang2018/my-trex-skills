#!/usr/bin/env node
import process from "node:process";
import {
  assert,
  cleanupTestDocs,
  cliData,
  cliJson,
  createTestPage,
  fetchJson,
  lookupDocId,
  patchJson,
  postJson,
  selectionMarker,
  startServer,
  uniqueName,
  waitForServer,
} from "./e2e-utils.mjs";

const port = Number(process.env.E2E_PORT ?? "7566");
const base = `http://127.0.0.1:${port}`;
const marker = `E2E audit write ${new Date().toISOString()}`;
const server = startServer(port);
const createdDocs = [];

try {
  await waitForServer(base, server.output);
  const cfg = await fetchJson(`${base}/api/config`, server.output);
  assert(cfg.notebookId && cfg.workspaceNotebook, "config missing notebook identity", server.output);

  const testPage = await createTestPage(cfg, uniqueName());
  createdDocs.push(testPage);

  const pageJson = await fetchJson(`${base}/api/page?path=${encodeURIComponent(testPage.page)}`, server.output);
  const selStart = pageJson.raw.indexOf(selectionMarker);
  assert(selStart >= 0, `selection text not found in raw markdown: ${selectionMarker}`, server.output);
  const selEnd = selStart + selectionMarker.length;

  const created = await postJson(`${base}/api/audit`, {
    target: pageJson.path,
    rawMarkdown: pageJson.raw,
    selStart,
    selEnd,
    comment: marker,
    severity: "warn",
    author: "e2e",
  }, server.output);

  assert(created.id, "audit create response missing id", server.output);
  assert(created.path?.startsWith("wiki/audit/"), "audit create response missing audit path", server.output);
  assert(created.entry?.target === testPage.page, "created entry target mismatch", server.output);
  assert(created.entry?.anchor_text === selectionMarker, "created entry anchor_text mismatch", server.output);
  assert(created.entry?.source === "web-viewer", "created entry source mismatch", server.output);
  assert(created.entry?.status === "open", "created entry status mismatch", server.output);

  const auditRel = created.path.replace(/^wiki\//, "");
  const auditWorkspacePath = `/${cfg.workspaceNotebook}/${auditRel}`;
  createdDocs.push({ workspacePath: auditWorkspacePath });

  const openAudits = await fetchJson(`${base}/api/audit?target=${encodeURIComponent(testPage.page)}&mode=open`, server.output);
  assert(
    Array.isArray(openAudits.entries) && openAudits.entries.some((entry) => entry.id === created.id),
    "created audit was not returned by open audit list",
    server.output,
  );

  const hpath = `/${auditRel}`;
  const rows = await cliData([
    "search",
    "query_sql",
    "--sql",
    `SELECT id,hpath FROM blocks WHERE box='${cfg.notebookId}' AND type='d' AND hpath='${hpath}' LIMIT 1`,
    "--json",
  ]);
  const docId = rows[0]?.id;
  assert(docId, `created audit document not found at ${hpath}`, server.output);

  // Verify body content has no frontmatter, has Comment and Resolution
  const read = await cliJson(["fs", "read", "--path", auditWorkspacePath, "--page-size", "8000", "--json"]);
  assert(typeof read.content === "string", "audit fs read did not return content", server.output);
  assert(read.content.includes("# Comment"), "audit markdown missing # Comment", server.output);
  assert(read.content.includes(marker), "audit markdown missing submitted comment", server.output);
  assert(read.content.includes("# Resolution"), "audit markdown missing # Resolution", server.output);

  // Verify all metadata is in custom-* attrs (no body frontmatter)
  const attrs = await cliJson(["block", "get_attrs", "--id", docId, "--json"]);
  assert(attrs["custom-id"] === created.id, "custom-id attr mismatch", server.output);
  assert(attrs["custom-target"] === testPage.page, "custom-target attr mismatch", server.output);
  assert(attrs["custom-category"] === "audit", "custom-category attr mismatch", server.output);
  assert(attrs["custom-status"] === "open", "custom-status attr mismatch", server.output);
  assert(attrs["custom-title"] === created.id, "custom-title attr mismatch", server.output);
  assert(attrs["custom-severity"] === "warn", "custom-severity attr mismatch", server.output);
  assert(attrs["custom-author"] === "e2e", "custom-author attr mismatch", server.output);
  assert(attrs["custom-source"] === "web-viewer", "custom-source attr mismatch", server.output);
  assert(String(attrs["custom-tags"] ?? "").includes("warn"), "custom-tags missing severity", server.output);
  assert(String(attrs["custom-summary"] ?? "").includes(marker), "custom-summary missing comment", server.output);
  assert(typeof attrs["custom-anchor-text"] === "string" && attrs["custom-anchor-text"].length > 0, "custom-anchor-text missing", server.output);
  assert(typeof attrs["custom-anchor-before"] === "string", "custom-anchor-before missing", server.output);
  assert(typeof attrs["custom-anchor-after"] === "string", "custom-anchor-after missing", server.output);
  assert(typeof attrs["custom-target-lines"] === "string", "custom-target-lines missing", server.output);

  await patchJson(`${base}/api/audit/${created.id}/resolve`, { resolution: "e2e resolved" }, server.output);
  const resolvedAttrs = await cliJson(["block", "get_attrs", "--id", docId, "--json"]);
  assert(resolvedAttrs["custom-status"] === "resolved", "custom-status was not resolved", server.output);

  const afterResolve = await fetchJson(`${base}/api/audit?target=${encodeURIComponent(testPage.page)}&mode=open`, server.output);
  assert(
    Array.isArray(afterResolve.entries) && !afterResolve.entries.some((entry) => entry.id === created.id),
    "resolved audit still appeared in open audit list",
    server.output,
  );

  console.log(`ok: audit ${created.id} written, resolved, and scheduled for cleanup`);
} finally {
  const cfg = await fetchJson(`${base}/api/config`, server.output).catch(() => null);
  if (cfg) await cleanupTestDocs(cfg, createdDocs);
  await server.stop();
}
