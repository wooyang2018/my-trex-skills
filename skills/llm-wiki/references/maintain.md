# Maintain

Use this for health checks, light graph cleanup, and periodic maintenance.

## Checks

- Missing required roots: `index`, `log`, `hot`, `audit`, `_meta`, category roots.
- Pages missing `custom-title`, `custom-category`, `custom-tags`, or `custom-updated`.
- Open audits older than the user's tolerance.
- Duplicate titles or near-identical hpaths.
- Important pages with no inbound refs.
- Dead block references from `search list_invalid_refs`.

## Safe defaults

Report first, edit second. For any destructive action, get explicit confirmation.

Non-destructive fixes may be applied after summarizing:

- add missing `custom-*` attrs;
- refresh `index`;
- append log entries;
- add obvious block references when both pages are already known.

Use `search get_backlinks --id <doc-id> --mode both --json` for backlink checks.
