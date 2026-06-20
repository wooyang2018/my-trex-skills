import type { Request, Response } from "express";
import type { ContentProvider, WikiPage } from "../content/provider.js";
import { createRenderer } from "../render/markdown.js";

export function handlePage(provider: ContentProvider) {
  return async (req: Request, res: Response) => {
    const relRaw = (req.query.path as string | undefined) ?? "";
    if (!relRaw) {
      res.status(400).json({ error: "missing or invalid `path` query" });
      return;
    }

    try {
      const page: WikiPage | null = await provider.getPage(relRaw);
      if (!page) {
        res.status(404).json({ error: "page not found", path: relRaw });
        return;
      }

      const renderer = createRenderer({ provider });
      const rendered = renderer.render(page.content);
      res.json({
        path: page.path,
        title: rendered.title,
        frontmatter: rendered.frontmatter,
        html: rendered.html,
        raw: rendered.rawMarkdown,
      });
    } catch (err) {
      console.error("page error:", err);
      res.status(500).json({ error: "failed to load page", detail: String(err) });
    }
  };
}

export function handleRaw(provider: ContentProvider) {
  return async (req: Request, res: Response) => {
    const relRaw = (req.query.path as string | undefined) ?? "";
    if (!relRaw) {
      res.status(400).send("bad path");
      return;
    }

    try {
      const content = await provider.getRaw(relRaw);
      if (content === null) {
        res.status(404).send("not found");
        return;
      }
      res.type("text/markdown").send(content);
    } catch (err) {
      console.error("raw error:", err);
      res.status(500).send(String(err));
    }
  };
}
