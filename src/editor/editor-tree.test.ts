import type * as PageTree from "fumadocs-core/page-tree";
import { describe, expect, it } from "vitest";
import type { EditableNode } from "../content/model";
import {
  activeRootPath,
  findNodeByPath,
  mapTabsToEditorUrls,
  mapTreeToEditorUrls,
} from "./editor-tree";

const href = (path: string) => `/editor/${path}`;

function page(path: string, url: string): PageTree.Item {
  return { type: "page", name: path, url, $id: path, $ref: path };
}

const framework: PageTree.Folder = {
  type: "folder",
  name: "Framework",
  root: true,
  $ref: { folder: "(framework)" },
  index: page("(framework)/index.mdx", "/docs"),
  children: [
    page("(framework)/intro.mdx", "/docs/intro"),
    { type: "separator", name: "Guides" },
  ],
};

const tree: PageTree.Root = {
  name: "Docs",
  $id: "root",
  children: [
    framework,
    {
      type: "folder",
      name: "UI",
      root: true,
      children: [page("ui/index.mdx", "/docs/ui")],
    },
    {
      type: "page",
      name: "GitHub",
      url: "https://github.com/fuma-nama/fumadocs",
      external: true,
    },
  ],
};

describe("mapTreeToEditorUrls", () => {
  it("points pages and folder indexes at the editor", () => {
    const mapped = mapTreeToEditorUrls(tree, href);
    const folder = mapped.children[0];
    if (folder?.type !== "folder") throw new Error("expected a folder");

    expect(folder.index?.url).toBe("/editor/(framework)/index.mdx");

    const intro = folder.children[0];
    expect(intro?.type === "page" ? intro.url : undefined).toBe(
      "/editor/(framework)/intro.mdx",
    );
    expect(folder.children[1]?.type).toBe("separator");
  });

  it("leaves external links alone", () => {
    const mapped = mapTreeToEditorUrls(tree, href);
    const external = mapped.children[2];
    expect(external?.type === "page" ? external.url : undefined).toBe(
      "https://github.com/fuma-nama/fumadocs",
    );
  });
});

describe("mapTabsToEditorUrls", () => {
  it("resolves tab links through the folder index", () => {
    const tabs = mapTabsToEditorUrls(
      [{ title: "Framework", url: "/docs", $folder: framework }],
      href,
    );
    expect(tabs[0]?.url).toBe("/editor/(framework)/index.mdx");
  });

  it("keeps tabs without a folder", () => {
    const tabs = mapTabsToEditorUrls(
      [{ title: "External", url: "https://example.com" }],
      href,
    );
    expect(tabs[0]?.url).toBe("https://example.com");
  });
});

describe("activeRootPath", () => {
  it("reads the folder path from refs", () => {
    expect(activeRootPath(framework)).toBe("(framework)");
  });

  it("derives the path from the index page", () => {
    const folder: PageTree.Folder = {
      type: "folder",
      name: "UI",
      root: true,
      index: page("ui/index.mdx", "/docs/ui"),
      children: [],
    };
    expect(activeRootPath(folder)).toBe("ui");
  });

  it("ignores the whole tree and non-root folders", () => {
    expect(activeRootPath(tree)).toBeUndefined();
    expect(activeRootPath({ ...framework, root: undefined })).toBeUndefined();
  });
});

describe("findNodeByPath", () => {
  const nodes: EditableNode[] = [
    {
      type: "folder",
      id: "ui",
      path: "ui",
      metaPath: "ui/meta.json",
      name: "UI",
      children: [
        {
          type: "folder",
          id: "ui/components",
          path: "ui/components",
          metaPath: "ui/components/meta.json",
          name: "Components",
          children: [],
        },
      ],
    },
  ];

  it("finds nested folders", () => {
    const found = findNodeByPath(nodes, "ui/components");
    expect(found?.type).toBe("folder");
  });

  it("returns undefined for unknown paths", () => {
    expect(findNodeByPath(nodes, "headless")).toBeUndefined();
  });
});
