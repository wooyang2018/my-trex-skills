import type { Request, Response } from "express";
import type { ContentProvider } from "../content/provider.js";
import type { ServerConfig } from "../config.js";

export function handleGraph(provider: ContentProvider) {
  return async (_req: Request, res: Response) => {
    try {
      const graph = await provider.getGraph();
      res.json(graph);
    } catch (err) {
      console.error("graph error:", err);
      res.status(500).json({ error: "failed to build graph", detail: String(err) });
    }
  };
}

// Re-export types for backwards compatibility
export type { ContentGraphNode as GraphNode, ContentGraphEdge as GraphEdge, ContentGraphData as GraphData } from "../content/provider.js";
