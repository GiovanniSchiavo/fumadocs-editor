import type * as PageTree from "fumadocs-core/page-tree";
import type { LayoutTab } from "fumadocs-ui/layouts/shared";
import type { EditableNode } from "../content/model";

export type EditorHref = (path: string) => string;

function itemPath(item: PageTree.Item): string | undefined {
  return item.$ref ?? item.$id;
}

function remapItem(item: PageTree.Item, editorHref: EditorHref): PageTree.Item {
  const path = itemPath(item);
  if (item.external || !path) return item;
  return { ...item, url: editorHref(path) };
}

function remapNode(node: PageTree.Node, editorHref: EditorHref): PageTree.Node {
  if (node.type === "folder") {
    return {
      ...node,
      index: node.index ? remapItem(node.index, editorHref) : node.index,
      children: node.children.map((child) => remapNode(child, editorHref)),
    };
  }
  if (node.type === "separator") return node;
  return remapItem(node, editorHref);
}

/**
 * Point every page in the tree at the editor route, so Fumadocs can resolve
 * the current path (and therefore the active tab) while editing.
 */
export function mapTreeToEditorUrls(
  tree: PageTree.Root,
  editorHref: EditorHref,
): PageTree.Root {
  return {
    ...tree,
    children: tree.children.map((child) => remapNode(child, editorHref)),
    fallback: tree.fallback
      ? {
          ...tree.fallback,
          children: tree.fallback.children.map((child) =>
            remapNode(child, editorHref),
          ),
        }
      : tree.fallback,
  };
}

export function mapTabsToEditorUrls(
  tabs: LayoutTab[],
  editorHref: EditorHref,
): LayoutTab[] {
  return tabs.map((tab) => {
    const folder = tab.$folder;
    if (!folder) return tab;

    const index = folder.index ? itemPath(folder.index) : undefined;
    const firstPage = folder.children.find((child) => child.type === "page");
    const path = index ?? (firstPage ? itemPath(firstPage) : undefined);
    return path ? { ...tab, url: editorHref(path) } : tab;
  });
}

/** Content folder of the root folder the current page belongs to. */
export function activeRootPath(
  root: PageTree.Root | PageTree.Folder,
): string | undefined {
  if (root.type !== "folder" || !root.root) return undefined;

  const folder = root.$ref?.folder;
  if (folder) return folder;

  const index = root.index ? itemPath(root.index) : undefined;
  if (!index) return undefined;

  const slash = index.lastIndexOf("/");
  return slash === -1 ? "" : index.slice(0, slash);
}

export function findNodeByPath(
  nodes: EditableNode[],
  path: string,
): EditableNode | undefined {
  for (const node of nodes) {
    if (node.type !== "folder") continue;
    if (node.path === path) return node;

    const found = findNodeByPath(node.children, path);
    if (found) return found;
  }
  return undefined;
}
