/**
 * SiYuanContentProvider — 通过 SiYuan HTTP API 直连思源笔记。
 *
 * 方案 A 核心：用思源作为唯一数据源，运行时通过 API 读取，
 * 无需导出/同步/拷贝文档。
 *
 * 数据映射：
 *   - 思源笔记本 → wiki root
 *   - hpath (/concepts/Foo) → 相对路径 (concepts/Foo)
 *   - block kramdown → markdown（清理思源元数据标记）
 *   - refs 表 → 图谱边
 *   - ((block-id "text")) → 可点击链接
 */

import type {
  ContentProvider,
  ContentTreeNode,
  WikiPage,
  ContentGraphData,
  ContentGraphNode,
  ContentGraphEdge,
} from "./provider.js";
import { cleanKramdown } from "./siyuan-link.js";

// ── SiYuan API types ─────────────────────────────────────────────────────

interface SiYuanBlock {
  id: string;
  type: string;
  path: string;
  hpath: string;
  name: string;
  content: string;
  markdown: string;
}

interface SiYuanRef {
  block_id: string;       // 引用所在的文档（源）
  def_block_id: string;   // 被引用的块（目标）
  def_block_path: string;
  content: string;
  markdown: string;
}

// ── Provider ─────────────────────────────────────────────────────────────

export class SiYuanContentProvider implements ContentProvider {
  private apiBase: string;
  private notebookId: string;
  private token: string;

  // 缓存：文档树（避免每次请求都查 SQL）
  private docCache: SiYuanBlock[] | null = null;
  private docById: Map<string, SiYuanBlock> = new Map();
  private docByHPath: Map<string, SiYuanBlock> = new Map();

  constructor(opts: { apiBase: string; notebookId: string; token?: string }) {
    this.apiBase = opts.apiBase.replace(/\/$/, "");
    this.notebookId = opts.notebookId;
    this.token = opts.token ?? "";
  }

  // ── SiYuan API helper ──────────────────────────────────────────────────

  private async api(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    const url = `${this.apiBase}${endpoint}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Token ${this.token}`;

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new Error(`SiYuan API ${endpoint} returned ${resp.status}`);
    }
    const json = (await resp.json()) as { code: number; msg: string; data: unknown };
    if (json.code !== 0) {
      throw new Error(`SiYuan API ${endpoint} error: ${json.msg}`);
    }
    return json.data;
  }

  private async sql<T = SiYuanBlock>(stmt: string): Promise<T[]> {
    const data = await this.api("/api/query/sql", { stmt });
    return data as T[];
  }

  // ── Cache management ───────────────────────────────────────────────────

  /** 加载并缓存笔记本中所有文档块。SiYuan SQL API 默认最多返回 64 行，需分页。 */
  private async ensureDocCache(): Promise<void> {
    if (this.docCache) return;

    // 分页查询获取全部文档（SiYuan API 默认上限 64 行）
    const pageSize = 200;
    let offset = 0;
    const allDocs: SiYuanBlock[] = [];

    while (true) {
      const page = await this.sql<SiYuanBlock>(
        `SELECT id, type, path, hpath, name FROM blocks ` +
          `WHERE box = "${this.notebookId}" AND type = "d" ` +
          `ORDER BY hpath LIMIT ${pageSize} OFFSET ${offset}`,
      );
      allDocs.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    this.docCache = allDocs;
    this.docById.clear();
    this.docByHPath.clear();
    for (const doc of allDocs) {
      this.docById.set(doc.id, doc);
      // hpath like "/concepts/Foo" → "concepts/Foo"
      const rel = doc.hpath.replace(/^\//, "");
      this.docByHPath.set(rel, doc);
      this.docByHPath.set(rel.toLowerCase(), doc);
    }
  }

  // ── ContentProvider interface ──────────────────────────────────────────

  async getTree(): Promise<ContentTreeNode> {
    await this.ensureDocCache();
    const docs = this.docCache!;

    // 根据 hpath 构建树
    // hpath 格式: /concepts, /concepts/Foo, /index, /_meta/manifest
    const root: ContentTreeNode = { name: "wiki", path: "wiki", kind: "dir", children: [] };

    for (const doc of docs) {
      const rel = doc.hpath.replace(/^\//, ""); // "concepts/Foo"
      if (!rel || rel.startsWith("_")) continue; // 跳过 _meta, _raw 等内部目录

      const parts = rel.split("/");
      const fileName = parts[parts.length - 1]!;

      // 构建路径到树节点的映射
      let current = root;
      let accumulated = "wiki";

      for (let i = 0; i < parts.length - 1; i++) {
        const dirName = parts[i]!;
        accumulated += `/${dirName}`;
        let child = current.children?.find(
          (c) => c.kind === "dir" && c.name === dirName,
        );
        if (!child) {
          child = { name: dirName, path: accumulated, kind: "dir", children: [] };
          current.children = current.children ?? [];
          current.children.push(child);
        }
        current = child;
      }

      // 添加文件节点
      const filePath = `wiki/${rel}`;
      current.children = current.children ?? [];
      current.children.push({
        name: fileName,
        path: filePath,
        kind: "file",
      });
    }

    // 排序
    this.sortTree(root);
    return root;
  }

  private sortTree(node: ContentTreeNode): void {
    if (!node.children) return;
    node.children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) {
      if (child.kind === "dir") this.sortTree(child);
    }
  }

  async getPage(relPath: string): Promise<WikiPage | null> {
    await this.ensureDocCache();

    // relPath 可能是 "wiki/concepts/Foo" 或 "concepts/Foo"
    const hpath = relPath.replace(/^wiki\//, "/");
    const rel = hpath.replace(/^\//, "");

    // 直接查找
    let doc = this.docByHPath.get(rel);
    if (!doc) doc = this.docByHPath.get(rel.toLowerCase());
    if (!doc) return null;

    // 获取 kramdown 并清理为标准 markdown
    const kramdownData = (await this.api("/api/block/getBlockKramdown", { id: doc.id })) as {
      id: string;
      kramdown: string;
    };
    const content = cleanKramdown(kramdownData.kramdown);

    // 解析 frontmatter
    const { frontmatter, title } = this.parseFrontmatter(content, doc);

    return {
      path: rel,
      title,
      content,
      frontmatter,
    };
  }

  async getRaw(relPath: string): Promise<string | null> {
    const page = await this.getPage(relPath);
    return page?.content ?? null;
  }

  async getGraph(): Promise<ContentGraphData> {
    await this.ensureDocCache();
    const docs = this.docCache!;

    // 构建节点
    const nodes: Map<string, ContentGraphNode> = new Map();
    for (const doc of docs) {
      const rel = doc.hpath.replace(/^\//, "");
      if (rel.startsWith("_")) continue;

      const id = `wiki/${rel}`;
      const stem = rel.split("/").pop()!;
      const parts = rel.split("/");
      const group = parts.length > 1 ? parts[0]! : "other";

      // 获取标题（从 content 或 name 推断）
      const title = doc.name || stem;

      nodes.set(id, { id, label: stem, path: id, group, degree: 0, title });
    }

    // 构建边：查询 refs 表
    const edges: ContentGraphEdge[] = [];
    const seenEdges = new Set<string>();

    try {
      const refs = await this.sql<SiYuanRef>(
        `SELECT block_id, def_block_id, def_block_path, content, markdown FROM refs ` +
          `WHERE box = "${this.notebookId}"`,
      );

      // 同时需要查 blocks 表获取 root_id 来映射到文档
      // refs.block_id 是引用所在块的 id，需要找其所属文档
      // refs.def_block_id 是被引用块的 id

      // 只查 refs 涉及的 block_id，避免全量扫描（笔记本可能有数万块）
      const refBlockIds = refs.map((r) => `"${r.block_id}"`).join(",");
      const docByIdMap = new Map<string, SiYuanBlock>();
      for (const d of docs) docByIdMap.set(d.id, d);

      const blockToDoc: Map<string, string> = new Map();
      if (refBlockIds) {
        const refBlocks = await this.sql<{ id: string; root_id: string }>(
          `SELECT id, root_id FROM blocks WHERE id IN (${refBlockIds})`,
        );
        for (const blk of refBlocks) {
          const doc = docByIdMap.get(blk.root_id);
          if (doc) {
            blockToDoc.set(blk.id, doc.hpath.replace(/^\//, ""));
          }
        }
      }

      for (const ref of refs) {
        // 源文档
        const srcRel = blockToDoc.get(ref.block_id);
        if (!srcRel) continue;

        // 目标文档
        const tgtDoc = docByIdMap.get(ref.def_block_id);
        let tgtRel: string | null = null;
        if (tgtDoc) {
          tgtRel = tgtDoc.hpath.replace(/^\//, "");
        } else {
          // def_block_id 可能直接是文档 id
          const direct = this.docById.get(ref.def_block_id);
          if (direct) tgtRel = direct.hpath.replace(/^\//, "");
        }
        if (!tgtRel) continue;

        const srcId = `wiki/${srcRel}`;
        const tgtId = `wiki/${tgtRel}`;
        if (srcId === tgtId) continue;

        const key = `${srcId}→${tgtId}`;
        if (seenEdges.has(key)) continue;
        seenEdges.add(key);
        edges.push({ source: srcId, target: tgtId });

        nodes.get(srcId)!.degree += 1;
        nodes.get(tgtId)!.degree += 1;
      }
    } catch (err) {
      // refs 查询失败时仍返回节点（无边）
      console.warn("SiYuan refs query failed, returning graph without edges:", String(err));
    }

    return { nodes: Array.from(nodes.values()), edges };
  }

  resolveLink(target: string): { href: string; exists: boolean } | null {
    // 同步方法：从缓存中查找
    // target 可能是 hpath、stem 或 block-id
    if (!this.docCache) {
      // 缓存未就绪，返回保守结果
      return { href: `/?page=${encodeURIComponent(target)}`, exists: false };
    }

    // 尝试按 hpath 匹配
    const rel = target.replace(/^\//, "");
    let doc = this.docByHPath.get(rel);
    if (!doc) doc = this.docByHPath.get(rel.toLowerCase());
    if (!doc) {
      // 尝试按 stem 匹配
      const stem = target.split("/").pop()!;
      for (const d of this.docCache) {
        if (d.hpath.replace(/^\//, "").split("/").pop() === stem) {
          doc = d;
          break;
        }
      }
    }

    if (doc) {
      const docRel = doc.hpath.replace(/^\//, "");
      return { href: `/?page=${encodeURIComponent(docRel)}`, exists: true };
    }
    return { href: `/?page=${encodeURIComponent(target)}`, exists: false };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private parseFrontmatter(
    content: string,
    doc: SiYuanBlock,
  ): { frontmatter: Record<string, unknown> | null; title: string | null } {
    let frontmatter: Record<string, unknown> | null = null;
    const m = /^---\n([\s\S]*?)\n---/.exec(content);
    if (m) {
      frontmatter = {};
      for (const line of m[1]!.split("\n")) {
        const idx = line.indexOf(":");
        if (idx < 0) continue;
        frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }
    const h1 = /^#\s+(.+?)\s*$/m.exec(content);
    const title =
      (frontmatter && typeof frontmatter.title === "string" && (frontmatter.title as string)) ||
      (h1 && h1[1]) ||
      doc.name ||
      doc.hpath.split("/").pop() ||
      null;
    return { frontmatter, title };
  }
}
