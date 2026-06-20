import express from "express";
import path from "node:path";
import url from "node:url";
import fs from "node:fs";
import { parseArgs } from "./config.js";
import { createContentProvider } from "./content/factory.js";
import { handleTree } from "./routes/tree.js";
import { handlePage, handleRaw } from "./routes/pages.js";
import { handleAuditList, handleAuditCreate, handleAuditResolve } from "./routes/audit.js";
import { handleGraph } from "./routes/graph.js";

const cfg = parseArgs(process.argv);

// ── 创建 ContentProvider ──────────────────────────────────────────────────
const provider = await createContentProvider(cfg);

const app = express();
app.use(express.json({ limit: "2mb" }));

// ── API ────────────────────────────────────────────────────────────────────
app.get("/api/tree", handleTree(provider));
app.get("/api/graph", handleGraph(provider));
app.get("/api/page", handlePage(provider));
app.get("/api/raw", handleRaw(provider));
app.get("/api/audit", handleAuditList(cfg));
app.post("/api/audit", handleAuditCreate(cfg));
app.patch("/api/audit/:id/resolve", handleAuditResolve(cfg));
app.get("/api/config", (_req, res) => {
  res.json({
    author: cfg.author,
    mode: cfg.mode,
    notebookId: cfg.notebookId,
    notebookName: cfg.notebookName,
    profile: cfg.profile ?? null,
  });
});

// ── Static client ──────────────────────────────────────────────────────────
const here = path.dirname(url.fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, "../dist/client");
if (!fs.existsSync(clientDist)) {
  console.warn(
    `warning: client bundle not found at ${clientDist}. Run 'npm run build' first.`,
  );
}
app.use("/assets", express.static(path.join(clientDist, "assets")));
app.use("/katex", express.static(path.resolve(here, "../node_modules/katex/dist")));
app.get("/", (_req, res) => {
  const index = path.join(clientDist, "index.html");
  if (fs.existsSync(index)) {
    res.sendFile(index);
  } else {
    res.status(500).send("client bundle missing. Run: npm run build");
  }
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(cfg.port, cfg.host, () => {
  console.log(`llm-wiki web server listening on http://${cfg.host}:${cfg.port}`);
  console.log(`  mode:      ${cfg.mode}`);
  console.log(`  notebook:  ${cfg.notebookName} (${cfg.notebookId})`);
  if (cfg.profile) console.log(`  profile:   ${cfg.profile}`);
  console.log(`  author:    ${cfg.author}`);
});
