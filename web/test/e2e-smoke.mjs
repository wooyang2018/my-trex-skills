#!/usr/bin/env node
import process from "node:process";
import {
  assert,
  cleanupTestDocs,
  createTestPage,
  fetchJson,
  fetchText,
  selectionMarker,
  startServer,
  uniqueName,
  waitForServer,
} from "./e2e-utils.mjs";

const port = Number(process.env.E2E_PORT ?? "7565");
const base = `http://127.0.0.1:${port}`;
const server = startServer(port);
const createdDocs = [];

try {
  await waitForServer(base, server.output);
  const cfg = await fetchJson(`${base}/api/config`, server.output);
  assert(cfg.notebookId && cfg.workspaceNotebook, "config missing notebook identity", server.output);

  const testPage = await createTestPage(cfg, uniqueName());
  createdDocs.push(testPage);

  const root = await fetchText(`${base}/?page=${encodeURIComponent(testPage.page)}`, server.output);
  assert(root.includes("/assets/main.js"), "root HTML did not include client bundle", server.output);
  assert(root.includes('id="root"'), "root HTML did not include React mount", server.output);

  const pageJson = await fetchJson(`${base}/api/page?path=${encodeURIComponent(testPage.page)}`, server.output);
  assert(pageJson.path === testPage.page, `expected path ${testPage.page}, got ${pageJson.path}`, server.output);
  assert(typeof pageJson.raw === "string" && pageJson.raw.includes(selectionMarker), "raw markdown missing marker", server.output);
  assert(typeof pageJson.html === "string" && pageJson.html.includes(selectionMarker), "rendered HTML missing marker", server.output);
  assert(!pageJson.raw.startsWith("Path"), "raw markdown still contains CLI display wrapper", server.output);

  const treeJson = await fetchJson(`${base}/api/tree`, server.output);
  assert(JSON.stringify(treeJson).includes(testPage.page), "tree did not include temporary test page", server.output);

  const auditJson = await fetchJson(`${base}/api/audit?target=${encodeURIComponent(testPage.page)}&mode=open`, server.output);
  assert(Array.isArray(auditJson.entries), "audit response did not contain entries array", server.output);

  console.log(`ok: ${testPage.page} rendered with self-created test data`);
} finally {
  const cfg = await fetchJson(`${base}/api/config`, server.output).catch(() => null);
  if (cfg) await cleanupTestDocs(cfg, createdDocs);
  await server.stop();
}
