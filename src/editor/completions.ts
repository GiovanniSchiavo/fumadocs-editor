import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  snippet,
} from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";
import {
  defaultComponentHints as DEFAULT_HINTS,
  type MdxComponentHint,
  type MdxComponentImport,
  planImportEdit,
} from "./component-hints";

export type { MdxComponentHint, MdxComponentImport } from "./component-hints";

const MARKDOWN_BLOCKS: Array<{ label: string; detail: string; apply: string }> =
  [
    { label: "heading", detail: "Heading", apply: "## ${}" },
    { label: "paragraph", detail: "Paragraph", apply: "${}" },
    {
      label: "code",
      detail: "Fenced code block",
      apply: "```${1:ts}\n${}\n```",
    },
    {
      label: "table",
      detail: "Markdown table",
      apply:
        "| ${1:Column} | ${2:Column} |\n| ------ | ------ |\n| ${3:value} | ${4:value} |",
    },
    {
      label: "link",
      detail: "Link",
      apply: "[${1:text}](https://example.com)",
    },
    { label: "image", detail: "Image", apply: "![${1:alt}](/image.png)" },
    { label: "divider", detail: "Horizontal rule", apply: "---" },
    { label: "task", detail: "Task list", apply: "- [ ] ${}" },
    { label: "quote", detail: "Blockquote", apply: "> ${}" },
    {
      label: "frontmatter",
      detail: "Frontmatter block",
      apply:
        "---\ntitle: ${1:Title}\ndescription: ${2:Description}\n---\n\n${}",
    },
  ];

const FRONTMATTER_KEYS = [
  "title",
  "description",
  "icon",
  "full",
  "pages",
  "root",
  "defaultOpen",
  "collapsible",
];

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const LANGUAGE_HINTS = [
  "bash",
  "css",
  "diff",
  "html",
  "js",
  "json",
  "jsx",
  "md",
  "mdx",
  "ts",
  "tsx",
  "yaml",
].map((label) => ({ label, type: "keyword" }));

export function createCompletionSource(
  hints: MdxComponentHint[] = [],
): (context: CompletionContext) => CompletionResult | null {
  const components = [...defaults(hints)].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (context) => {
    const doc = context.state.doc.toString();

    const component = componentCompletions(context, components);
    if (component) return component;

    const frontmatter = frontmatterCompletions(context, doc);
    if (frontmatter) return frontmatter;

    return markdownCompletions(context);
  };
}

function defaults(hints: MdxComponentHint[]): MdxComponentHint[] {
  const seen = new Set(hints.map((hint) => hint.name));
  return [...hints, ...DEFAULT_HINTS.filter((hint) => !seen.has(hint.name))];
}

function componentCompletions(
  context: CompletionContext,
  components: MdxComponentHint[],
): CompletionResult | null {
  const match = context.matchBefore(/<[A-Za-z][A-Za-z0-9]*/);
  if (!match || insideCodeFence(context)) return null;

  const prefix = match.text.slice(1).toLowerCase();
  const options = components
    .filter(
      (hint) =>
        prefix.length === 0 || hint.name.toLowerCase().startsWith(prefix),
    )
    .map((hint) => ({
      label: hint.name,
      detail: hint.import ? "component (adds import)" : "component",
      info: hint.description,
      type: "class",
      apply: createComponentApply(hint),
    }));

  if (options.length === 0) return null;
  return { from: match.from, options, filter: false };
}

function createComponentApply(
  hint: MdxComponentHint,
): (
  view: EditorView,
  completion: Completion,
  from: number,
  to: number,
) => void {
  const applySnippet = snippet(hint.snippet);
  return (view, completion, from, to) => {
    applySnippet(view, completion, from, to);
    if (hint.import) ensureImport(view, hint.import);
  };
}

function ensureImport(view: EditorView, hint: MdxComponentImport): void {
  const edit = planImportEdit(view.state.doc.toString(), hint);
  if (!edit) return;
  view.dispatch({ changes: edit });
}

function frontmatterCompletions(
  context: CompletionContext,
  doc: string,
): CompletionResult | null {
  const frontmatter = FRONTMATTER_PATTERN.exec(doc);
  if (!frontmatter) return null;

  const end = frontmatter[0].length;
  if (context.pos > end) return null;

  const word = context.matchBefore(/\w+/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  return {
    from: word.from,
    options: FRONTMATTER_KEYS.map((key) => ({
      label: key,
      type: "property",
      apply: `${key}: `,
    })),
  };
}

function markdownCompletions(
  context: CompletionContext,
): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);

  const fence = /^```(\w*)$/.exec(before);
  if (fence) {
    return {
      from: line.from + 3,
      options: LANGUAGE_HINTS.filter((language) =>
        language.label.startsWith(fence[1] ?? ""),
      ),
      validFor: /^\w*$/,
    };
  }

  const word = context.matchBefore(/[\w]*/);
  if (!word) return null;
  if (word.from === word.to && !context.explicit) return null;

  return {
    from: word.from,
    options: MARKDOWN_BLOCKS.map((block) => ({
      label: block.label,
      detail: block.detail,
      type: "keyword",
      apply: snippet(block.apply),
    })),
  };
}

function insideCodeFence(context: CompletionContext): boolean {
  const doc = context.state.doc;
  const currentLine = doc.lineAt(context.pos).number;
  let fences = 0;

  for (let number = 1; number <= currentLine; number += 1) {
    const text = doc.line(number).text;
    if (/^\s*```/.test(text)) fences += 1;
  }

  return fences % 2 === 1;
}
