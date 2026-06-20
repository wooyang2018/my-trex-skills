/**
 * ContentProvider 工厂——根据 ServerConfig 创建合适的 provider 实例。
 */

import type { ServerConfig } from "../config.js";
import type { ContentProvider } from "./provider.js";
import { LocalContentProvider } from "./local-provider.js";
import { SiYuanContentProvider } from "./siyuan-provider.js";

export function createContentProvider(cfg: ServerConfig): ContentProvider {
  if (cfg.mode === "siyuan") {
    return new SiYuanContentProvider({
      apiBase: cfg.siyuanApi!,
      notebookId: cfg.siyuanNotebook!,
      token: cfg.siyuanToken,
    });
  }
  return new LocalContentProvider(cfg.wikiRoot!);
}
