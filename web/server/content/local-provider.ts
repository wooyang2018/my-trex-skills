/**
 * LocalContentProvider — 基于本地文件系统的实现。
 *
 * 将原来散落在 routes/tree.ts、routes/pages.ts、routes/graph.ts、
 * render/markdown.ts 中的 fs 逻辑统一收拢到此。
 */

import fs from "node:fs";
import path from "node:path";
import type {
  ContentProvider,
  ContentTreeNode,
  WikiPage,
  ContentGraphData,
  ContentGraphNode,
  ContentGraphEdge,
} from "./provider.js";

const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export class LocalContentProvider implements ContentProvider {
  constructor(private wikiRoot: string) {}

  // ── Tree ──────────────────────────────────────────────────────────────

  async getTree(): Promise<ContentTreeNode> {
    const wikiDir = path.join(this.wikiRoot, "wiki");
    if (!fs.existsSync(wikiDir)) {
      return { name: "wiki", path: "wiki", kind: "dir", children: [] };
    }
    return this.walk(wikiDir, "wiki");
  }

  private walk(dir: string, rel: string): ContentTreeNode {
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith("."))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    const children: ContentTreeNode[] = [];
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const nodeRel = path.posix.join(rel, e.name);
      if (e.isDirectory()) {
        children.push(this.walk(full, nodeRel));
      } else if (e.name.endsWith(".md")) {
        children.push({ name: e.name.replace(/\.md$/, ""), path: nodeRel, kind: "file" });
      }
    }
    return { name: path.basename(dir), path: rel, kind: "dir", children };
  }

  // ── Page ──────────────────────────────────────────────────────────────

  async getPage(relPath: string): Promise<WikiPage | null> {
    const rel = this.safeRel(relPath);
    if (!rel) return null;

    let full = path.join(this.wikiRoot, rel);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      full = path.join(full, "index.md");
    }
    if (!full.endsWith(".md")) full += ".md";

    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;

    // 安全检查：路径不能逃逸出 wikiRoot
    const relFromRoot = path.relative(this.wikiRoot, full);
    if (relFromRoot.startsWith("..") || path.isAbsolute(relFromRoot)) return null;

    const rawMarkdown = fs.readFileSync(full, "utf-8");
    const { frontmatter, title } = this.stripFrontmatter(rawMarkdown);

    return {
      path: relFromRoot.split(path.sep).join("/"),
      title,
      content: rawMarkdown,
      frontmatter,
    };
  }

  async getRaw(relPath: string): Promise<string | null> {
    const rel = this.safeRel(relPath);
    if (!rel) return null;

    const full = path.join(this.wikiRoot, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
    return fs.readFileSync(full, "utf-8");
  }

  // ── Graph ─────────────────────────────────────────────────────────────

  async getGraph(): Promise<ContentGraphData> {
    const wikiDir = path.join(this.wikiRoot, "wiki");
    if (!fs.existsSync(wikiDir)) return { nodes: [], edges: [] };

    const files = this.collectMdFiles(wikiDir);
    const byKey: Map<string, string> = new Map();
    const nodes: Map<string, ContentGraphNode> = new Map();

    for (const f of files) {
      const relFromWiki = path.relative(wikiDir, f).split(path.sep).join("/");
      const id = `wiki/${relFromWiki}`;
      const stem = path.basename(f, ".md");
      const parts = relFromWiki.split("/");
      const group = parts.length > 1 ? parts[0]! : "other";
      const title = this.extractTitle(fs.readFileSync(f, "utf-8")) ?? stem;

      nodes.set(id, { id, label: stem, path: id, group, degree: 0, title });
      byKey.set(stem, id);
      byKey.set(relFromWiki.replace(/\.md$/, ""), id);
      byKey.set(stem.toLowerCase(), id);
    }

    // Pass 2: build edges
    const edges: ContentGraphEdge[] = [];
    const seenEdges = new Set<string>();
    for (const f of files) {
      const relFromWiki = path.relative(wikiDir, f).split(path.sep).join("/");
      const srcId = `wiki/${relFromWiki}`;
      const text = fs.readFileSync(f, "utf-8");
      WIKILINK_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = WIKILINK_RE.exec(text))) {
        const target = m[1]!.trim();
        if (target.startsWith("#")) continue;
        const tgtId =
          byKey.get(target) ??
          byKey.get(target.replace(/\.md$/, "")) ??
          byKey.get(target.toLowerCase());
        if (!tgtId || tgtId === srcId) continue;

        const key = `${srcId}→${tgtId}`;
        if (seenEdges.has(key)) continue;
        seenEdges.add(key);
        edges.push({ source: srcId, target: tgtId });
        nodes.get(srcId)!.degree += 1;
        nodes.get(tgtId)!.degree += 1;
      }
    }

    return { nodes: Array.from(nodes.values()), edges };
  }

  // ── Link resolver ─────────────────────────────────────────────────────

  resolveLink(target: string): { href: string; exists: boolean } | null {
    const candidate = this.findPage(target);
    if (candidate) {
      const rel = path.relative(this.wikiRoot, candidate).split(path.sep).join("/");
      return { href: `/?page=${encodeURIComponent(rel)}`, exists: true };
    }
    return { href: `/?page=${encodeURIComponent(target)}`, exists: false };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private safeRel(input: string): string | null {
    if (!input) return "wiki/index.md";
    if (path.isAbsolute(input)) return null;
    const normalized = path.posix.normalize(input);
    if (normalized.startsWith("..")) return null;
    return normalized;
  }

  private collectMdFiles(dir: string): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...this.collectMdFiles(full));
      else if (e.isFile() && e.name.endsWith(".md")) out.push(full);
    }
    return out;
  }

  private extractTitle(text: string): string | null {
    const fm = FRONTMATTER_RE.exec(text);
    if (fm) {
      const t = /^title:\s*(.+)$/m.exec(fm[1]!);
      if (t) return t[1]!.trim().replace(/^["']|["']$/g, "");
    }
    const h1 = /^#\s+(.+?)\s*$/m.exec(text);
    return h1 ? h1[1]! : null;
  }

  private stripFrontmatter(text: string): {
    frontmatter: Record<string, unknown> | null;
    body: string;
    title: string | null;
  } {
    const m = FRONTMATTER_RE.exec(text);
    let frontmatter: Record<string, unknown> | null = null;
    let body = text;
    if (m) {
      frontmatter = {};
      for (const line of m[1]!.split("\n")) {
        const idx = line.indexOf(":");
        if (idx < 0) continue;
        frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
      body = text.slice(m[0].length);
    }
    const h1 = /^#\s+(.+?)\s*$/m.exec(body);
    const title =
      (frontmatter && typeof frontmatter.title === "string" && (frontmatter.title as string)) ||
      (h1 && h1[1]) ||
      null;
    return { frontmatter, body, title };
  }

  private findPage(target: string): string | null {
    const tryPath = (rel: string): string | null => {
      const full = path.join(this.wikiRoot, rel);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
      return null;
    };

    const direct = tryPath(target) || tryPath(target + ".md");
    if (direct) return direct;

    const wikiDir = path.join(this.wikiRoot, "wiki");
    if (!fs.existsSync(wikiDir)) return null;
    return this.findByStem(wikiDir, target);
  }

  private findByStem(dir: string, target: string): string | null {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const sub = this.findByStem(full, target);
        if (sub) return sub;
      } else if (e.isFile() && e.name.endsWith(".md")) {
        const stem = e.name.replace(/\.md$/, "");
        if (stem === target || e.name === target) return full;
      }
    }
    return null;
  }
}
