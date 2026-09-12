import type { Diagnostic } from "@codemirror/lint";
import { parseDocument } from "yaml";
import type { PageFormat } from "../content/model";
import { splitSource } from "./frontmatter";

export interface LintOptions {
  format?: PageFormat;
}

interface MessagePosition {
  offset?: number;
  line?: number;
  column?: number;
}

interface MdxMessage {
  line?: number | null;
  column?: number | null;
  reason?: string;
  message?: string;
  ruleId?: string | null;
  fatal?: boolean | null;
  place?: {
    start?: MessagePosition | null;
    end?: MessagePosition | null;
  } | null;
}

interface LintProcessor {
  process: (value: string) => Promise<{ messages: MdxMessage[] }>;
}

let processorPromise: Promise<LintProcessor> | null = null;
let markdownProcessorPromise: Promise<LintProcessor> | null = null;

export async function lintSource(
  source: string,
  options: LintOptions = {},
): Promise<Diagnostic[]> {
  const diagnostics = lintFrontmatter(source);
  diagnostics.push(...(await lintMdx(source, options.format ?? "mdx")));
  return diagnostics;
}

function lintFrontmatter(source: string): Diagnostic[] {
  const split = splitSource(source);
  if (split.frontmatter === null) return [];

  let document: ReturnType<typeof parseDocument>;
  try {
    document = parseDocument(split.frontmatter);
  } catch {
    return [];
  }

  return document.errors.map((error) => {
    const from = clamp(
      split.frontmatterStart + (error.pos?.[0] ?? 0),
      0,
      source.length,
    );
    const to = clamp(
      split.frontmatterStart +
        Math.max(error.pos?.[1] ?? 0, (error.pos?.[0] ?? 0) + 1),
      0,
      source.length,
    );

    return {
      from,
      to: Math.max(to, Math.min(from + 1, source.length)),
      severity: "error" as const,
      source: "yaml",
      message: error.message,
    };
  });
}

async function lintMdx(
  source: string,
  format: PageFormat,
): Promise<Diagnostic[]> {
  const split = splitSource(source);
  const body = split.frontmatter === null ? source : split.body;
  const bodyOffset = split.frontmatter === null ? 0 : split.bodyStart;

  try {
    const processor = await getProcessor(format);
    const file = await processor.process(body);
    return file.messages
      .map((message) => toDiagnostic(message, body, bodyOffset, source.length))
      .filter((diagnostic): diagnostic is Diagnostic => diagnostic !== null);
  } catch (caught) {
    if (isMdxMessage(caught)) {
      caught.fatal = true;
      const diagnostic = toDiagnostic(caught, body, bodyOffset, source.length);
      return diagnostic ? [diagnostic] : [];
    }
    return [];
  }
}

async function getProcessor(format: PageFormat): Promise<LintProcessor> {
  if (format === "md") {
    if (!markdownProcessorPromise) {
      markdownProcessorPromise = createProcessor("md");
    }
    return markdownProcessorPromise;
  }
  if (!processorPromise) {
    processorPromise = createProcessor("mdx");
  }
  return processorPromise;
}

async function createProcessor(format: PageFormat): Promise<LintProcessor> {
  const [mdx, remarkLint, rules] = await Promise.all([
    import("@mdx-js/mdx"),
    import("remark-lint"),
    loadRules(),
  ]);

  const { createProcessor } = mdx as unknown as {
    createProcessor: (options: {
      format: PageFormat;
      remarkPlugins: unknown[];
      rehypePlugins: unknown[];
    }) => LintProcessor;
  };

  return createProcessor({
    format,
    remarkPlugins: [unwrap(remarkLint), ...rules],
    rehypePlugins: [],
  });
}

async function loadRules(): Promise<unknown[]> {
  const [
    noUndefinedReferences,
    noUnusedDefinitions,
    noDuplicateDefinitions,
    headingIncrement,
    fencedCodeFlag,
    codeBlockStyle,
    listItemIndent,
    noBlockquoteWithoutMarker,
    noHeadingContentIndent,
    noConsecutiveBlankLines,
    finalNewline,
  ] = await Promise.all([
    import("remark-lint-no-undefined-references"),
    import("remark-lint-no-unused-definitions"),
    import("remark-lint-no-duplicate-definitions"),
    import("remark-lint-heading-increment"),
    import("remark-lint-fenced-code-flag"),
    import("remark-lint-code-block-style"),
    import("remark-lint-list-item-indent"),
    import("remark-lint-no-blockquote-without-marker"),
    import("remark-lint-no-heading-content-indent"),
    import("remark-lint-no-consecutive-blank-lines"),
    import("remark-lint-final-newline"),
  ]);

  return [
    unwrap(noUndefinedReferences),
    unwrap(noUnusedDefinitions),
    unwrap(noDuplicateDefinitions),
    unwrap(headingIncrement),
    [unwrap(fencedCodeFlag), { allowEmpty: false }],
    [unwrap(codeBlockStyle), "fenced"],
    [unwrap(listItemIndent), "one"],
    unwrap(noBlockquoteWithoutMarker),
    unwrap(noHeadingContentIndent),
    unwrap(noConsecutiveBlankLines),
    unwrap(finalNewline),
  ];
}

function unwrap(module: { default?: unknown } | unknown): unknown {
  return (module as { default?: unknown }).default ?? module;
}

function toDiagnostic(
  message: MdxMessage,
  body: string,
  bodyOffset: number,
  sourceLength: number,
): Diagnostic | null {
  const reason = message.reason ?? message.message;
  if (!reason) return null;

  const start = resolveOffset(
    message.place?.start,
    message.line,
    message.column,
    body,
  );
  const end = resolveOffset(message.place?.end, null, null, body);
  const from = clamp(bodyOffset + start, 0, sourceLength);
  const to = clamp(bodyOffset + Math.max(end, start + 1), 0, sourceLength);

  return {
    from,
    to: Math.max(to, Math.min(from + 1, sourceLength)),
    severity: message.fatal ? "error" : "warning",
    source: message.ruleId ?? "mdx",
    message: reason,
  };
}

function resolveOffset(
  position: MessagePosition | null | undefined,
  line: number | null | undefined,
  column: number | null | undefined,
  body: string,
): number {
  if (position?.offset !== undefined) return position.offset;

  const targetLine = position?.line ?? line ?? 1;
  const targetColumn = position?.column ?? column ?? 1;
  return offsetAt(body, targetLine, targetColumn);
}

function offsetAt(body: string, line: number, column: number): number {
  let offset = 0;
  let current = 1;

  while (current < line) {
    const next = body.indexOf("\n", offset);
    if (next === -1) return body.length;
    offset = next + 1;
    current += 1;
  }

  return Math.min(offset + Math.max(0, column - 1), body.length);
}

function isMdxMessage(value: unknown): value is MdxMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as MdxMessage;
  return (
    typeof message.reason === "string" ||
    typeof message.message === "string" ||
    message.line !== undefined
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
