import { effectiveEntries, parsePageEntry } from "../meta/pages";
import type { MetaData } from "../meta/types";

export interface ContentModel {
  files: string[];
  metas: Record<string, MetaData>;
  titles?: Record<string, string>;
  icons?: Record<string, string>;
  media?: string[];
}

export interface EditablePage {
  type: "page";
  id: string;
  path: string;
  name: string;
  url: string;
  icon?: string;
  isIndex?: boolean;
}

export interface EditableFolder {
  type: "folder";
  id: string;
  path: string;
  metaPath: string | null;
  name: string;
  description?: string;
  icon?: string;
  root?: boolean | string;
  defaultOpen?: boolean;
  collapsible?: boolean;
  index?: EditablePage;
  children: EditableNode[];
}

export interface EditableSeparator {
  type: "separator";
  id: string;
  name?: string;
  icon?: string;
}

export interface EditableLink {
  type: "link";
  id: string;
  name: string;
  url: string;
  icon?: string;
  external?: boolean;
}

export type EditableNode =
  | EditablePage
  | EditableFolder
  | EditableSeparator
  | EditableLink;

export interface ContentTree {
  root: EditableFolder;
  folders: string[];
  files: string[];
}

export function parentFolder(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

export function baseName(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

export function stripExtension(name: string): string {
  return name.replace(/\.(mdx?|md)$/i, "");
}

export function joinPath(...parts: Array<string | undefined>): string {
  return parts.filter((part) => part !== undefined && part !== "").join("/");
}

export function isPageFile(path: string): boolean {
  return /\.(mdx?|md)$/i.test(path);
}

export type PageFormat = "md" | "mdx";

export function pageFormat(path: string): PageFormat {
  return /\.mdx$/i.test(path) ? "mdx" : "md";
}

export function metaPathFor(folder: string): string {
  return joinPath(folder, "meta.json");
}

export function pageUrl(file: string, baseUrl: string): string {
  const withoutExtension = file.replace(/\.(mdx?|md)$/i, "");
  // Parenthesized folders are route groups (Next.js convention): they organize
  // files without contributing a URL segment.
  const segments = withoutExtension
    .split("/")
    .filter((segment) => !/^\(.+\)$/.test(segment));
  if (segments[segments.length - 1] === "index") segments.pop();
  return segments.length > 0
    ? `${baseUrl}/${segments.join("/")}`
    : baseUrl || "/";
}

export function listFolders(model: ContentModel): string[] {
  const folders = new Set<string>([""]);

  function addAncestors(path: string) {
    let current = parentFolder(path);
    while (current) {
      folders.add(current);
      current = parentFolder(current);
    }
    if (current === "") folders.add("");
  }

  for (const file of model.files) addAncestors(file);
  for (const metaPath of Object.keys(model.metas)) addAncestors(metaPath);

  return [...folders].sort();
}

export function buildContentTree(
  model: ContentModel,
  baseUrl = "/docs",
): ContentTree {
  const folders = listFolders(model);
  const root = buildFolder("", folders, model, baseUrl);

  return {
    root,
    folders,
    files: [...model.files].sort(),
  };
}

function buildFolder(
  folderPath: string,
  folders: string[],
  model: ContentModel,
  baseUrl: string,
): EditableFolder {
  const metaPath = metaPathFor(folderPath);
  const meta = model.metas[metaPath];

  const childFolders = folders
    .filter(
      (candidate) => candidate !== "" && parentFolder(candidate) === folderPath,
    )
    .sort((a, b) => a.localeCompare(b));

  const pageFiles = model.files.filter(
    (file) => parentFolder(file) === folderPath && isPageFile(file),
  );

  const indexName = meta?.pagesIndex ?? "index";
  const indexFile = pageFiles.find(
    (file) => stripExtension(baseName(file)) === indexName,
  );
  const regularFiles = pageFiles.filter((file) => file !== indexFile);

  // Fumadocs order: pages before folders, each sorted by path.
  const children = [
    ...regularFiles.map((file) => stripExtension(baseName(file))),
    ...childFolders.map((folder) => baseName(folder)),
  ];

  const indexNode = indexFile
    ? makePage(indexFile, model, baseUrl, true)
    : undefined;

  const entries = effectiveEntries(meta?.pages, children, indexName);
  const nodes: EditableNode[] = [];
  let indexPushed = false;
  let separatorCount = 0;
  let linkCount = 0;

  function pushIndex() {
    if (indexNode && !indexPushed) {
      nodes.push(indexNode);
      indexPushed = true;
    }
  }

  for (const raw of entries) {
    const entry = parsePageEntry(raw);

    switch (entry.kind) {
      case "name": {
        if (entry.name === indexName && indexNode) {
          pushIndex();
          break;
        }

        const folderChild = childFolders.find(
          (folder) => baseName(folder) === entry.name,
        );
        if (folderChild) {
          nodes.push(buildFolder(folderChild, folders, model, baseUrl));
          break;
        }

        const file = regularFiles.find(
          (candidate) => stripExtension(baseName(candidate)) === entry.name,
        );
        if (file) nodes.push(makePage(file, model, baseUrl));
        break;
      }
      case "extract": {
        const folderChild = childFolders.find(
          (folder) => baseName(folder) === entry.name,
        );
        if (!folderChild) break;

        const extracted = buildFolder(folderChild, folders, model, baseUrl);
        if (extracted.index) nodes.push(extracted.index);
        nodes.push(...extracted.children);
        break;
      }
      case "separator":
        nodes.push({
          type: "separator",
          id: `separator:${metaPath}:${separatorCount}`,
          name: entry.name,
          icon: entry.icon,
        });
        separatorCount += 1;
        break;
      case "link":
        nodes.push({
          type: "link",
          id: `link:${metaPath}:${linkCount}`,
          name: entry.name,
          url: entry.url,
          icon: entry.icon,
          external: entry.external,
        });
        linkCount += 1;
        break;
      default:
        break;
    }
  }

  // Without explicit pages, Fumadocs sorts the index page first.
  if (!meta?.pages && indexNode) nodes.unshift(indexNode);

  return {
    type: "folder",
    id: folderPath,
    path: folderPath,
    metaPath: meta ? metaPath : null,
    name:
      meta?.title ??
      indexNode?.name ??
      (folderPath ? pathToName(baseName(folderPath)) : ""),
    description: meta?.description,
    icon: meta?.icon,
    root: meta?.root,
    defaultOpen: meta?.defaultOpen,
    collapsible: meta?.collapsible,
    index: indexNode,
    children: nodes,
  };
}

/** Fumadocs folder/file label: capitalize and turn separators into spaces. */
function pathToName(name: string): string {
  return [...name]
    .map((character, index) =>
      index === 0
        ? character.toLocaleUpperCase()
        : character === "-"
          ? " "
          : character,
    )
    .join("");
}

function makePage(
  file: string,
  model: ContentModel,
  baseUrl: string,
  isIndex = false,
): EditablePage {
  return {
    type: "page",
    id: file,
    path: file,
    name: model.titles?.[file] ?? pathToName(stripExtension(baseName(file))),
    url: pageUrl(file, baseUrl),
    icon: model.icons?.[file],
    isIndex: isIndex || undefined,
  };
}

export function serializeMeta(meta: MetaData): string {
  return `${JSON.stringify(meta, null, 2)}\n`;
}
