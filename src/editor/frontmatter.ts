import { parse, stringify } from "yaml";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export interface SourceSplit {
  frontmatter: string | null;
  frontmatterStart: number;
  body: string;
  bodyStart: number;
}

export interface ParsedSource {
  frontmatter: Record<string, unknown>;
  body: string;
  error?: string;
}

export function splitSource(source: string): SourceSplit {
  const match = FRONTMATTER_PATTERN.exec(source);
  if (!match) {
    return {
      frontmatter: null,
      frontmatterStart: 0,
      body: source,
      bodyStart: 0,
    };
  }

  const frontmatter = match[1] ?? "";
  const rawBody = source.slice(match[0].length);
  const body = rawBody.replace(/^\r?\n/, "");

  return {
    frontmatter,
    frontmatterStart: match[0].startsWith("---\r\n") ? 5 : 4,
    body,
    bodyStart: match[0].length + (rawBody.length - body.length),
  };
}

export function parseSource(source: string): ParsedSource {
  const split = splitSource(source);
  if (split.frontmatter === null) return { frontmatter: {}, body: source };

  try {
    const data = parse(split.frontmatter) as unknown;
    return {
      frontmatter: isRecord(data) ? data : {},
      body: split.body,
    };
  } catch (caught) {
    return {
      frontmatter: {},
      body: source,
      error:
        caught instanceof Error ? caught.message : "Invalid YAML frontmatter.",
    };
  }
}

export function serializeSource(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  if (Object.keys(frontmatter).length === 0) return body;
  return `---\n${stringify(frontmatter, { lineWidth: 0 })}---\n\n${body}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
