import { type MdxComponentHint, planImportEdit } from "./component-hints";

export interface TextEdit {
  from: number;
  to: number;
  insert: string;
}

export function stripSnippetPlaceholders(template: string): string {
  return template.replace(/\$\{\d+:([^}]*)\}|\$\{\d*\}/g, (_match, fallback) =>
    typeof fallback === "string" ? fallback : "",
  );
}

export function injectComponentProps(
  snippet: string,
  props: Record<string, unknown> | undefined,
): string {
  if (!props || Object.keys(props).length === 0) return snippet;

  const attributes = Object.entries(props)
    .map(([name, value]) => {
      if (typeof value === "boolean") return value ? ` ${name}` : null;
      if (typeof value === "number") return ` ${name}={${value}}`;
      return ` ${name}="${String(value).replaceAll('"', '\\"')}"`;
    })
    .filter((attribute): attribute is string => attribute !== null)
    .join("");

  if (!attributes) return snippet;

  const match = /^(\s*<[A-Z][A-Za-z0-9.]*)/.exec(snippet);
  if (!match) return snippet;
  const opening = match[1] as string;
  return `${opening}${attributes}${snippet.slice(opening.length)}`;
}

export function applyTextEdits(source: string, edits: TextEdit[]): string {
  return [...edits]
    .sort((a, b) => b.from - a.from)
    .reduce(
      (result, edit) =>
        result.slice(0, edit.from) + edit.insert + result.slice(edit.to),
      source,
    );
}

export interface AppliedSnippet {
  source: string;
  snippet: string;
  importAdded: boolean;
}

export function applyComponentSnippet(
  source: string,
  hint: MdxComponentHint,
  options: {
    props?: Record<string, unknown>;
    position?: "end" | number;
  } = {},
): AppliedSnippet {
  const snippet = stripSnippetPlaceholders(
    injectComponentProps(hint.snippet, options.props),
  );

  const edits: TextEdit[] = [];
  let importAdded = false;

  if (hint.import) {
    const importEdit = planImportEdit(source, hint.import);
    if (importEdit) {
      edits.push(importEdit);
      importAdded = true;
    }
  }

  const position = options.position ?? "end";
  if (typeof position === "number") {
    edits.push({ from: position, to: position, insert: snippet });
  } else {
    const separator =
      source.length === 0 || source.endsWith("\n\n")
        ? ""
        : source.endsWith("\n")
          ? "\n"
          : "\n\n";
    edits.push({
      from: source.length,
      to: source.length,
      insert: `${separator}${snippet}`,
    });
  }

  return {
    source: applyTextEdits(source, edits),
    snippet,
    importAdded,
  };
}
