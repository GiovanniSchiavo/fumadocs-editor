import {
  type ContentTree,
  type EditableNode,
  metaPathFor,
  pageFormat,
} from "../content/model";
import {
  defaultComponentHints,
  type MdxComponentHint,
} from "../editor/component-hints";
import { lintSource } from "../editor/diagnostics";
import { diffLines, diffStats } from "../editor/diff";
import { applyComponentSnippet } from "../editor/snippets";
import { base64ToBytes } from "../media/base64";
import {
  publicMediaSrc,
  relativeMediaSrc,
  renderMediaTemplate,
} from "../media/paths";
import type {
  MediaBase,
  MediaFileInput,
  MediaUploadResult,
  ResolvedMediaConfig,
} from "../media/types";
import type { MetaMutation, WorkspaceChange } from "../meta/types";
import type { NodeStatus } from "../workspace/types";
import type { WebMcpTool } from "./types";

export interface WebMcpWorkspace {
  tree: ContentTree | null;
  changes: WorkspaceChange[];
  statuses: Record<string, NodeStatus>;
  mediaItems: Array<{
    base: MediaBase;
    path: string;
    displayPath: string;
    status: NodeStatus;
  }>;
  mediaConfig: ResolvedMediaConfig;
  getFile(path: string): Promise<string>;
  getOriginal(path: string): Promise<string>;
  saveFile(path: string, content: string): void;
  mutate(mutation: MetaMutation): Promise<string | undefined>;
  moveNodeWithMedia(input: {
    id: string;
    targetFolder?: string;
    name?: string;
    beforeId?: string | null;
  }): Promise<string | undefined>;
  uploadMedia(
    file: MediaFileInput,
    options: { base: MediaBase; pagePath: string },
  ): Promise<MediaUploadResult>;
}

export interface WebMcpEditor {
  document: { path: string; current: string } | null;
  enter(input: { path: string; source?: string }): Promise<void>;
  exit(): void;
  insertAtCursor(text: string): void;
  formatSource(path: string, source: string): Promise<string>;
  hasFormatter: boolean;
  components: MdxComponentHint[];
}

export interface WebMcpContext {
  workspace: WebMcpWorkspace;
  editor: WebMcpEditor;
}

export interface WebMcpOptions {
  prefix?: string;
  tools?: string[];
}

export function createEditorWebMcpTools(
  getContext: () => WebMcpContext,
  options: WebMcpOptions = {},
): WebMcpTool[] {
  const prefix = options.prefix ?? "";
  const allowlist = options.tools;

  const tools: WebMcpTool[] = [
    listPagesTool(getContext),
    getContentTool(getContext),
    getOriginalTool(getContext),
    getDiffTool(getContext),
    listComponentsTool(getContext),
    listMediaTool(getContext),
    validateContentTool(getContext),
    formatContentTool(getContext),
    editContentTool(getContext),
    newPageTool(getContext),
    deletePageTool(getContext),
    reorderSidebarTool(getContext),
    addImageTool(getContext),
    insertComponentTool(getContext),
  ];

  return tools
    .filter((tool) => !allowlist || allowlist.includes(tool.name))
    .map((tool) => ({ ...tool, name: `${prefix}${tool.name}` }));
}

function resolvePath(context: WebMcpContext, value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  const open = context.editor.document?.path;
  if (open) return open;
  throw new Error(
    "No page path provided and no page is open in the editor. Call list-pages to find paths.",
  );
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function serializeNode(
  context: WebMcpContext,
  node: EditableNode,
): Record<string, unknown> {
  switch (node.type) {
    case "folder":
      return {
        type: "folder",
        path: node.path,
        name: node.name,
        icon: node.icon,
        status: context.workspace.statuses[node.path] ?? "clean",
        index: node.index?.path,
        children: node.children.map((child) => serializeNode(context, child)),
      };
    case "page":
      return {
        type: "page",
        path: node.path,
        name: node.name,
        format: pageFormat(node.path),
        status: context.workspace.statuses[node.path] ?? "clean",
      };
    case "separator":
      return { type: "separator", name: node.name };
    case "link":
      return { type: "link", name: node.name, url: node.url };
  }
}

function allComponents(context: WebMcpContext): MdxComponentHint[] {
  const custom = context.editor.components;
  const seen = new Set(custom.map((hint) => hint.name));
  return [
    ...custom,
    ...defaultComponentHints.filter((hint) => !seen.has(hint.name)),
  ];
}

function errorSummary(
  diagnostics: Awaited<ReturnType<typeof lintSource>>,
): string {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .slice(0, 5)
    .map((diagnostic) => `- ${diagnostic.message}`)
    .join("\n");
}

async function validateOrThrow(
  source: string,
  format: "md" | "mdx",
): Promise<void> {
  if (format === "md") {
    const mdxSyntax = findMdxOnlySyntax(source);
    if (mdxSyntax) {
      throw new Error(
        `Content uses MDX-only syntax (${mdxSyntax}) but the page is a .md file. Use plain markdown, or create/rename the page as .mdx to use components and expressions.`,
      );
    }
  }

  const diagnostics = await lintSource(source, { format });
  const errors = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );
  if (errors.length > 0) {
    throw new Error(
      `Content has ${errors.length} error(s) and was not saved:\n${errorSummary(diagnostics)}`,
    );
  }
}

export function findMdxOnlySyntax(source: string): string | null {
  const stripped = source
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "");

  const component = /<[A-Z][A-Za-z0-9.]*(?:\s[^<>]*)?\/?>/.exec(stripped);
  if (component) return component[0].slice(0, 40);

  const expression = /\{[^}\n]{1,80}\}/.exec(stripped);
  if (expression) return expression[0];

  return null;
}

function listPagesTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "list-pages",
    description:
      "List the documentation page tree with file paths, titles, formats and draft statuses. Use the returned paths with every other tool.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute() {
      const context = getContext();
      if (!context.workspace.tree) {
        throw new Error(
          "The content tree is not loaded yet. Try again shortly.",
        );
      }
      return json({
        openDocument: context.editor.document?.path ?? null,
        root: context.workspace.tree.root.children.map((node) =>
          serializeNode(context, node),
        ),
      });
    },
  };
}

function getContentTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "get-content",
    description:
      "Read the current draft source of a page (frontmatter included). Defaults to the page open in the editor.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Page path from list-pages, e.g. guides/setup.mdx.",
        },
      },
    },
    annotations: { readOnlyHint: true },
    async execute(input) {
      const context = getContext();
      const path = resolvePath(context, input.path);
      const content = await context.workspace.getFile(path);
      const drafted = context.workspace.changes.some((change) =>
        change.type === "move" ? change.to === path : change.path === path,
      );
      return json({
        path,
        format: pageFormat(path),
        drafted,
        content,
      });
    },
  };
}

function getOriginalTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "get-original",
    description:
      "Read the committed/base source of a page (before the current draft). Empty for newly created pages.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Page path from list-pages." },
      },
    },
    annotations: { readOnlyHint: true },
    async execute(input) {
      const context = getContext();
      const path = resolvePath(context, input.path);
      const content = await context.workspace.getOriginal(path);
      return json({ path, content });
    },
  };
}

function getDiffTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "get-diff",
    description:
      "Show a unified line diff between the committed source and the current draft of a page.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Page path from list-pages." },
      },
    },
    annotations: { readOnlyHint: true },
    async execute(input) {
      const context = getContext();
      const path = resolvePath(context, input.path);
      const [original, current] = await Promise.all([
        context.workspace.getOriginal(path),
        context.workspace.getFile(path),
      ]);
      const lines = diffLines(original, current);
      const stats = diffStats(lines);
      const body = lines
        .map((line) => {
          if (line.type === "add") return `+${line.value}`;
          if (line.type === "remove") return `-${line.value}`;
          return ` ${line.value}`;
        })
        .join("\n");
      return json({
        path,
        added: stats.added,
        removed: stats.removed,
        diff: body,
      });
    },
  };
}

function listComponentsTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "list-components",
    description:
      "List the MDX components available for a page (Fumadocs default + optional + custom), with import specifiers and snippets. Components can only be used in .mdx files.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Page path to check; defaults to the open page.",
        },
      },
    },
    annotations: { readOnlyHint: true },
    execute(input) {
      const context = getContext();
      const path = resolvePath(context, input.path);
      const format = pageFormat(path);
      return json({
        path,
        format,
        componentsAllowed: format === "mdx",
        components: allComponents(context).map((hint) => ({
          name: hint.name,
          description: hint.description ?? null,
          import: hint.import
            ? `${hint.import.specifiers.join(", ")} from "${hint.import.source}"`
            : null,
          snippet: hint.snippet,
        })),
      });
    },
  };
}

function listMediaTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "list-media",
    description:
      "List draft and committed media files with their storage scope and git status.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute() {
      const context = getContext();
      return json({
        items: context.workspace.mediaItems.map((item) => ({
          base: item.base,
          path: item.path,
          displayPath: item.displayPath,
          status: item.status,
        })),
      });
    },
  };
}

function validateContentTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "validate-content",
    description:
      "Validate markdown/MDX content using the editor's parser and lint rules. Returns syntax and style diagnostics without saving.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Page path used to pick md or mdx parsing.",
        },
        content: {
          type: "string",
          description: "Source to validate; defaults to the page's draft.",
        },
      },
    },
    annotations: { readOnlyHint: true },
    async execute(input) {
      const context = getContext();
      const path = resolvePath(context, input.path);
      const source =
        typeof input.content === "string"
          ? input.content
          : await context.workspace.getFile(path);
      const format = pageFormat(path);
      const diagnostics = await lintSource(source, { format });
      return json({
        path,
        format,
        errors: diagnostics.filter((d) => d.severity === "error").length,
        warnings: diagnostics.filter((d) => d.severity === "warning").length,
        diagnostics: diagnostics.map((diagnostic) => ({
          severity: diagnostic.severity,
          message: diagnostic.message,
          from: diagnostic.from,
          to: diagnostic.to,
        })),
      });
    },
  };
}

function formatContentTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "format-content",
    description:
      "Format a page with the configured formatter (Prettier for MDX). Optionally save the result to the draft.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Page path to format." },
        content: {
          type: "string",
          description: "Source to format; defaults to the page's draft.",
        },
        save: {
          type: "boolean",
          description:
            "Save the formatted source to the draft. Defaults to false.",
        },
      },
    },
    async execute(input) {
      const context = getContext();
      const path = resolvePath(context, input.path);
      if (!context.editor.hasFormatter) {
        throw new Error(
          "No formatter is configured for this editor. Pass formatter to FumadocsEditorProvider.",
        );
      }
      const source =
        typeof input.content === "string"
          ? input.content
          : await context.workspace.getFile(path);
      const formatted = await context.editor.formatSource(path, source);
      if (input.save === true) context.workspace.saveFile(path, formatted);
      return json({ path, saved: input.save === true, formatted });
    },
  };
}

function editContentTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "edit-content",
    description:
      "Replace, append or prepend the source of a page draft (frontmatter included). Content is validated before saving; syntax errors are rejected. Call get-diff after editing.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Page path from list-pages; defaults to the open page.",
        },
        content: { type: "string", description: "The markdown/MDX source." },
        mode: {
          type: "string",
          enum: ["replace", "append", "prepend"],
          description: "How to apply the content. Defaults to replace.",
        },
        open: {
          type: "boolean",
          description: "Open the page in the editor. Defaults to true.",
        },
      },
      required: ["content"],
    },
    async execute(input) {
      const context = getContext();
      const path = resolvePath(context, input.path);
      const format = pageFormat(path);
      const content = String(input.content);
      const mode =
        input.mode === "append" || input.mode === "prepend"
          ? input.mode
          : "replace";

      let next = content;
      if (mode !== "replace") {
        const current = await context.workspace.getFile(path);
        next =
          mode === "append"
            ? `${current}${current.endsWith("\n") ? "\n" : "\n\n"}${content}`
            : `${content}${content.endsWith("\n") ? "\n" : "\n\n"}${current}`;
      }

      await validateOrThrow(next, format);
      context.workspace.saveFile(path, next);

      if (input.open !== false) {
        await context.editor.enter({ path, source: next });
      }

      return json({ path, format, mode, characters: next.length, saved: true });
    },
  };
}

function newPageTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "new-page",
    description:
      "Create a new documentation page draft under a folder. The page is added to the folder's meta.json. Use format mdx (default) to allow components, md for plain markdown.",
    inputSchema: {
      type: "object",
      properties: {
        folder: {
          type: "string",
          description:
            'Folder path from list-pages; "" or omitted for the root.',
        },
        name: {
          type: "string",
          description: "Page name; used as the file name.",
        },
        title: { type: "string", description: "Frontmatter title." },
        format: {
          type: "string",
          enum: ["md", "mdx"],
          description: "File format. Defaults to mdx.",
        },
        content: {
          type: "string",
          description: "Full source; defaults to a frontmatter template.",
        },
      },
      required: ["name"],
    },
    async execute(input) {
      const context = getContext();
      const format = input.format === "md" ? "md" : "mdx";
      const title =
        typeof input.title === "string" && input.title.trim()
          ? input.title.trim()
          : String(input.name);
      const content =
        typeof input.content === "string"
          ? input.content
          : `---\ntitle: ${title}\n---\n\n`;

      await validateOrThrow(content, format);

      const path = await context.workspace.mutate({
        type: "createPage",
        folder: typeof input.folder === "string" ? input.folder : "",
        name: String(input.name),
        title,
        format,
        content,
      });

      return json({ path, format, created: true });
    },
  };
}

function deletePageTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "delete-page",
    description:
      "Delete a page or folder from the draft (never touches the repository until changes are pushed). Deleting a folder removes all of its pages and meta files.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Page or folder path from list-pages.",
        },
      },
      required: ["path"],
    },
    annotations: { consequentialHint: true },
    async execute(input) {
      const context = getContext();
      const path = String(input.path);
      await context.workspace.mutate({ type: "deleteNode", id: path });
      if (context.editor.document?.path === path) context.editor.exit();
      return json({ path, deleted: true });
    },
  };
}

function findNode(
  context: WebMcpContext,
  path: string,
): { node: EditableNode; siblings: EditableNode[]; index: number } | null {
  const root = context.workspace.tree?.root;
  if (!root) return null;

  function walk(
    siblings: EditableNode[],
  ): { node: EditableNode; siblings: EditableNode[]; index: number } | null {
    for (let index = 0; index < siblings.length; index += 1) {
      const node = siblings[index] as EditableNode;
      if (
        (node.type === "page" || node.type === "folder") &&
        node.path === path
      ) {
        return { node, siblings, index };
      }
      if (node.type === "folder") {
        const found = walk(node.children);
        if (found) return found;
      }
    }
    return null;
  }

  return walk(root.children);
}

function reorderSidebarTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "reorder-sidebar",
    description:
      "Reorder or move sidebar entries. Use folder+order to set the exact order inside a folder's meta.json, or path+targetFolder to move a page/folder (optionally before/after another entry).",
    inputSchema: {
      type: "object",
      properties: {
        folder: {
          type: "string",
          description:
            "Folder path whose pages should be reordered (list of node names).",
        },
        order: {
          type: "array",
          items: { type: "string" },
          description:
            'Entry names in the desired order, e.g. ["intro", "setup", "..."].',
        },
        path: { type: "string", description: "Page or folder path to move." },
        targetFolder: {
          type: "string",
          description: "Destination folder path; empty string for root.",
        },
        beforePath: {
          type: "string",
          description: "Reference entry for before/after placement.",
        },
        position: {
          type: "string",
          enum: ["before", "after", "inside"],
          description: "Placement relative to beforePath. Defaults to inside.",
        },
        moveMedia: {
          type: "boolean",
          description:
            "Also move images referenced by the page with relative paths and rewrite the references. Defaults to false.",
        },
      },
    },
    async execute(input) {
      const context = getContext();

      if (typeof input.folder === "string" && Array.isArray(input.order)) {
        await context.workspace.mutate({
          type: "setOrder",
          metaPath: metaPathFor(input.folder),
          pages: input.order.map(String),
        });
        return json({ folder: input.folder, order: input.order });
      }

      if (
        typeof input.path !== "string" ||
        typeof input.targetFolder !== "string"
      ) {
        throw new Error("Provide either folder+order or path+targetFolder.");
      }

      const path = input.path;
      const position =
        input.position === "before" || input.position === "after"
          ? input.position
          : "inside";
      let beforeId: string | null = null;

      if (position !== "inside") {
        if (typeof input.beforePath !== "string") {
          throw new Error("beforePath is required for before/after placement.");
        }
        const reference = findNode(context, input.beforePath);
        if (!reference) {
          throw new Error(`Reference entry not found: ${input.beforePath}`);
        }
        if (position === "before") {
          beforeId = reference.node.id;
        } else {
          beforeId = reference.siblings[reference.index + 1]?.id ?? null;
        }
      }

      const moved =
        input.moveMedia === true
          ? await context.workspace.moveNodeWithMedia({
              id: path,
              targetFolder: input.targetFolder,
              beforeId,
            })
          : await context.workspace.mutate({
              type: "moveNode",
              id: path,
              targetFolder: input.targetFolder,
              beforeId,
            });

      return json({ path, movedTo: moved, position });
    },
  };
}

function addImageTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "add-image",
    description:
      "Add an image to the draft media library and optionally insert its markdown reference into a page. Provide dataBase64 (preferred) or an http(s) url the browser can fetch.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "File name including extension, e.g. diagram.png.",
        },
        dataBase64: {
          type: "string",
          description: "Base64-encoded file bytes.",
        },
        url: {
          type: "string",
          description: "Alternative to dataBase64; fetched best-effort.",
        },
        base: {
          type: "string",
          enum: ["content", "public"],
          description:
            "Storage scope: next to the page (content) or public folder. Defaults to the editor's configured mode.",
        },
        targetPage: {
          type: "string",
          description: "Page that should reference the image.",
        },
        alt: { type: "string", description: "Alt text for the reference." },
        insert: {
          type: "boolean",
          description:
            "Append the markdown reference to the page. Defaults to true.",
        },
      },
      required: ["name"],
    },
    async execute(input) {
      const context = getContext();
      const name = String(input.name);
      const targetPage =
        typeof input.targetPage === "string" && input.targetPage
          ? input.targetPage
          : (context.editor.document?.path ?? "index.mdx");

      let bytes: Uint8Array;
      if (typeof input.dataBase64 === "string" && input.dataBase64) {
        bytes = base64ToBytes(input.dataBase64);
      } else if (typeof input.url === "string" && input.url) {
        const response = await fetch(input.url);
        if (!response.ok) {
          throw new Error(`Could not fetch ${input.url} (${response.status}).`);
        }
        bytes = new Uint8Array(await response.arrayBuffer());
      } else {
        throw new Error("Provide dataBase64 or url.");
      }

      const base: MediaBase = input.base === "public" ? "public" : "content";

      const result = await context.workspace.uploadMedia(
        {
          name,
          size: bytes.byteLength,
          async arrayBuffer() {
            const copy = new Uint8Array(bytes);
            return copy.buffer as ArrayBuffer;
          },
        },
        { base, pagePath: targetPage },
      );

      const src =
        base === "public"
          ? publicMediaSrc(context.workspace.mediaConfig, result.path)
          : relativeMediaSrc(targetPage, result.path);
      const markdown = renderMediaTemplate(
        context.workspace.mediaConfig.insertTemplate,
        {
          alt:
            typeof input.alt === "string" && input.alt
              ? input.alt
              : result.name.replace(/\.[^.]+$/, ""),
          src,
          name: result.name,
        },
      );

      let inserted = false;
      if (input.insert !== false) {
        const content = await context.workspace.getFile(targetPage);
        context.workspace.saveFile(
          targetPage,
          `${content}${content.endsWith("\n") ? "\n" : "\n\n"}${markdown}\n`,
        );
        inserted = true;
      }

      return json({
        base: result.base,
        path: result.path,
        src,
        markdown,
        inserted,
      });
    },
  };
}

function insertComponentTool(getContext: () => WebMcpContext): WebMcpTool {
  return {
    name: "insert-component",
    description:
      "Append a Fumadocs or custom MDX component to a .mdx page, adding the required import automatically. Call list-components first to see available names.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Component name from list-components.",
        },
        targetPage: {
          type: "string",
          description: "Page path; defaults to the open page.",
        },
        props: {
          type: "object",
          description: "Attributes to add to the component's opening tag.",
        },
      },
      required: ["name"],
    },
    async execute(input) {
      const context = getContext();
      const path = resolvePath(context, input.targetPage);
      if (pageFormat(path) !== "mdx") {
        throw new Error(
          `${path} is a markdown (.md) file; components require .mdx. Use edit-content with markdown instead.`,
        );
      }

      const name = String(input.name);
      const hint = allComponents(context).find((entry) => entry.name === name);
      if (!hint) {
        const available = allComponents(context)
          .map((entry) => entry.name)
          .join(", ");
        throw new Error(`Unknown component "${name}". Available: ${available}`);
      }

      const source = await context.workspace.getFile(path);
      const applied = applyComponentSnippet(source, hint, {
        props:
          input.props && typeof input.props === "object"
            ? (input.props as Record<string, unknown>)
            : undefined,
      });

      await validateOrThrow(applied.source, "mdx");
      context.workspace.saveFile(path, applied.source);
      await context.editor.enter({ path, source: applied.source });

      return json({
        path,
        component: name,
        importAdded: applied.importAdded,
        snippet: applied.snippet,
      });
    },
  };
}
