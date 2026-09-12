import { describe, expect, it } from "vitest";
import { buildContentTree, type ContentModel } from "../content/model";
import { contentMediaPath, relativeMediaSrc } from "../media/paths";
import { resolveMediaConfig } from "../media/types";
import { applyMutation } from "../meta/operations";
import type { MetaMutation, WorkspaceChange } from "../meta/types";
import { applyChanges } from "../workspace/changes";
import {
  createEditorWebMcpTools,
  type WebMcpContext,
  type WebMcpEditor,
  type WebMcpWorkspace,
} from "./tools";
import type { WebMcpTool } from "./types";

class FakeWorkspace implements WebMcpWorkspace {
  base: ContentModel = {
    files: ["index.mdx", "basic.mdx", "guide.mdx"],
    metas: { "meta.json": { pages: ["index", "basic", "guide"] } },
    titles: { "index.mdx": "Home" },
    media: [],
  };
  changes: WorkspaceChange[] = [];
  contents = new Map([
    ["index.mdx", "# Home\n"],
    ["basic.mdx", "# Basic\n"],
    ["guide.mdx", "# Guide\n"],
  ]);
  statuses = {};
  mediaItems: WebMcpWorkspace["mediaItems"] = [];
  mediaConfig = resolveMediaConfig({});

  get model(): ContentModel {
    return applyChanges(this.base, this.changes);
  }

  get tree() {
    return buildContentTree(this.model);
  }

  async getFile(path: string): Promise<string> {
    for (const change of [...this.changes].reverse()) {
      if (change.type === "move" && change.to === path) {
        return this.getFile(change.from);
      }
      if (
        (change.type === "create" || change.type === "update") &&
        change.path === path
      ) {
        return change.content;
      }
    }
    return this.contents.get(path) ?? "";
  }

  async getOriginal(path: string): Promise<string> {
    return this.contents.get(path) ?? "";
  }

  saveFile(path: string, content: string): void {
    const exists = this.model.files.includes(path);
    this.contents.set(path, content);
    this.changes.push({
      type: exists ? "update" : "create",
      path,
      content,
    });
  }

  async mutate(mutation: MetaMutation): Promise<string | undefined> {
    const result = applyMutation(this.model, mutation);
    this.changes.push(...result.changes);
    for (const change of result.changes) {
      if (
        (change.type === "create" || change.type === "update") &&
        !change.encoding &&
        (change.path.endsWith(".md") || change.path.endsWith(".mdx"))
      ) {
        this.contents.set(change.path, change.content);
      }
      if (change.type === "move" && this.contents.has(change.from)) {
        this.contents.set(change.to, this.contents.get(change.from) as string);
        this.contents.delete(change.from);
      }
    }
    return result.focusId;
  }

  async moveNodeWithMedia(input: {
    id: string;
    targetFolder?: string;
    beforeId?: string | null;
  }): Promise<string | undefined> {
    return this.mutate({
      type: "moveNode",
      id: input.id,
      targetFolder: input.targetFolder ?? "",
      beforeId: input.beforeId,
    });
  }

  async uploadMedia(
    file: { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> },
    options: { base: "content" | "public"; pagePath: string },
  ) {
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(new Uint8Array(buffer)).toString("base64");
    const path =
      options.base === "public"
        ? `media/${file.name}`
        : contentMediaPath(options.pagePath, file.name);
    this.changes.push({
      type: "create",
      path,
      content: base64,
      encoding: "base64",
      base: options.base,
    });
    return {
      base: options.base,
      path,
      src:
        options.base === "public"
          ? `/public/${path}`
          : relativeMediaSrc(options.pagePath, path),
      name: file.name,
    };
  }
}

function fakeEditor(workspace: FakeWorkspace): WebMcpEditor {
  return {
    document: null,
    async enter({ path, source }) {
      this.document = {
        path,
        current: source ?? (await workspace.getFile(path)),
      };
    },
    exit() {
      this.document = null;
    },
    insertAtCursor(text) {
      if (this.document) this.document.current += text;
    },
    async formatSource(_path, source) {
      return source.replace(/\s+$/, "\n");
    },
    hasFormatter: true,
    components: [{ name: "Custom", snippet: "<Custom />" }],
  } as WebMcpEditor;
}

function createContext() {
  const workspace = new FakeWorkspace();
  const editor = fakeEditor(workspace);
  return { workspace, editor, context: { workspace, editor } as WebMcpContext };
}

function tools(context: WebMcpContext, options = {}): WebMcpTool[] {
  return createEditorWebMcpTools(() => context, options);
}

function find(list: WebMcpTool[], name: string): WebMcpTool {
  const tool = list.find((entry) => entry.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

async function run(tool: WebMcpTool, input: Record<string, unknown> = {}) {
  return (await tool.execute(input, {})) as string;
}

describe("webmcp tools", () => {
  it("lists the tree with formats", async () => {
    const { context } = createContext();
    const output = JSON.parse(await run(find(tools(context), "list-pages")));
    expect(output.root.map((node: { path: string }) => node.path)).toEqual([
      "index.mdx",
      "basic.mdx",
      "guide.mdx",
    ]);
    expect(output.root[0].format).toBe("mdx");
  });

  it("reads content, original and diff", async () => {
    const { context, workspace } = createContext();
    const list = tools(context);
    workspace.changes.push({
      type: "update",
      path: "basic.mdx",
      content: "# Basic\n\nNew paragraph\n",
    });

    const content = JSON.parse(
      await run(find(list, "get-content"), { path: "basic.mdx" }),
    );
    expect(content.content).toContain("New paragraph");

    const original = JSON.parse(
      await run(find(list, "get-original"), { path: "basic.mdx" }),
    );
    expect(original.content).toBe("# Basic\n");

    const diff = JSON.parse(
      await run(find(list, "get-diff"), { path: "basic.mdx" }),
    );
    expect(diff.added).toBeGreaterThan(0);
  });

  it("rejects invalid mdx in edit-content", async () => {
    const { context } = createContext();
    const list = tools(context);
    await expect(
      run(find(list, "edit-content"), {
        path: "basic.mdx",
        content: "# Basic\n\n<Callout>\nunclosed\n",
      }),
    ).rejects.toThrow(/error/i);
  });

  it("rejects jsx in markdown files", async () => {
    const { context, workspace } = createContext();
    workspace.base.files.push("notes.md");
    workspace.contents.set("notes.md", "# Notes\n");
    workspace.base.metas["meta.json"] = {
      pages: ["index", "basic", "notes"],
    };
    const list = tools(context);
    await expect(
      run(find(list, "edit-content"), {
        path: "notes.md",
        content: "# Notes\n\n<Callout>hi</Callout>\n",
      }),
    ).rejects.toThrow(/MDX-only/);
  });

  it("edits content and opens the page", async () => {
    const { context, editor } = createContext();
    const list = tools(context);
    const result = JSON.parse(
      await run(find(list, "edit-content"), {
        path: "basic.mdx",
        content: "# Basic\n\nUpdated\n",
      }),
    );
    expect(result.saved).toBe(true);
    expect(editor.document?.path).toBe("basic.mdx");
  });

  it("creates pages with the requested format", async () => {
    const { context, workspace } = createContext();
    const list = tools(context);
    const mdx = JSON.parse(
      await run(find(list, "new-page"), { name: "Setup Guide" }),
    );
    expect(mdx.path).toBe("setup-guide.mdx");

    const md = JSON.parse(
      await run(find(list, "new-page"), {
        name: "Plain Notes",
        format: "md",
      }),
    );
    expect(md.path).toBe("plain-notes.md");
    expect(workspace.model.files).toContain("plain-notes.md");
  });

  it("deletes pages from the draft", async () => {
    const { context, workspace } = createContext();
    const list = tools(context);
    await run(find(list, "delete-page"), { path: "basic.mdx" });
    expect(workspace.model.files).not.toContain("basic.mdx");
  });

  it("reorders and moves sidebar entries", async () => {
    const { context, workspace } = createContext();
    const list = tools(context);

    await run(find(list, "reorder-sidebar"), {
      folder: "",
      order: ["guide", "basic"],
    });
    expect(workspace.model.metas["meta.json"]?.pages).toEqual([
      "guide",
      "basic",
    ]);

    await run(find(list, "reorder-sidebar"), {
      path: "basic.mdx",
      targetFolder: "",
      beforePath: "guide.mdx",
      position: "before",
    });
    expect(workspace.model.metas["meta.json"]?.pages).toEqual([
      "basic",
      "guide",
    ]);
  });

  it("adds images and inserts the reference", async () => {
    const { context, workspace } = createContext();
    const list = tools(context);
    const base64 = Buffer.from("hello").toString("base64");
    const result = JSON.parse(
      await run(find(list, "add-image"), {
        name: "photo.png",
        dataBase64: base64,
        targetPage: "basic.mdx",
      }),
    );

    expect(result.path).toBe("photo.png");
    expect(result.markdown).toContain("![photo](./photo.png)");
    expect(await workspace.getFile("basic.mdx")).toContain(
      "![photo](./photo.png)",
    );
  });

  it("inserts components with imports for mdx only", async () => {
    const { context, workspace } = createContext();
    const list = tools(context);

    const result = JSON.parse(
      await run(find(list, "insert-component"), {
        name: "Tabs",
        targetPage: "basic.mdx",
      }),
    );
    expect(result.importAdded).toBe(true);
    const updated = await workspace.getFile("basic.mdx");
    expect(updated).toContain('from "fumadocs-ui/components/tabs"');
    expect(updated).toContain("<Tabs");

    await run(find(list, "new-page"), { name: "Notes", format: "md" });
    await expect(
      run(find(list, "insert-component"), {
        name: "Tabs",
        targetPage: "notes.md",
      }),
    ).rejects.toThrow(/markdown/);
  });

  it("validates content and formats it", async () => {
    const { context } = createContext();
    const list = tools(context);

    const validation = JSON.parse(
      await run(find(list, "validate-content"), {
        path: "basic.mdx",
        content: "# Title\n",
      }),
    );
    expect(validation.errors).toBe(0);

    const formatted = JSON.parse(
      await run(find(list, "format-content"), {
        path: "basic.mdx",
        content: "# Title   \n",
      }),
    );
    expect(formatted.formatted).toBe("# Title\n");
  });

  it("supports prefixes and marks read-only tools", () => {
    const { context } = createContext();
    const prefixed = tools(context, { prefix: "fde-" });
    expect(prefixed[0]?.name.startsWith("fde-")).toBe(true);

    const list = tools(context);
    expect(find(list, "get-content").annotations?.readOnlyHint).toBe(true);
    expect(find(list, "delete-page").annotations?.consequentialHint).toBe(true);
  });
});
