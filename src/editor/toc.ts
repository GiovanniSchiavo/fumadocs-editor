import type { TOCItemType } from "fumadocs-core/toc";
import { slugify } from "../meta/operations";
import { splitSource } from "./frontmatter";

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;

/**
 * Headings of a Markdown/MDX source, in the shape Fumadocs' table of contents
 * expects. Read straight off the text rather than the compiled document, so it
 * keeps working while the source is mid-edit and does not compile.
 */
export function sourceToc(source: string): TOCItemType[] {
  const items: TOCItemType[] = [];
  let fenced = false;

  for (const line of splitSource(source).body.split("\n")) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;

    const heading = HEADING.exec(line);
    if (!heading) continue;

    const title = inlineText(heading[2] ?? "");
    const slug = slugify(title);
    if (!slug) continue;

    items.push({
      title,
      url: `#${slug}`,
      depth: (heading[1] ?? "#").length,
    });
  }

  return items;
}

/** Strip the inline markers Markdown allows inside a heading. */
function inlineText(value: string): string {
  return value
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/([*_])([^*_]*)\1/g, "$2")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .trim();
}
