import { describe, expect, it } from "vitest";
import { buildContentTree, pageUrl } from "./model";

describe("pageUrl", () => {
  it("maps pages under their folders", () => {
    expect(pageUrl("ui/theme.mdx", "/docs")).toBe("/docs/ui/theme");
    expect(pageUrl("headless/source-api/source.md", "/docs")).toBe(
      "/docs/headless/source-api/source",
    );
  });

  it("maps index files to their folder", () => {
    expect(pageUrl("ui/index.mdx", "/docs")).toBe("/docs/ui");
    expect(pageUrl("index.mdx", "/docs")).toBe("/docs");
  });

  it("drops route-group folders from the URL", () => {
    expect(pageUrl("(framework)/guides/access-control.mdx", "/docs")).toBe(
      "/docs/guides/access-control",
    );
    expect(pageUrl("(framework)/index.mdx", "/docs")).toBe("/docs");
    expect(pageUrl("(group)/(nested)/page.mdx", "/docs")).toBe("/docs/page");
  });
});

describe("buildContentTree", () => {
  function tree(pages: string[]) {
    return buildContentTree(
      {
        files: [
          "(framework)/index.mdx",
          "(framework)/intro.mdx",
          "(framework)/integrations/astro.mdx",
          "(framework)/integrations/next.mdx",
        ],
        metas: {
          "(framework)/meta.json": { pages },
          "(framework)/integrations/meta.json": {
            pages: ["astro", "next"],
          },
        },
        titles: {},
        icons: {},
      },
      "/docs",
    );
  }

  function children(pages: string[]) {
    const root = tree(pages).root.children[0];
    if (root?.type !== "folder") throw new Error("expected framework folder");
    return root.children.map((node) =>
      node.type === "page" ? node.path : node.type,
    );
  }

  it("inlines ...folder entries where they appear", () => {
    expect(children(["index", "intro", "...integrations"])).toEqual([
      "(framework)/index.mdx",
      "(framework)/intro.mdx",
      "(framework)/integrations/astro.mdx",
      "(framework)/integrations/next.mdx",
    ]);
  });

  it("does not repeat extracted folders in a rest expansion", () => {
    expect(children(["...integrations", "..."])).toEqual([
      "(framework)/integrations/astro.mdx",
      "(framework)/integrations/next.mdx",
      "(framework)/intro.mdx",
    ]);
  });

  it("orders pages before folders without explicit pages", () => {
    const tree = buildContentTree(
      {
        files: ["zebra.mdx", "alpha/one.mdx"],
        metas: {},
        titles: {},
        icons: {},
      },
      "/docs",
    );
    expect(
      tree.root.children.map((node) =>
        node.type === "folder"
          ? node.path
          : node.type === "page"
            ? node.path
            : node.type,
      ),
    ).toEqual(["zebra.mdx", "alpha"]);
  });

  it("pretty-prints names without titles", () => {
    const tree = buildContentTree(
      {
        files: ["guides/access-control.mdx", "guides/one.mdx"],
        metas: {},
        titles: {},
        icons: {},
      },
      "/docs",
    );
    const folder = tree.root.children[0];
    if (folder?.type !== "folder") throw new Error("expected a folder");
    expect(folder.name).toBe("Guides");
    expect(
      folder.children.map((node) => (node.type === "page" ? node.name : "")),
    ).toEqual(["Access control", "One"]);
  });
});
