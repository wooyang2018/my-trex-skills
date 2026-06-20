/**
 * ContentProvider — 抽象数据源接口。
 *
 * llm-wiki 的所有数据读取都通过这个接口进行。
 * 两种实现：
 *   - LocalContentProvider  ← 读取本地 .md 文件（原架构）
 *   - SiYuanContentProvider ← 通过 SiYuan HTTP API 直连（方案 A）
 */

/** 单个 wiki 页面的数据。 */
export interface WikiPage {
  /** 相对路径，如 "wiki/concepts/Transformers.md" 或 "concepts/Transformers" */
  path: string;
  /** 显示标题（frontmatter title > h1 > stem） */
  title: string | null;
  /** 原始 markdown 文本 */
  content: string;
  /** frontmatter 解析结果 */
  frontmatter: Record<string, unknown> | null;
}

/** 树节点（用于导航侧边栏）。 */
export interface ContentTreeNode {
  name: string;
  path: string;
  kind: "file" | "dir";
  children?: ContentTreeNode[];
}

/** 图谱节点。 */
export interface ContentGraphNode {
  id: string;
  label: string;
  path: string;
  group: string;
  degree: number;
  title: string | null;
}

/** 图谱边。 */
export interface ContentGraphEdge {
  source: string;
  target: string;
}

/** 图谱数据。 */
export interface ContentGraphData {
  nodes: ContentGraphNode[];
  edges: ContentGraphEdge[];
}

/**
 * 内容提供者接口。
 *
 * 所有路由 handler 只依赖此接口，不直接调用 fs 或 HTTP。
 * 方法均为 async，因为 SiYuanContentProvider 需要网络请求。
 */
export interface ContentProvider {
  /** 获取目录树。 */
  getTree(): Promise<ContentTreeNode>;

  /** 获取单个页面内容。返回 null 表示不存在。 */
  getPage(relPath: string): Promise<WikiPage | null>;

  /** 获取原始 markdown（用于 raw 端点）。返回 null 表示不存在。 */
  getRaw(relPath: string): Promise<string | null>;

  /** 构建图谱（节点 + 边）。 */
  getGraph(): Promise<ContentGraphData>;

  /** 解析双链 target → { href, exists }，用于 markdown 渲染时的链接解析。 */
  resolveLink(target: string): { href: string; exists: boolean } | null;
}
