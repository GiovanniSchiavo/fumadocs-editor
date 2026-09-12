export type PageEntry =
  | { kind: "name"; name: string }
  | { kind: "extract"; name: string }
  | { kind: "exclude"; name: string }
  | { kind: "rest" }
  | { kind: "restReversed" }
  | { kind: "separator"; name?: string; icon?: string }
  | {
      kind: "link";
      name: string;
      url: string;
      icon?: string;
      external: boolean;
    };

const SEPARATOR_PATTERN = /^---(?:\[(?<icon>[^\]]+)])?(?<name>.+)---$|^---$/;
const LINK_PATTERN =
  /^(?<external>external:)?(?:\[(?<icon>[^\]]+)])?\[(?<name>[^\]]+)]\((?<url>[^)]+)\)$/;
// `...folder` inlines a folder's pages where it appears, inlining them here.
const EXTRACT_PATTERN = /^\.\.\.(.+)$/;

export const REST = "...";
export const REST_REVERSED = "z...a";
export const EXCLUDE_PREFIX = "!";

export function parsePageEntry(raw: string): PageEntry {
  if (raw === REST) return { kind: "rest" };
  if (raw === REST_REVERSED) return { kind: "restReversed" };

  const extract = EXTRACT_PATTERN.exec(raw);
  if (extract) return { kind: "extract", name: extract[1] ?? "" };

  if (raw.startsWith(EXCLUDE_PREFIX)) {
    return { kind: "exclude", name: raw.slice(EXCLUDE_PREFIX.length) };
  }

  const separator = SEPARATOR_PATTERN.exec(raw);
  if (separator) {
    return {
      kind: "separator",
      name: separator.groups?.name,
      icon: separator.groups?.icon,
    };
  }

  const link = LINK_PATTERN.exec(raw);
  if (link) {
    return {
      kind: "link",
      name: link.groups?.name ?? "",
      url: link.groups?.url ?? "",
      icon: link.groups?.icon,
      external: link.groups?.external === "external:",
    };
  }

  return { kind: "name", name: raw };
}

/**
 * Resolve a meta.json `pages` array into the effective, fully explicit
 * ordered list of entries: `...`/`z...a` are expanded, `!name` exclusions
 * removed, names deduplicated.
 */
/** Rewrite the `[Icon]` prefix of a separator or link entry. */
export function withEntryIcon(raw: string, icon?: string): string | null {
  const entry = parsePageEntry(raw);
  const prefix = icon ? `[${icon}]` : "";
  if (entry.kind === "separator") return `---${prefix}${entry.name ?? ""}---`;
  if (entry.kind === "link")
    return `${entry.external ? "external:" : ""}${prefix}[${entry.name}](${entry.url})`;
  return null;
}

export function effectiveEntries(
  pages: string[] | undefined,
  children: string[],
  indexName = "index",
): string[] {
  const available = new Set([...children, indexName]);
  const result: string[] = [];
  const seen = new Set<string>();
  const excluded = new Set<string>();

  function pushName(name: string) {
    if (!available.has(name) || seen.has(name) || excluded.has(name)) return;
    seen.add(name);
    result.push(name);
  }

  function pushRest(reversed: boolean) {
    // `children` already arrives in Fumadocs order (files, then folders) and
    // the index page is never part of a rest expansion.
    const remaining = children.filter(
      (child) =>
        child !== indexName && !seen.has(child) && !excluded.has(child),
    );
    if (reversed) remaining.reverse();
    for (const name of remaining) pushName(name);
  }

  if (!pages) {
    for (const name of children) pushName(name);
    return result;
  }

  for (const raw of pages) {
    const entry = parsePageEntry(raw);
    switch (entry.kind) {
      case "name":
        pushName(entry.name);
        break;
      case "extract":
        seen.add(entry.name);
        result.push(raw);
        break;
      case "exclude":
        excluded.add(entry.name);
        seen.add(entry.name);
        break;
      case "rest":
        pushRest(false);
        break;
      case "restReversed":
        pushRest(true);
        break;
      default:
        result.push(raw);
    }
  }

  return result;
}

export function insertEntry(
  pages: string[],
  entry: string,
  beforeEntry: string | null | undefined,
): string[] {
  const next = pages.filter((raw) => raw !== entry);
  if (beforeEntry === null || beforeEntry === undefined) {
    next.push(entry);
    return next;
  }

  const index = next.indexOf(beforeEntry);
  if (index === -1) {
    next.push(entry);
    return next;
  }

  next.splice(index, 0, entry);
  return next;
}
