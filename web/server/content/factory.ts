import type { ServerConfig } from "../config.js";
import type { ContentProvider } from "./provider.js";
import { SiyuanCliContentProvider } from "./siyuan-cli-provider.js";

export function createContentProvider(cfg: ServerConfig): ContentProvider {
  return new SiyuanCliContentProvider({
    notebookId: cfg.notebookId,
    workspaceNotebook: cfg.workspaceNotebook,
    profile: cfg.profile,
    timeoutMs: cfg.cliTimeoutMs,
    cacheTtlMs: cfg.cacheTtlMs,
  });
}
