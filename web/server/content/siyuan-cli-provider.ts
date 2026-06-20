import type {
  ContentGraphData,
  ContentGraphEdge,
  ContentGraphNode,
  ContentProvider,
  ContentTreeNode,
  WikiPage,
} from "./provider.js";
import { cleanKramdown } from "./siyuan-link.js";
import {
  hpathToRel,
  normalizeRelPath,
  relToHpath,
  sqlString,
  SiyuanCli,
  workspacePath,
} from "./siyuan-cli.js";

interface ProviderOptions {
  notebookId: string;
  notebookName: string;
  profile?: string;
  timeoutMs: number;
  cacheTtlMs: number;
}

interface SiYuanDoc {
  id: string;
  hpath: string;
  path?: string;
  name?: string;
  content?: string;
  markdown?: string;
  updated?: string;
}

interface SiYuanRef {
  block_id: string;
  def_block_id: string;
}

interface RootRow {
  id: string;
  root_id: string;
}

interface Cache<T> {
  value: T | null;
  expiresAt: number;
}

export class SiyuanCliContentProvider implements ContentProvider {
  private readonly cli: SiyuanCli;
  private readonly docs: Cache<SiYuanDoc[]> = { value: null, expiresAt: 0 };
  private readonly graph: Cache<ContentGraphData> = { value: null, expiresAt: 0 };
  private docById = new Map<string, SiYuanDoc>();
  private docByRel = new Map<string, SiYuanDoc>();
  private docByStem = new Map<string, SiYuanDoc[]>();

  constructor(private readonly opts: ProviderOptions) {
    this.cli = new SiyuanCli({ profile: opts.profile, timeoutMs: opts.timeoutMs });
  }

  async getTree(): Promise<ContentTreeNode> {
    const docs = await this.ensureDocs();
    const root: ContentTreeNode = { name: this.opts.notebookName, path: "wiki", kind: "dir", children: [] };

    for (const doc of docs) {
      const rel = hpathToRel(doc.hpath);
      if (!rel || rel.startsWith("_")) continue;
      const parts = rel.split("/");
      let current = root;
      let accumulated = "wiki";

      for (let i = 0; i < parts.length - 1; i++) {
        const dirName = parts[i]!;
        accumulated += `/${dirName}`;
        let child = current.children?.find((c) => c.kind === "dir" && c.name === dirName);
        if (!child) {
          child = { name: dirName, path: accumulated, kind: "dir", children: [] };
          current.children = current.children ?? [];
          current.children.push(child);
        }
        current = child;
      }

      current.children = current.children ?? [];
      current.children.push({
        name: parts[parts.length - 1]!,
        path: `wiki/${rel}`,
        kind: "file",
      });
    }

    sortTree(root);
    return root;
  }

  async getPage(relPath: string): Promise<WikiPage | null> {
    const doc = await this.findDoc(relPath);
    if (!doc) return null;
    const rel = hpathToRel(doc.hpath);
    const raw = await this.readRel(rel);
    const content = cleanKramdown(raw);
    const { frontmatter, title } = parseFrontmatter(content, doc);
    return { path: `wiki/${rel}`, title, content, frontmatter };
  }

  async getRaw(relPath: string): Promise<string | null> {
    const doc = await this.findDoc(relPath);
    if (!doc) return null;
    return cleanKramdown(await this.readRel(hpathToRel(doc.hpath)));
  }

  async getGraph(): Promise<ContentGraphData> {
    if (this.graph.value && Date.now() < this.graph.expiresAt) return this.graph.value;

    const docs = await this.ensureDocs();
    const nodes = new Map<string, ContentGraphNode>();
    for (const doc of docs) {
      const rel = hpathToRel(doc.hpath);
      if (!rel || rel.startsWith("_")) continue;
      const id = `wiki/${rel}`;
      const parts = rel.split("/");
      const label = doc.name || parts[parts.length - 1]!;
      const group = parts.length > 1 ? parts[0]! : "root";
      nodes.set(id, { id, label, path: id, group, degree: 0, title: doc.name || label });
    }

    const edges: ContentGraphEdge[] = [];
    const seen = new Set<string>();
    try {
      const refs = await this.sql<SiYuanRef>(
        `SELECT block_id, def_block_id FROM refs WHERE box=${sqlString(this.opts.notebookId)} LIMIT 10000`,
      );
      const blockIds = Array.from(new Set(refs.map((r) => r.block_id))).filter(Boolean);
      const blockToDoc = await this.lookupRootDocs(blockIds);

      for (const ref of refs) {
        const srcDocId = blockToDoc.get(ref.block_id);
        const srcDoc = srcDocId ? this.docById.get(srcDocId) : null;
        const tgtDoc = this.docById.get(ref.def_block_id);
        if (!srcDoc || !tgtDoc) continue;
        const srcId = `wiki/${hpathToRel(srcDoc.hpath)}`;
        const tgtId = `wiki/${hpathToRel(tgtDoc.hpath)}`;
        if (srcId === tgtId || !nodes.has(srcId) || !nodes.has(tgtId)) continue;
        const key = `${srcId}->${tgtId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ source: srcId, target: tgtId });
        nodes.get(srcId)!.degree += 1;
        nodes.get(tgtId)!.degree += 1;
      }
    } catch (err) {
      console.warn("graph refs query failed; returning nodes without edges:", String(err));
    }

    const value = { nodes: Array.from(nodes.values()), edges };
    this.graph.value = value;
    this.graph.expiresAt = Date.now() + this.opts.cacheTtlMs;
    return value;
  }

  resolveLink(target: string): { href: string; exists: boolean } | null {
    const normalized = normalizeRelPath(target);
    if (/^\d{14}-[a-z0-9]+$/.test(normalized)) {
      const doc = this.docById.get(normalized);
      if (doc) return { href: `/?page=${encodeURIComponent(`wiki/${hpathToRel(doc.hpath)}`)}`, exists: true };
      return { href: `/?page=${encodeURIComponent(normalized)}`, exists: false };
    }

    const doc =
      this.docByRel.get(normalized) ??
      this.docByRel.get(normalized.toLowerCase()) ??
      unique(this.docByStem.get(normalized.toLowerCase()));
    if (!doc) return { href: `/?page=${encodeURIComponent(target)}`, exists: false };
    return { href: `/?page=${encodeURIComponent(`wiki/${hpathToRel(doc.hpath)}`)}`, exists: true };
  }

  private async findDoc(relPath: string): Promise<SiYuanDoc | null> {
    await this.ensureDocs();
    const normalized = normalizeRelPath(relPath);
    if (/^\d{14}-[a-z0-9]+$/.test(normalized)) return this.docById.get(normalized) ?? null;
    return (
      this.docByRel.get(normalized) ??
      this.docByRel.get(normalized.toLowerCase()) ??
      unique(this.docByStem.get(normalized.toLowerCase())) ??
      null
    );
  }

  private async readRel(rel: string): Promise<string> {
    const out = await this.cli.run([
      "fs",
      "read",
      "--path",
      workspacePath(this.opts.notebookName, rel),
      "--page-size",
      "8000",
    ]);
    return out;
  }

  private async ensureDocs(): Promise<SiYuanDoc[]> {
    if (this.docs.value && Date.now() < this.docs.expiresAt) return this.docs.value;
    const docs = await this.sql<SiYuanDoc>(
      `SELECT id, hpath, path, name, content, markdown, updated FROM blocks ` +
        `WHERE box=${sqlString(this.opts.notebookId)} AND type='d' ORDER BY hpath LIMIT 10000`,
    );
    this.docs.value = docs;
    this.docs.expiresAt = Date.now() + this.opts.cacheTtlMs;
    this.rebuildIndexes(docs);
    return docs;
  }

  private rebuildIndexes(docs: SiYuanDoc[]): void {
    this.docById.clear();
    this.docByRel.clear();
    this.docByStem.clear();
    for (const doc of docs) {
      const rel = hpathToRel(doc.hpath);
      this.docById.set(doc.id, doc);
      this.docByRel.set(rel, doc);
      this.docByRel.set(rel.toLowerCase(), doc);
      const stem = rel.split("/").pop()?.toLowerCase();
      if (stem) {
        const list = this.docByStem.get(stem) ?? [];
        list.push(doc);
        this.docByStem.set(stem, list);
      }
    }
  }

  private async lookupRootDocs(blockIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (let i = 0; i < blockIds.length; i += 200) {
      const chunk = blockIds.slice(i, i + 200);
      if (chunk.length === 0) continue;
      const ids = chunk.map(sqlString).join(",");
      const rows = await this.sql<RootRow>(
        `SELECT id, root_id FROM blocks WHERE id IN (${ids}) AND box=${sqlString(this.opts.notebookId)} LIMIT 200`,
      );
      for (const row of rows) out.set(row.id, row.root_id);
    }
    return out;
  }

  private sql<T>(sql: string): Promise<T[]> {
    return this.cli.json<T[]>(["search", "query_sql", "--sql", sql, "--json"]);
  }
}

function sortTree(node: ContentTreeNode): void {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) {
    if (child.kind === "dir") sortTree(child);
  }
}

function unique<T>(items: T[] | undefined): T | null {
  return items && items.length === 1 ? items[0]! : null;
}

function parseFrontmatter(
  content: string,
  doc: SiYuanDoc,
): { frontmatter: Record<string, unknown> | null; title: string | null } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(content);
  let frontmatter: Record<string, unknown> | null = null;
  if (m) {
    frontmatter = {};
    for (const line of m[1]!.split("\n")) {
      const idx = line.indexOf(":");
      if (idx > 0) frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  const h1 = /^#\s+(.+?)\s*$/m.exec(content);
  const title =
    (frontmatter && typeof frontmatter.title === "string" ? frontmatter.title : null) ??
    h1?.[1] ??
    doc.name ??
    hpathToRel(doc.hpath).split("/").pop() ??
    null;
  return { frontmatter, title };
}

export { relToHpath, workspacePath };
