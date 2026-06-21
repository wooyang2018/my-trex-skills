import * as yaml from "js-yaml";
import { AuditEntrySchema, type AuditEntry } from "./schema.js";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
const ANY_FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/gm;

/**
 * Render an AuditEntry as the full markdown file contents
 * (YAML frontmatter + body). The body typically contains the
 * `# Comment` and optional `# Resolution` sections.
 */
export function toMarkdown(entry: AuditEntry): string {
  const bodyText = entry.body && entry.body.trim().length > 0 ? entry.body : defaultBody();
  return `---\n${frontmatter(entry)}---\n\n${bodyText.trimEnd()}\n`;
}

/**
 * Parse the full markdown contents of an audit file back into an AuditEntry.
 * Throws if the frontmatter is missing or fails schema validation.
 */
export function fromMarkdown(text: string): AuditEntry {
  const m = FRONTMATTER_RE.exec(text);
  if (m) {
    const frontRaw = parseFrontmatter(m[1]!);
    if (looksLikeAuditFrontmatter(frontRaw)) {
      const body = (m[2] ?? "").replace(/^\n/, "");
      return AuditEntrySchema.parse({ ...frontRaw, body });
    }
  }

  for (const match of text.matchAll(ANY_FRONTMATTER_RE)) {
    const frontRaw = parseFrontmatter(match[1]!);
    if (!looksLikeAuditFrontmatter(frontRaw)) continue;
    const body = text.slice((match.index ?? 0) + match[0].length).replace(/^\n/, "");
    return AuditEntrySchema.parse({ ...frontRaw, body });
  }

  throw new Error("audit file is missing audit YAML frontmatter");
}

function parseFrontmatter(text: string): Record<string, unknown> | null {
  try {
    const value = yaml.load(text);
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function looksLikeAuditFrontmatter(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "target" in value &&
      "status" in value,
  );
}

function frontmatter(entry: AuditEntry): string {
  return [
    `id: ${scalar(entry.id)}`,
    `target: ${scalar(entry.target)}`,
    `target_lines: [${entry.target_lines[0]}, ${entry.target_lines[1]}]`,
    `anchor_before: ${scalar(entry.anchor_before)}`,
    `anchor_text: ${scalar(entry.anchor_text)}`,
    `anchor_after: ${scalar(entry.anchor_after)}`,
    `severity: ${scalar(entry.severity)}`,
    `author: ${scalar(entry.author)}`,
    `source: ${scalar(entry.source)}`,
    `created: ${scalar(entry.created)}`,
    `status: ${scalar(entry.status)}`,
    "",
  ].join("\n");
}

function scalar(value: string): string {
  return JSON.stringify(value);
}

function defaultBody(): string {
  return `# Comment\n\n<!-- describe the feedback here -->\n\n# Resolution\n\n<!-- filled in when the audit is processed -->\n`;
}
