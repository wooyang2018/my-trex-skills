/**
 * siyuan-link.ts — 思源笔记双链语法处理。
 *
 * 思源使用 `((block-id "text"))` 作为块引用语法，
 * 以及 `![[...]]` / `!((...))` 作为嵌入语法。
 * 本模块负责：
 *   1. 清理 kramdown 中的思源元数据标记（`{: id="..." ...}`）
 *   2. 将 `((block-id "text"))` 转换为可读的 markdown 链接
 *   3. 处理嵌入语法
 */

/**
 * 清理思源 kramdown 输出，转换为标准 markdown。
 *
 * kramdown 中的思源特有标记：
 *   - {: id="20240619..." updated="20240619..."} — 块属性，全部移除
 *   - {: custom-xxx="..." } — 自定义属性，移除
 *   - 行内属性 {: ...} 也需移除
 */
export function cleanKramdown(kramdown: string): string {
  let text = kramdown;

  // 1. 移除块级属性行（独立行）：{: id="..." updated="..." ...}
  text = text.replace(/^\{:[^\n]*\}\s*$/gm, "");

  // 2. 移除行内属性（块末尾）：Some text{: id="..." ...}
  text = text.replace(/\{:[^{}]*\}/g, "");

  // 3. 清理多余空行（连续 3+ 空行 → 2 空行）
  text = text.replace(/\n{3,}/g, "\n\n");

  // 4. 处理思源块引用 ((block-id "text")) → [text](?page=block-id)
  //    格式: ((20240619xxxx "Display Text"))
  //    也支持无文本格式: ((20240619xxxx))
  text = replaceBlockRefs(text);

  // 5. 处理嵌入语法 !((block-id "text")) → 直接显示文本
  text = replaceEmbeds(text);

  // 6. 清理首尾空白
  return text.trim() + "\n";
}

/**
 * 正则匹配思源块引用: ((block-id "text")) 或 ((block-id))
 */
const BLOCK_REF_RE = /\(\(([0-9]{14}-[a-z0-9]+)(?:\s+'([^']*)')?\)\)/g;

/**
 * 将 ((block-id "text")) 替换为 markdown 链接。
 *
 * 由于运行时无法在此同步函数中查询 block-id 对应的文档路径，
 * 我们生成一个以 block-id 为目标的链接，前端路由会通过
 * SiYuanContentProvider.resolveLink 解析。
 *
 * 如果有显示文本则使用显示文本，否则使用 block-id 的短形式。
 */
export function replaceBlockRefs(text: string): string {
  return text.replace(BLOCK_REF_RE, (_match, blockId: string, displayText?: string) => {
    const label = displayText || blockId.slice(-8);
    return `[${label}](?page=${encodeURIComponent(blockId)})`;
  });
}

/**
 * 处理嵌入语法 !((block-id "text"))
 * 转换为可点击的 markdown 链接，与块引用一致。
 */
const EMBED_REF_RE = /!\(\(([0-9]{14}-[a-z0-9]+)(?:\s+'([^']*)')?\)\)/g;

export function replaceEmbeds(text: string): string {
  return text.replace(EMBED_REF_RE, (_match, blockId: string, displayText?: string) => {
    const label = displayText || blockId.slice(-8);
    return `[${label}](?page=${encodeURIComponent(blockId)})`;
  });
}

/**
 * markdown-it 插件：在渲染时处理思源块引用链接。
 *
 * 与 wikilinks.ts 的 wikilinksPlugin 类似，
 * 但匹配 `((block-id "text"))` 语法。
 *
 * 注意：cleanKramdown 已将块引用转为 [text](?page=block-id) 标准链接，
 * 所以渲染时实际上不需要额外插件——标准 markdown-it 即可处理。
 * 此函数保留供未来需要特殊样式时使用。
 */
export function isBlockRefLink(href: string): boolean {
  // ?page=20240619xxxx-xxxx 形式的链接
  return /^\?page=[0-9]{14}-[a-z0-9]+/.test(href);
}
