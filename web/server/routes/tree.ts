import type { Request, Response } from "express";
import type { ContentProvider } from "../content/provider.js";

export function handleTree(provider: ContentProvider) {
  return async (_req: Request, res: Response) => {
    try {
      const tree = await provider.getTree();
      res.json(tree);
    } catch (err) {
      console.error("tree error:", err);
      res.status(500).json({ error: "failed to build tree", detail: String(err) });
    }
  };
}
