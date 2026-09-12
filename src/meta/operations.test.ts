import { describe, expect, it } from "vitest";
import { buildContentTree, type ContentModel } from "../content/model";
import { applyMutation } from "./operations";
import { effectiveEntries, parsePageEntry } from "./pages";
import type { MetaData, WorkspaceChange } from "./types";

function model(
  files: string[],
  metas: Record<string, MetaData> = {},
): ContentModel {
  return { files, metas };
}

function applyPages(
  result: { changes: WorkspaceChange[] },
  path: string,
): string[] {
  for (const change of [...result.changes].reverse()) {
    if (change.type !== "move" && change.path === path && "content" in change) {
      return JSON.parse(change.content).pages;
    }
  }
  throw new Error(`no change for ${path}`);
}

describe("setIcon", () => {
  it("rewrites separator and link entries and folder meta", () => {
    const source = model(["guides/one.mdx"], {
      "meta.json": { pages: ["---Guides---", "[Docs](https://x.dev)"] },
    });

    const separator = applyMutation(source, {
      type: "setIcon",
      id: "separator:meta.json:0",
      icon: "Rocket",
    });
    expect(applyPages(separator, "meta.json")[0]).toBe("---[Rocket]Guides---");

    const link = applyMutation(source, {
      type: "setIcon",
      id: "link:meta.json:0",
      icon: "Book",
    });
    expect(applyPages(link, "meta.json")[1]).toBe(
      "[Book][Docs](https://x.dev)",
    );

    const cleared = applyMutation(separator.model, {
      type: "setIcon",
      id: "separator:meta.json:0",
    });
    expect(applyPages(cleared, "meta.json")[0]).toBe("---Guides---");

    const folder = applyMutation(source, {
      type: "setIcon",
      id: "guides",
      icon: "Folder",
    });
    expect(folder.model.metas["guides/meta.json"]?.icon).toBe("Folder");
  });
});

describe("pages entries", () => {
  it("parses separators, links, exclusions and rest", () => {
    expect(parsePageEntry("---Guides---")).toEqual({
      kind: "separator",
      name: "Guides",
      icon: undefined,
    });
    expect(parsePageEntry("---[Rocket]Guides---")).toEqual({
      kind: "separator",
      name: "Guides",
      icon: "Rocket",
    });
    expect(parsePageEntry("external:[Docs](https://x.dev)")).toEqual({
      kind: "link",
      name: "Docs",
      url: "https://x.dev",
      icon: undefined,
      external: true,
    });
    expect(parsePageEntry("!hidden")).toEqual({
      kind: "exclude",
      name: "hidden",
    });
    expect(parsePageEntry("z...a")).toEqual({ kind: "restReversed" });
  });

  it("keeps route-group folder names intact", () => {
    expect(parsePageEntry("(framework)")).toEqual({
      kind: "name",
      name: "(framework)",
    });
  });

  it("expands rest and removes exclusions", () => {
    expect(
      effectiveEntries(["a", "!b", "...", "---End---"], ["a", "b", "c"]),
    ).toEqual(["a", "c", "---End---"]);
    expect(effectiveEntries(["z...a"], ["a", "b", "c"])).toEqual([
      "c",
      "b",
      "a",
    ]);
  });
});

describe("tree building", () => {
  it("builds folders, index and ordered children", () => {
    const tree = buildContentTree(
      model(
        ["index.mdx", "guides/index.mdx", "guides/setup.mdx", "changelog.mdx"],
        {
          "meta.json": { pages: ["guides", "changelog"] },
          "guides/meta.json": { title: "Guides", pages: ["setup"] },
        },
      ),
    );

    expect(tree.root.index?.path).toBe("index.mdx");
    expect(tree.root.children.map((node) => node.id)).toEqual([
      "guides",
      "changelog.mdx",
    ]);

    const guides = tree.root.children[0];
    expect(guides?.type).toBe("folder");
    if (guides?.type === "folder") {
      expect(guides.name).toBe("Guides");
      expect(guides.index?.path).toBe("guides/index.mdx");
      expect(guides.children.map((node) => node.id)).toEqual([
        "guides/setup.mdx",
      ]);
    }
  });
});

describe("mutations", () => {
  it("creates a page and appends it to meta.json", () => {
    const base = model(["a.mdx"], { "meta.json": { pages: ["a"] } });
    const result = applyMutation(base, {
      type: "createPage",
      folder: "",
      name: "New Page",
      title: "New Page",
    });

    expect(result.model.files).toContain("new-page.mdx");
    expect(applyPages({ changes: result.changes }, "meta.json")).toEqual([
      "a",
      "new-page",
    ]);
  });

  it("creates a folder with an index page", () => {
    const base = model(["a.mdx"], { "meta.json": { pages: ["a"] } });
    const result = applyMutation(base, {
      type: "createFolder",
      parent: "",
      name: "Guides",
      title: "Guides",
      withIndex: true,
    });

    expect(result.model.metas["guides/meta.json"]?.title).toBe("Guides");
    expect(result.model.files).toContain("guides/index.mdx");
    expect(applyPages({ changes: result.changes }, "meta.json")).toEqual([
      "a",
      "guides",
    ]);
  });

  it("renames a folder and moves its subtree", () => {
    const base = model(["guides/index.mdx", "guides/setup.mdx"], {
      "meta.json": { pages: ["guides"] },
      "guides/meta.json": { title: "Guides" },
    });
    const result = applyMutation(base, {
      type: "renameNode",
      id: "guides",
      name: "handbook",
    });

    expect(result.model.files).toContain("handbook/index.mdx");
    expect(result.model.metas["handbook/meta.json"]).toBeTruthy();
    expect(result.model.metas["guides/meta.json"]).toBeUndefined();
    expect(applyPages({ changes: result.changes }, "meta.json")).toEqual([
      "handbook",
    ]);
  });

  it("moves a page between folders and updates both metas", () => {
    const base = model(["a.mdx", "guides/index.mdx", "guides/setup.mdx"], {
      "meta.json": { pages: ["a", "guides"] },
      "guides/meta.json": { pages: ["index", "setup"] },
    });
    const result = applyMutation(base, {
      type: "moveNode",
      id: "a.mdx",
      targetFolder: "guides",
    });

    expect(result.model.files).toContain("guides/a.mdx");
    expect(applyPages({ changes: result.changes }, "guides/meta.json")).toEqual(
      // The explicit index entry is preserved.
      ["index", "setup", "a"],
    );
  });

  it("deletes a folder and all its files", () => {
    const base = model(["guides/index.mdx", "guides/setup.mdx"], {
      "meta.json": { pages: ["guides"] },
      "guides/meta.json": { pages: ["index", "setup"] },
    });
    const result = applyMutation(base, { type: "deleteNode", id: "guides" });

    expect(result.model.files).toEqual([]);
    expect(result.model.metas["guides/meta.json"]).toBeUndefined();
    expect(applyPages({ changes: result.changes }, "meta.json")).toEqual([]);
  });

  it("adds separators and links", () => {
    const base = model(["a.mdx"], { "meta.json": { pages: ["a"] } });
    const withSeparator = applyMutation(base, {
      type: "addSeparator",
      folder: "",
      name: "More",
    });
    expect(applyPages(withSeparator, "meta.json")).toEqual(["a", "---More---"]);

    const withLink = applyMutation(withSeparator.model, {
      type: "addLink",
      folder: "",
      name: "GitHub",
      url: "https://github.com",
      external: true,
    });
    expect(applyPages(withLink, "meta.json")).toEqual([
      "a",
      "---More---",
      "external:[GitHub](https://github.com)",
    ]);
  });

  it("updates folder meta props and removes keys", () => {
    const base = model(["guides/index.mdx"], {
      "guides/meta.json": { title: "Old", root: true },
    });
    const result = applyMutation(base, {
      type: "setMeta",
      metaPath: "guides/meta.json",
      patch: { title: "New", root: null, defaultOpen: true },
    });

    expect(result.model.metas["guides/meta.json"]).toEqual({
      title: "New",
      defaultOpen: true,
    });
  });

  it("rejects moving a folder into itself", () => {
    const base = model(["guides/setup.mdx"], {
      "meta.json": { pages: ["guides"] },
    });
    expect(() =>
      applyMutation(base, {
        type: "moveNode",
        id: "guides",
        targetFolder: "guides",
      }),
    ).toThrowError("Cannot move a folder into itself.");
  });
});
