import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  CircleDot,
  GitFork,
  Menu,
  MessageSquarePlus,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Search,
  TerminalSquare,
  X,
} from "lucide-react";
import mermaid from "mermaid";
import type { AuditEntry } from "../../shared/audit/index.js";
import { renderGraph, type GraphData, type GraphNode } from "../graph.js";
import { ParticleField } from "../particles.js";
import "../styles.css";

interface TreeNode {
  name: string;
  path: string;
  kind: "file" | "dir";
  children?: TreeNode[];
}

interface PageResponse {
  path: string;
  title: string | null;
  html: string;
  raw: string;
  frontmatter: Record<string, unknown> | null;
}

interface ConfigResponse {
  author?: string;
  mode?: string;
  notebookId?: string;
  workspaceNotebook?: string;
  profile?: string | null;
}

type Panel = "nav" | "audit" | null;
type Severity = "info" | "suggest" | "warn" | "error";

const DEFAULT_PAGE = "wiki/index";
const severities: Severity[] = ["info", "suggest", "warn", "error"];

mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  securityLevel: "loose",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  themeVariables: {
    background: "#0b0f12",
    primaryColor: "#182126",
    primaryTextColor: "#eef5f1",
    primaryBorderColor: "#7bd88f",
    secondaryColor: "#202b31",
    secondaryTextColor: "#d7e0dc",
    secondaryBorderColor: "#f0b35b",
    tertiaryColor: "#10171b",
    tertiaryTextColor: "#d7e0dc",
    tertiaryBorderColor: "#6f7c82",
    lineColor: "#6f7c82",
    textColor: "#d7e0dc",
    mainBkg: "#182126",
    nodeBorder: "#7bd88f",
    clusterBkg: "#10171b",
    clusterBorder: "#334149",
    titleColor: "#eef5f1",
    edgeLabelBackground: "#10171b",
  },
});

function App(): React.ReactElement {
  const [config, setConfig] = useState<ConfigResponse>({});
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [page, setPage] = useState<PageResponse | null>(null);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [pageStatus, setPageStatus] = useState("Booting reader");
  const [auditStatus, setAuditStatus] = useState("Audit channel idle");
  const [graphOpen, setGraphOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<Panel>(null);
  const [feedback, setFeedback] = useState<FeedbackDraft | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [treeFilter, setTreeFilter] = useState("");
  const articleRef = useRef<HTMLElement | null>(null);

  const author = config.author ?? "user";
  const currentPath = page?.path ?? DEFAULT_PAGE;
  const rawMarkdown = page?.raw ?? "";

  const loadAudits = useCallback(async (targetPath: string) => {
    setAuditStatus("Reading audit index");
    try {
      const data = await fetchJson<{ entries?: AuditEntry[] }>(
        `/api/audit?target=${encodeURIComponent(targetPath)}&mode=open`,
      );
      const entries = Array.isArray(data.entries) ? data.entries : [];
      setAudits(entries);
      setAuditStatus(entries.length ? `${entries.length} open audit${entries.length === 1 ? "" : "s"}` : "No open audits");
    } catch (err) {
      console.error(err);
      setAudits([]);
      setAuditStatus("Audit channel unavailable");
    }
  }, []);

  const loadPage = useCallback(async (path: string, push = true) => {
    setPageStatus(`Loading ${path}`);
    try {
      const data = await fetchJson<PageResponse>(`/api/page?path=${encodeURIComponent(path)}`);
      setPage(data);
      setPageStatus("Document online");
      if (push) {
        history.pushState({ page: data.path }, "", `/?page=${encodeURIComponent(data.path)}`);
      }
      await loadAudits(data.path);
      requestAnimationFrame(() => {
        document.querySelector(".reader-scroll")?.scrollTo({ top: 0 });
      });
    } catch (err) {
      console.error(err);
      setPage(null);
      setAudits([]);
      setPageStatus(`Failed to load ${path}`);
    }
  }, [loadAudits]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [cfg, treeData] = await Promise.all([
          fetchJson<ConfigResponse>("/api/config"),
          fetchJson<TreeNode>("/api/tree"),
        ]);
        if (cancelled) return;
        setConfig(cfg);
        setTree(treeData);
      } catch (err) {
        console.error(err);
        setPageStatus("Boot failed");
      }

      const initial = new URL(window.location.href).searchParams.get("page") ?? DEFAULT_PAGE;
      if (!cancelled) await loadPage(initial, false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const next = (event.state && event.state.page) || new URL(window.location.href).searchParams.get("page") || DEFAULT_PAGE;
      void loadPage(next, false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [loadPage]);

  useEffect(() => {
    const root = articleRef.current;
    if (!root || !page) return;

    void renderMermaidBlocks(root);

    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest("a.wikilink, a[href*='?page=']") as HTMLAnchorElement | null;
      if (!target) return;
      const href = target.getAttribute("href") ?? "";
      const url = new URL(href, window.location.href);
      const next = url.searchParams.get("page");
      if (!next) return;
      event.preventDefault();
      setMobilePanel(null);
      void loadPage(next, true);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [loadPage, page]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isEditableFocused()) return;
      if (event.key === "g" || event.key === "G") {
        event.preventDefault();
        setGraphOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setGraphOpen(false);
        setMobilePanel(null);
        setPopover(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onSelection = () => {
      const article = articleRef.current;
      const selection = document.getSelection();
      if (!article || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
        setPopover(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!article.contains(range.commonAncestorContainer)) {
        setPopover(null);
        return;
      }
      const text = selection.toString();
      if (!text.trim()) {
        setPopover(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setPopover({
        x: window.scrollX + rect.left,
        y: window.scrollY + rect.top - 44,
        text,
        range,
      });
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, []);

  const openFeedback = useCallback(() => {
    if (!popover || !rawMarkdown) return;
    const offsets = resolveSelectionToRawOffsets(rawMarkdown, popover.range, popover.text);
    if (!offsets) {
      window.alert("Couldn't locate the selection in source markdown. Try selecting a more unique text span.");
      return;
    }
    setFeedback({
      ...offsets,
      text: popover.text,
      severity: "warn",
      comment: "",
    });
    setPopover(null);
  }, [popover, rawMarkdown]);

  const saveFeedback = useCallback(async (draft: FeedbackDraft) => {
    const data = await fetchJson<{ id: string }>("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: currentPath,
        rawMarkdown,
        selStart: draft.selStart,
        selEnd: draft.selEnd,
        comment: draft.comment,
        severity: draft.severity,
        author,
      }),
    });
    setAuditStatus(`Audit ${data.id} captured`);
    setFeedback(null);
    await loadAudits(currentPath);
  }, [author, currentPath, loadAudits, rawMarkdown]);

  const resolveAudit = useCallback(async (id: string) => {
    const resolution = window.prompt("Resolution note (optional):", "") ?? "";
    await fetchJson(`/api/audit/${id}/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    });
    await loadAudits(currentPath);
  }, [currentPath, loadAudits]);

  const selectPage = useCallback((path: string) => {
    setMobilePanel(null);
    void loadPage(path, true);
  }, [loadPage]);

  const title = page?.title ?? page?.path ?? "No document";
  const categories = useMemo(() => summarizeTree(tree), [tree]);

  return (
    <div className="app-shell">
      <header className="command-bar">
        <div className="brand-block">
          <button className="icon-button mobile-only" type="button" onClick={() => setMobilePanel("nav")} aria-label="Open navigation">
            <Menu size={18} />
          </button>
          <div className="brand-mark"><TerminalSquare size={18} /></div>
          <div>
            <div className="brand-title">LLM Wiki</div>
            <div className="brand-subtitle">{config.workspaceNotebook ?? config.notebookId ?? "SiYuan CLI"}</div>
          </div>
        </div>
        <div className="status-rail" aria-label="System status">
          <StatusPill icon={<CircleDot size={13} />} label={config.mode ?? "siyuan-cli"} tone="green" />
          <StatusPill icon={<Activity size={13} />} label={pageStatus} tone={page ? "green" : "amber"} />
          <StatusPill icon={<AlertTriangle size={13} />} label={auditStatus} tone={audits.length ? "amber" : "muted"} />
        </div>
        <div className="command-actions">
          <button className="tool-button" type="button" onClick={() => void loadAudits(currentPath)}>
            <RefreshCw size={15} /> Audit
          </button>
          <button className="tool-button strong" type="button" onClick={() => setGraphOpen(true)}>
            <GitFork size={15} /> Graph
          </button>
          <button className="icon-button mobile-only" type="button" onClick={() => setMobilePanel("audit")} aria-label="Open audits">
            <PanelRight size={18} />
          </button>
        </div>
      </header>

      <aside className={`nav-pane ${mobilePanel === "nav" ? "is-open" : ""}`}>
        <PanelHeader icon={<PanelLeft size={15} />} title="Index" meta={`${categories} sectors`} onClose={() => setMobilePanel(null)} />
        <label className="filter-box">
          <Search size={15} />
          <input value={treeFilter} onChange={(event) => setTreeFilter(event.target.value)} placeholder="filter pages" />
        </label>
        <nav className="tree-scroll">
          {tree ? <TreeView root={tree} activePath={currentPath} filter={treeFilter} onSelect={selectPage} /> : <LoadingBlock label="Loading tree" />}
        </nav>
      </aside>

      <main className="reader-pane">
        <section className="reader-header">
          <div>
            <div className="eyebrow">compiled page</div>
            <h1>{title}</h1>
          </div>
          <div className="path-readout">{currentPath}</div>
        </section>
        <section className="reader-scroll">
          {page ? (
            <article ref={articleRef} className="wiki-article" dangerouslySetInnerHTML={{ __html: page.html }} />
          ) : (
            <div className="empty-state">
              <TerminalSquare size={24} />
              <p>{pageStatus}</p>
            </div>
          )}
        </section>
      </main>

      <aside className={`audit-pane ${mobilePanel === "audit" ? "is-open" : ""}`}>
        <PanelHeader icon={<MessageSquarePlus size={15} />} title="Open Audits" meta={`${audits.length} active`} onClose={() => setMobilePanel(null)} />
        <div className="audit-scroll">
          <AuditList entries={audits} onResolve={resolveAudit} />
        </div>
      </aside>

      {mobilePanel && <button className="scrim mobile-only" type="button" aria-label="Close panel" onClick={() => setMobilePanel(null)} />}

      {popover && (
        <button
          className="selection-popover"
          type="button"
          style={{ left: popover.x, top: popover.y }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={openFeedback}
        >
          <MessageSquarePlus size={15} /> Add feedback
        </button>
      )}

      {feedback && (
        <FeedbackDialog
          draft={feedback}
          onChange={setFeedback}
          onCancel={() => setFeedback(null)}
          onSave={saveFeedback}
        />
      )}

      {graphOpen && (
        <GraphOverlay
          onClose={() => setGraphOpen(false)}
          onOpenPage={(path) => {
            setGraphOpen(false);
            void loadPage(path, true);
          }}
        />
      )}
    </div>
  );
}

function StatusPill({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: "green" | "amber" | "muted" }): React.ReactElement {
  return <span className={`status-pill tone-${tone}`}>{icon}{label}</span>;
}

function PanelHeader({ icon, title, meta, onClose }: { icon: React.ReactNode; title: string; meta: string; onClose: () => void }): React.ReactElement {
  return (
    <header className="panel-header">
      <div>
        <span className="panel-title">{icon}{title}</span>
        <span className="panel-meta">{meta}</span>
      </div>
      <button className="icon-button mobile-only" type="button" onClick={onClose} aria-label="Close panel">
        <X size={17} />
      </button>
    </header>
  );
}

function TreeView({ root, activePath, filter, onSelect }: { root: TreeNode; activePath: string; filter: string; onSelect: (path: string) => void }): React.ReactElement {
  return <ul className="tree-root">{renderTreeNode(root, activePath, filter.trim().toLowerCase(), onSelect, true)}</ul>;
}

function renderTreeNode(node: TreeNode, activePath: string, filter: string, onSelect: (path: string) => void, isRoot = false): React.ReactNode {
  const children = (node.children ?? [])
    .map((child) => renderTreeNode(child, activePath, filter, onSelect))
    .filter(Boolean);
  const matches = !filter || node.name.toLowerCase().includes(filter) || node.path.toLowerCase().includes(filter);

  if (node.kind === "dir") {
    if (!isRoot && !matches && children.length === 0) return null;
    return (
      <li className={isRoot ? "tree-root-item" : "tree-group"} key={node.path || node.name}>
        {!isRoot && (
          <button className={`tree-link tree-dir-link ${activePath === node.path ? "active" : ""}`} type="button" onClick={() => onSelect(node.path)}>
            <ChevronRight size={13} />
            <span>{node.name}</span>
          </button>
        )}
        {children.length > 0 && <ul>{children}</ul>}
      </li>
    );
  }

  if (!matches) return null;
  return (
    <li key={node.path}>
      <button className={`tree-link ${activePath === node.path ? "active" : ""}`} type="button" onClick={() => onSelect(node.path)}>
        <BookOpen size={13} />
        <span>{node.name}</span>
      </button>
    </li>
  );
}

function AuditList({ entries, onResolve }: { entries: AuditEntry[]; onResolve: (id: string) => void }): React.ReactElement {
  if (entries.length === 0) {
    return (
      <div className="empty-state compact">
        <Check size={22} />
        <p>No open audits for this page.</p>
      </div>
    );
  }
  return (
    <div className="audit-list">
      {entries.map((entry) => <AuditCard key={entry.id} entry={entry} onResolve={onResolve} />)}
    </div>
  );
}

function AuditCard({ entry, onResolve }: { entry: AuditEntry; onResolve: (id: string) => void }): React.ReactElement {
  const body = entry.body
    .replace(/^#\s*Comment\s*/i, "")
    .split(/^#\s*Resolution/im)[0]!
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  const when = new Date(entry.created).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <article className={`audit-card sev-${entry.severity}`}>
      <header>
        <span className={`severity-badge sev-${entry.severity}`}>{entry.severity}</span>
        <span>{entry.author}</span>
      </header>
      <p>{body || "(empty comment)"}</p>
      <footer>
        <code>{entry.id}</code>
        <span>{when}</span>
      </footer>
      <button className="resolve-button" type="button" onClick={() => onResolve(entry.id)}>
        <Check size={14} /> mark resolved
      </button>
    </article>
  );
}

interface FeedbackDraft {
  selStart: number;
  selEnd: number;
  text: string;
  severity: Severity;
  comment: string;
}

interface PopoverState {
  x: number;
  y: number;
  text: string;
  range: Range;
}

function FeedbackDialog({ draft, onChange, onCancel, onSave }: { draft: FeedbackDraft; onChange: (draft: FeedbackDraft) => void; onCancel: () => void; onSave: (draft: FeedbackDraft) => Promise<void> }): React.ReactElement {
  const [saving, setSaving] = useState(false);
  const canSave = draft.comment.trim().length > 0 && !saving;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({ ...draft, comment: draft.comment.trim() });
    } catch (err) {
      console.error(err);
      window.alert(`Failed to save feedback: ${String(err)}`);
      setSaving(false);
    }
  };

  return (
    <div className="modal-layer" role="presentation">
      <form className="feedback-dialog" onSubmit={submit}>
        <header>
          <div>
            <div className="eyebrow">audit capture</div>
            <h2>New feedback</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close feedback dialog">
            <X size={17} />
          </button>
        </header>

        <label className="dialog-field">
          <span>Selected text</span>
          <pre>{draft.text.length > 520 ? `${draft.text.slice(0, 520)}...` : draft.text}</pre>
        </label>

        <div className="dialog-field">
          <span>Severity</span>
          <div className="severity-grid">
            {severities.map((severity) => (
              <button
                key={severity}
                className={`severity-choice sev-${severity} ${draft.severity === severity ? "active" : ""}`}
                type="button"
                onClick={() => onChange({ ...draft, severity })}
              >
                {severity}
              </button>
            ))}
          </div>
        </div>

        <label className="dialog-field">
          <span>Comment</span>
          <textarea
            autoFocus
            value={draft.comment}
            onChange={(event) => onChange({ ...draft, comment: event.target.value })}
            placeholder="Explain what should change..."
          />
        </label>

        <footer className="dialog-actions">
          <button className="tool-button" type="button" onClick={onCancel}>Cancel</button>
          <button className="tool-button strong" type="submit" disabled={!canSave}>
            {saving ? "Saving" : "Save feedback"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function GraphOverlay({ onClose, onOpenPage }: { onClose: () => void; onOpenPage: (path: string) => void }): React.ReactElement {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("Loading graph");

  useEffect(() => {
    let teardown: (() => void) | null = null;
    let particles: ParticleField | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const data = await fetchJson<GraphData>("/api/graph");
        if (cancelled || !svgRef.current || !canvasRef.current) return;
        particles = new ParticleField(canvasRef.current, 72);
        particles.start();
        teardown = renderGraph(svgRef.current, data, {
          onNodeClick: (node: GraphNode) => onOpenPage(node.path),
        });
        setStatus(`${data.nodes.length} nodes / ${data.edges.length} links`);
      } catch (err) {
        console.error(err);
        setStatus("Graph unavailable");
      }
    })();

    return () => {
      cancelled = true;
      particles?.stop();
      teardown?.();
    };
  }, [onOpenPage]);

  return (
    <div className="graph-overlay">
      <header>
        <div>
          <div className="eyebrow">relationship map</div>
          <h2>Knowledge Graph</h2>
        </div>
        <div className="graph-status">{status}</div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close graph">
          <X size={18} />
        </button>
      </header>
      <div className="graph-stage">
        <canvas ref={canvasRef} />
        <svg ref={svgRef} />
      </div>
    </div>
  );
}

function LoadingBlock({ label }: { label: string }): React.ReactElement {
  return <div className="loading-block"><span />{label}</div>;
}

async function renderMermaidBlocks(root: HTMLElement): Promise<void> {
  const nodes = root.querySelectorAll("pre.mermaid-block code.language-mermaid");
  for (let i = 0; i < nodes.length; i++) {
    const code = nodes[i] as HTMLElement;
    const pre = code.parentElement as HTMLElement | null;
    if (!pre) continue;
    const source = code.textContent ?? "";
    const id = `mermaid-${Date.now()}-${i}`;
    try {
      const { svg } = await mermaid.render(id, source);
      const container = document.createElement("div");
      container.className = "mermaid-block";
      container.innerHTML = svg;
      const sourceLine = pre.getAttribute("data-source-line");
      if (sourceLine) container.setAttribute("data-source-line", sourceLine);
      pre.replaceWith(container);
    } catch (err) {
      console.error("mermaid render failed", err);
    }
  }
}

function summarizeTree(tree: TreeNode | null): number {
  if (!tree?.children) return 0;
  return tree.children.filter((child) => child.kind === "dir").length;
}

async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${url} returned ${res.status}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text) as T;
}

function isEditableFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

function resolveSelectionToRawOffsets(raw: string, range: Range, selText: string): { selStart: number; selEnd: number } | null {
  if (!selText) return null;

  const scope = findSourceLineAncestor(range.commonAncestorContainer);
  const lines = raw.split("\n");

  if (scope) {
    const [lineStart, lineEnd] = scope;
    const startOffset = lineStartOffset(lines, lineStart - 1);
    const endOffset = lineEnd >= lines.length ? raw.length : lineStartOffset(lines, lineEnd);
    const slice = raw.slice(startOffset, endOffset);
    const idx = slice.indexOf(selText);
    if (idx >= 0 && slice.indexOf(selText, idx + 1) < 0) {
      return { selStart: startOffset + idx, selEnd: startOffset + idx + selText.length };
    }
  }

  const idx = raw.indexOf(selText);
  if (idx < 0 || raw.indexOf(selText, idx + 1) >= 0) return null;
  return { selStart: idx, selEnd: idx + selText.length };
}

function findSourceLineAncestor(node: Node): [number, number] | null {
  let current: Node | null = node;
  while (current && current.nodeType !== Node.ELEMENT_NODE) current = current.parentNode;
  while (current && current instanceof HTMLElement) {
    const attr = current.getAttribute("data-source-line");
    if (attr) {
      const parts = attr.split(",").map((x) => Number.parseInt(x.trim(), 10));
      if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        return [parts[0]!, parts[1]!];
      }
    }
    current = current.parentElement;
  }
  return null;
}

function lineStartOffset(lines: string[], lineIndex: number): number {
  let offset = 0;
  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    offset += lines[i]!.length + 1;
  }
  return offset;
}

createRoot(document.getElementById("root")!).render(<App />);
