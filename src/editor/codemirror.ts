"use client";

import { autocompletion } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { yamlFrontmatter } from "@codemirror/lang-yaml";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { linter, lintGutter } from "@codemirror/lint";
import { EditorSelection, type Extension, Prec } from "@codemirror/state";
import { type Command, EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { basicSetup } from "codemirror";
import type { PageFormat } from "../content/model";
import { createCompletionSource, type MdxComponentHint } from "./completions";
import { lintSource } from "./diagnostics";

export interface EditorCallbacks {
  onChange: (value: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFormat?: () => void;
}

const syntaxHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: "var(--fde-syn-heading)", fontWeight: "700" },
  { tag: tags.heading2, color: "var(--fde-syn-heading)", fontWeight: "650" },
  {
    tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6],
    color: "var(--fde-syn-heading)",
    fontWeight: "600",
  },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--fde-syn-link)" },
  { tag: tags.url, color: "var(--fde-syn-link)", textDecoration: "underline" },
  { tag: tags.monospace, color: "var(--fde-syn-code)" },
  { tag: tags.quote, color: "var(--fde-syn-quote)", fontStyle: "italic" },
  { tag: tags.list, color: "var(--fde-syn-list)" },
  { tag: tags.contentSeparator, color: "var(--fde-syn-punct)" },
  { tag: tags.escape, color: "var(--fde-syn-string)" },
  { tag: tags.invalid, color: "var(--fde-error)" },
  {
    tag: [
      tags.meta,
      tags.annotation,
      tags.documentMeta,
      tags.processingInstruction,
    ],
    color: "var(--fde-syn-meta)",
  },
  {
    tag: [
      tags.keyword,
      tags.modifier,
      tags.operatorKeyword,
      tags.controlKeyword,
    ],
    color: "var(--fde-syn-keyword)",
  },
  {
    tag: [
      tags.string,
      tags.special(tags.string),
      tags.regexp,
      tags.attributeValue,
    ],
    color: "var(--fde-syn-string)",
  },
  {
    tag: [
      tags.number,
      tags.bool,
      tags.null,
      tags.atom,
      tags.constant(tags.variableName),
    ],
    color: "var(--fde-syn-number)",
  },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: "var(--fde-syn-comment)",
    fontStyle: "italic",
  },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.labelName,
    ],
    color: "var(--fde-syn-func)",
  },
  {
    tag: [
      tags.typeName,
      tags.className,
      tags.namespace,
      tags.definition(tags.typeName),
    ],
    color: "var(--fde-syn-type)",
  },
  {
    tag: [tags.propertyName, tags.attributeName],
    color: "var(--fde-syn-attr)",
  },
  {
    tag: [tags.variableName, tags.definition(tags.variableName)],
    color: "var(--fde-syn-var)",
  },
  { tag: [tags.tagName, tags.angleBracket], color: "var(--fde-syn-tag)" },
  {
    tag: [
      tags.operator,
      tags.punctuation,
      tags.separator,
      tags.bracket,
      tags.brace,
    ],
    color: "var(--fde-syn-punct)",
  },
]);

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--fde-fg)",
    backgroundColor: "transparent",
    fontSize: "13px",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    lineHeight: "1.65",
  },
  ".cm-content": {
    padding: "16px 0",
    caretColor: "var(--fde-fg)",
  },
  ".cm-line": {
    padding: "0 18px",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--fde-muted-fg)",
    border: "none",
    paddingLeft: "6px",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--fde-muted) 35%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--fde-fg)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection":
    {
      backgroundColor: "var(--fde-selection)",
      color: "inherit",
    },
  ".cm-selectionMatch": {
    backgroundColor: "var(--fde-selection-match)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--fde-fg)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--fde-muted)",
    border: "none",
    color: "var(--fde-muted-fg)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--fde-card)",
    color: "var(--fde-fg)",
    border: "1px solid var(--fde-border)",
    borderRadius: "var(--fde-radius)",
  },
  ".cm-tooltip-lint": {
    backgroundColor: "var(--fde-popover)",
    color: "var(--fde-popover-fg)",
    border: "1px solid var(--fde-border)",
    borderRadius: "10px",
    boxShadow: "0 10px 30px -12px rgba(0, 0, 0, 0.45)",
    padding: "2px",
  },
  ".cm-diagnostic": {
    padding: "8px 10px",
    fontSize: "12px",
    borderLeftWidth: "3px",
    borderLeftStyle: "solid",
    borderLeftColor: "transparent",
    borderRadius: "6px",
  },
  ".cm-diagnostic-error": {
    borderLeftColor: "var(--fde-error)",
  },
  ".cm-diagnostic-warning": {
    borderLeftColor: "var(--fde-warning)",
  },
  ".cm-diagnostic-info, .cm-diagnostic-hint": {
    borderLeftColor: "var(--fde-muted-fg)",
  },
  ".cm-panels": {
    backgroundColor: "var(--fde-card)",
    color: "var(--fde-fg)",
  },
  ".cm-panel.cm-panel-lint": {
    backgroundColor: "var(--fde-card)",
    color: "var(--fde-fg)",
    borderTop: "1px solid var(--fde-border)",
    fontSize: "12px",
  },
  ".cm-panel-lint ul li": {
    padding: "6px 8px",
    borderRadius: "6px",
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--fde-error)",
    textDecorationSkipInk: "none",
    textUnderlineOffset: "3px",
  },
  ".cm-lintRange-warning": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--fde-warning, #d97706)",
    textDecorationSkipInk: "none",
    textUnderlineOffset: "3px",
  },
  ".cm-lint-marker-error": {
    color: "var(--fde-error)",
  },
  ".cm-lint-marker-warning": {
    color: "var(--fde-warning, #d97706)",
  },
});

export interface EditorExtensionOptions {
  callbacks: () => EditorCallbacks;
  lint?: boolean;
  label?: string;
  format?: PageFormat;
  componentHints?: MdxComponentHint[];
}

export function createEditorExtensions({
  callbacks,
  lint = true,
  label,
  format = "mdx",
  componentHints = [],
}: EditorExtensionOptions): Extension[] {
  const extensions: Extension[] = [
    basicSetup,
    yamlFrontmatter({ content: markdown({ codeLanguages: languages }) }),
    syntaxHighlighting(syntaxHighlight),
    baseTheme,
    autocompletion({
      override: [createCompletionSource(componentHints)],
      activateOnTyping: true,
    }),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of(label ? { "aria-label": label } : {}),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        callbacks().onChange(update.state.doc.toString());
      }
    }),
    Prec.highest(
      keymap.of([
        {
          key: "Mod-z",
          run: () => {
            callbacks().onUndo();
            return true;
          },
        },
        {
          key: "Shift-Mod-z",
          run: () => {
            callbacks().onRedo();
            return true;
          },
        },
        {
          key: "Mod-y",
          run: () => {
            callbacks().onRedo();
            return true;
          },
        },
        {
          key: "Shift-Alt-f",
          run: () => {
            const onFormat = callbacks().onFormat;
            if (!onFormat) return false;
            onFormat();
            return true;
          },
        },
        { key: "Mod-b", run: wrapSelection("**") },
        { key: "Mod-i", run: wrapSelection("*") },
        { key: "Mod-e", run: wrapSelection("`") },
        { key: "Shift-Mod-x", run: wrapSelection("~~") },
        { key: "Mod-k", run: insertLink },
        { key: "Mod-Alt-c", run: insertCodeBlock },
      ]),
    ),
  ];

  if (lint) {
    extensions.push(
      linter((view) => lintSource(view.state.doc.toString(), { format }), {
        delay: 600,
      }),
      lintGutter(),
    );
  }

  return extensions;
}

function wrapSelection(before: string, after = before): Command {
  return (view) => {
    const { state } = view;
    const changes = state.changeByRange((range) => {
      const text = state.sliceDoc(range.from, range.to);
      const insert = `${before}${text}${after}`;
      const start = range.from + before.length;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.range(start, start + text.length),
      };
    });
    view.dispatch(changes, { scrollIntoView: true, userEvent: "input" });
    return true;
  };
}

function insertLink(view: EditorView): boolean {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to) || "text";
    const insert = `[${text}](url)`;
    const urlStart = range.from + text.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(urlStart, urlStart + 3),
    };
  });
  view.dispatch(changes, { scrollIntoView: true, userEvent: "input" });
  return true;
}

function insertCodeBlock(view: EditorView): boolean {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to);
    const insert = `\`\`\`\n${text}\n\`\`\``;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + 4),
    };
  });
  view.dispatch(changes, { scrollIntoView: true, userEvent: "input" });
  return true;
}
