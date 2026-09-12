import {
  baseName,
  buildContentTree,
  type ContentModel,
  isPageFile,
  joinPath,
  metaPathFor,
  parentFolder,
  serializeMeta,
  stripExtension,
} from "../content/model";
import {
  effectiveEntries,
  insertEntry,
  parsePageEntry,
  withEntryIcon,
} from "./pages";
import type { MetaData } from "./types";
import {
  type MetaMutation,
  MetaOperationError,
  type WorkspaceChange,
} from "./types";

export interface MutationResult {
  model: ContentModel;
  changes: WorkspaceChange[];
  focusId?: string;
}

interface Context {
  model: ContentModel;
  changes: WorkspaceChange[];
  created: Set<string>;
}

export function applyMutation(
  model: ContentModel,
  mutation: MetaMutation,
): MutationResult {
  const ctx: Context = {
    model: {
      files: [...model.files],
      metas: { ...model.metas },
      titles: model.titles ? { ...model.titles } : undefined,
      icons: model.icons ? { ...model.icons } : undefined,
    },
    changes: [],
    created: new Set(),
  };

  let focusId: string | undefined;

  switch (mutation.type) {
    case "createPage":
      focusId = createPage(ctx, mutation);
      break;
    case "createFolder":
      focusId = createFolder(ctx, mutation);
      break;
    case "deleteNode":
      deleteNode(ctx, mutation.id);
      break;
    case "renameNode":
      focusId = renameNode(ctx, mutation.id, mutation.name);
      break;
    case "moveNode":
      focusId = moveNode(
        ctx,
        mutation.id,
        mutation.targetFolder,
        mutation.beforeId,
      );
      break;
    case "setMeta":
      setMeta(ctx, mutation.metaPath, mutation.patch);
      break;
    case "setIcon":
      setIcon(ctx, mutation.id, mutation.icon);
      break;
    case "setOrder":
      setOrder(ctx, mutation.metaPath, mutation.pages);
      break;
    case "addSeparator":
      focusId = addSeparator(ctx, mutation);
      break;
    case "addLink":
      focusId = addLink(ctx, mutation);
      break;
  }

  return { model: ctx.model, changes: ctx.changes, focusId };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function pageTemplate(title: string, body?: string, icon?: string): string {
  const fields = icon ? `title: ${title}\nicon: ${icon}` : `title: ${title}`;
  return `---\n${fields}\n---\n\n${body ?? ""}`;
}

function ensureMeta(ctx: Context, folder: string): MetaData {
  const metaPath = metaPathFor(folder);
  const existing = ctx.model.metas[metaPath];
  if (existing) return existing;

  const data: MetaData = {};
  ctx.model.metas[metaPath] = data;
  ctx.created.add(metaPath);
  return data;
}

function emitMeta(ctx: Context, folder: string): void {
  const metaPath = metaPathFor(folder);
  const data = ctx.model.metas[metaPath];
  if (!data) return;

  const content = serializeMeta(data);
  ctx.changes.push(
    ctx.created.has(metaPath)
      ? { type: "create", path: metaPath, content }
      : { type: "update", path: metaPath, content },
  );
}

function folderChildren(
  model: ContentModel,
  folder: string,
): { folders: string[]; pages: string[] } {
  const folders = buildContentTree(model).folders.filter(
    (candidate) => candidate !== "" && parentFolder(candidate) === folder,
  );
  const pages = model.files.filter(
    (file) => parentFolder(file) === folder && isPageFile(file),
  );
  return { folders, pages };
}

function childNames(model: ContentModel, folder: string): string[] {
  const { folders, pages } = folderChildren(model, folder);
  const indexName = model.metas[metaPathFor(folder)]?.pagesIndex ?? "index";
  // Fumadocs order: pages before folders, each sorted by path.
  return [
    ...pages
      .filter((file) => stripExtension(baseName(file)) !== indexName)
      .map((file) => stripExtension(baseName(file))),
    ...folders.map((candidate) => baseName(candidate)),
  ];
}

function materializedPages(ctx: Context, folder: string): string[] {
  const meta = ctx.model.metas[metaPathFor(folder)];
  const indexName = meta?.pagesIndex ?? "index";
  return effectiveEntries(
    meta?.pages,
    childNames(ctx.model, folder),
    indexName,
  );
}

function setPages(ctx: Context, folder: string, pages: string[]): void {
  const meta = ensureMeta(ctx, folder);
  meta.pages = pages;
  emitMeta(ctx, folder);
}

function removeNameFromFolder(
  ctx: Context,
  folder: string,
  name: string,
): void {
  const meta = ctx.model.metas[metaPathFor(folder)];
  if (!meta) return;
  const pages = materializedPages(ctx, folder).filter((raw) => {
    const entry = parsePageEntry(raw);
    return entry.kind !== "name" || entry.name !== name;
  });
  setPages(ctx, folder, pages);
}

function renameEntryInFolder(
  ctx: Context,
  folder: string,
  previous: string,
  next: string,
): void {
  const meta = ctx.model.metas[metaPathFor(folder)];
  if (!meta) return;
  const raw = meta.pages;
  const pages = raw
    ? raw.map((entry) => {
        const parsed = parsePageEntry(entry);
        return parsed.kind === "name" && parsed.name === previous
          ? next
          : entry;
      })
    : materializedPages(ctx, folder);
  setPages(ctx, folder, pages);
}

function rawEntryById(ctx: Context, id: string): string | null {
  if (id.startsWith("separator:") || id.startsWith("link:")) {
    const [kind, metaPath, ordinalRaw] = splitSyntheticId(id);
    const ordinal = Number(ordinalRaw);
    const pages = ctx.model.metas[metaPath]?.pages;
    if (!pages) return null;

    let count = 0;
    for (const raw of pages) {
      const entry = parsePageEntry(raw);
      if (kind === "separator" && entry.kind === "separator") {
        if (count === ordinal) return raw;
        count += 1;
      }
      if (kind === "link" && entry.kind === "link") {
        if (count === ordinal) return raw;
        count += 1;
      }
    }
    return null;
  }

  if (isPageFile(id)) return stripExtension(baseName(id));
  return baseName(id);
}

function splitSyntheticId(id: string): [string, string, string] {
  const first = id.indexOf(":");
  const last = id.lastIndexOf(":");
  return [id.slice(0, first), id.slice(first + 1, last), id.slice(last + 1)];
}

function insertIntoFolder(
  ctx: Context,
  folder: string,
  rawEntry: string,
  beforeId?: string | null,
): void {
  const pages = materializedPages(ctx, folder);
  const before = beforeId ? rawEntryById(ctx, beforeId) : null;
  const entry = parsePageEntry(rawEntry);
  const filtered = pages.filter((raw) => {
    const parsed = parsePageEntry(raw);
    if (parsed.kind === "exclude" && entry.kind === "name") {
      return parsed.name !== entry.name;
    }
    return raw !== rawEntry;
  });
  setPages(ctx, folder, insertEntry(filtered, rawEntry, before));
}

function moveFile(ctx: Context, from: string, to: string): void {
  if (from === to) return;

  ctx.changes.push({ type: "move", from, to });
  ctx.model.files = ctx.model.files.map((file) => (file === from ? to : file));

  if (ctx.model.titles?.[from] !== undefined) {
    ctx.model.titles[to] = ctx.model.titles[from];
    delete ctx.model.titles[from];
  }
}

function movePath(ctx: Context, from: string, to: string): void {
  if (from === to) return;

  for (const file of [...ctx.model.files]) {
    if (file === from || file.startsWith(`${from}/`)) {
      moveFile(ctx, file, `${to}${file.slice(from.length)}`);
    }
  }

  for (const metaPath of Object.keys(ctx.model.metas)) {
    if (metaPath === metaPathFor(from) || metaPath.startsWith(`${from}/`)) {
      const target = `${to}${metaPath.slice(from.length)}`;
      ctx.changes.push({ type: "move", from: metaPath, to: target });
      ctx.model.metas[target] = ctx.model.metas[metaPath] as MetaData;
      delete ctx.model.metas[metaPath];
      if (ctx.created.has(metaPath)) {
        ctx.created.delete(metaPath);
        ctx.created.add(target);
      }
    }
  }
}

function createPage(
  ctx: Context,
  mutation: Extract<MetaMutation, { type: "createPage" }>,
): string {
  const slug = slugify(mutation.name);
  if (!slug) throw new MetaOperationError("A page name is required.");

  const extension = mutation.format === "md" ? ".md" : ".mdx";
  const path = joinPath(mutation.folder, `${slug}${extension}`);
  if (ctx.model.files.includes(path)) {
    throw new MetaOperationError(`${path} already exists.`);
  }

  const title = mutation.title?.trim() || mutation.name.trim() || slug;
  const content =
    mutation.content ?? pageTemplate(title, undefined, mutation.icon);

  ctx.changes.push({ type: "create", path, content });
  ctx.model.files.push(path);
  if (ctx.model.titles) ctx.model.titles[path] = title;
  if (mutation.icon && ctx.model.icons) ctx.model.icons[path] = mutation.icon;

  insertIntoFolder(ctx, mutation.folder, slug);
  return path;
}

function createFolder(
  ctx: Context,
  mutation: Extract<MetaMutation, { type: "createFolder" }>,
): string {
  const slug = slugify(mutation.name);
  if (!slug) throw new MetaOperationError("A folder name is required.");

  const folder = joinPath(mutation.parent, slug);
  if (ctx.model.files.some((file) => file.startsWith(`${folder}/`))) {
    throw new MetaOperationError(`${folder} already exists.`);
  }

  const meta = ensureMeta(ctx, folder);
  if (mutation.title?.trim()) meta.title = mutation.title.trim();
  if (mutation.icon) meta.icon = mutation.icon;

  if (mutation.withIndex) {
    const index = joinPath(folder, "index.mdx");
    const title = mutation.title?.trim() || mutation.name.trim() || slug;
    ctx.changes.push({
      type: "create",
      path: index,
      content: pageTemplate(title),
    });
    ctx.model.files.push(index);
    if (ctx.model.titles) ctx.model.titles[index] = title;
  }

  emitMeta(ctx, folder);
  insertIntoFolder(ctx, mutation.parent, slug);
  return folder;
}

function deleteNode(ctx: Context, id: string): void {
  if (id.startsWith("separator:") || id.startsWith("link:")) {
    const [kind, metaPath] = splitSyntheticId(id);
    const folder = parentFolder(metaPath);
    const raw = rawEntryById(ctx, id);
    if (!raw) return;

    const pages = materializedPages(ctx, folder).filter(
      (entry) => entry !== raw,
    );
    setPages(ctx, folder, pages);
    if (kind === "link") return;
    return;
  }

  if (isPageFile(id)) {
    ctx.changes.push({ type: "delete", path: id });
    ctx.model.files = ctx.model.files.filter((file) => file !== id);
    if (ctx.model.titles) delete ctx.model.titles[id];
    removeNameFromFolder(ctx, parentFolder(id), stripExtension(baseName(id)));
    return;
  }

  if (id === "")
    throw new MetaOperationError("Cannot delete the content root.");

  for (const file of [...ctx.model.files]) {
    if (file.startsWith(`${id}/`)) {
      ctx.changes.push({ type: "delete", path: file });
      ctx.model.files = ctx.model.files.filter(
        (candidate) => candidate !== file,
      );
      if (ctx.model.titles) delete ctx.model.titles[file];
    }
  }

  for (const metaPath of Object.keys(ctx.model.metas)) {
    if (metaPath === metaPathFor(id) || metaPath.startsWith(`${id}/`)) {
      ctx.changes.push({ type: "delete", path: metaPath });
      delete ctx.model.metas[metaPath];
      ctx.created.delete(metaPath);
    }
  }

  removeNameFromFolder(ctx, parentFolder(id), baseName(id));
}

function renameNode(ctx: Context, id: string, name: string): string {
  const slug = slugify(name);
  if (!slug) throw new MetaOperationError("A name is required.");

  if (isPageFile(id)) {
    const folder = parentFolder(id);
    const extension =
      id.endsWith(".md") && !id.endsWith(".mdx") ? ".md" : ".mdx";
    const target = joinPath(folder, `${slug}${extension}`);
    if (target !== id && ctx.model.files.includes(target)) {
      throw new MetaOperationError(`${target} already exists.`);
    }

    const previous = stripExtension(baseName(id));
    moveFile(ctx, id, target);
    renameEntryInFolder(ctx, folder, previous, slug);

    return target;
  }

  const parent = parentFolder(id);
  const target = joinPath(parent, slug);
  if (target === id) return id;
  if (target.startsWith(`${id}/`)) {
    throw new MetaOperationError("Cannot move a folder into itself.");
  }
  if (
    ctx.model.files.some(
      (file) => parentFolder(file) === target || file.startsWith(`${target}/`),
    )
  ) {
    throw new MetaOperationError(`${target} already exists.`);
  }

  const previous = baseName(id);
  movePath(ctx, id, target);
  renameEntryInFolder(ctx, parent, previous, slug);

  return target;
}

function moveNode(
  ctx: Context,
  id: string,
  targetFolder: string,
  beforeId?: string | null,
): string {
  if (id.startsWith("separator:") || id.startsWith("link:")) {
    const raw = rawEntryById(ctx, id);
    if (!raw) throw new MetaOperationError("Entry not found.");
    const [, metaPath] = splitSyntheticId(id);
    const source = parentFolder(metaPath);
    if (source !== targetFolder) {
      const sourcePages = materializedPages(ctx, source).filter(
        (entry) => entry !== raw,
      );
      setPages(ctx, source, sourcePages);
    }
    insertIntoFolder(ctx, targetFolder, raw, beforeId);
    return id;
  }

  if (isPageFile(id)) {
    const source = parentFolder(id);
    const target = joinPath(targetFolder, baseName(id));
    const name = stripExtension(baseName(id));

    if (source === targetFolder) {
      const pages = materializedPages(ctx, source).filter((raw) => {
        const entry = parsePageEntry(raw);
        return entry.kind !== "name" || entry.name !== name;
      });
      const before = beforeId ? rawEntryById(ctx, beforeId) : null;
      setPages(ctx, source, insertEntry(pages, name, before));
      return id;
    }

    if (ctx.model.files.includes(target)) {
      throw new MetaOperationError(`${target} already exists.`);
    }

    moveFile(ctx, id, target);
    removeNameFromFolder(ctx, source, name);
    insertIntoFolder(ctx, targetFolder, name, beforeId);
    return target;
  }

  const target = joinPath(targetFolder, baseName(id));
  if (id === target) return id;
  if (targetFolder === id || targetFolder.startsWith(`${id}/`)) {
    throw new MetaOperationError("Cannot move a folder into itself.");
  }

  const source = parentFolder(id);
  if (ctx.model.files.some((file) => parentFolder(file) === target)) {
    throw new MetaOperationError(`${target} already exists.`);
  }

  movePath(ctx, id, target);
  removeNameFromFolder(ctx, source, baseName(id));
  insertIntoFolder(ctx, targetFolder, baseName(id), beforeId);
  return target;
}

function setMeta(
  ctx: Context,
  metaPath: string,
  patch: Record<string, unknown>,
): void {
  const folder = parentFolder(metaPath);
  const meta = ensureMeta(ctx, folder);

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) {
      delete meta[key];
    } else {
      meta[key] = value;
    }
  }

  emitMeta(ctx, folder);
}

function setIcon(ctx: Context, id: string, icon?: string): void {
  if (id.startsWith("separator:") || id.startsWith("link:")) {
    const raw = rawEntryById(ctx, id);
    const next = raw ? withEntryIcon(raw, icon) : null;
    if (!raw || !next) throw new MetaOperationError("Entry not found.");
    const folder = parentFolder(splitSyntheticId(id)[1]);
    setPages(
      ctx,
      folder,
      materializedPages(ctx, folder).map((entry) =>
        entry === raw ? next : entry,
      ),
    );
    return;
  }

  if (isPageFile(id)) {
    throw new MetaOperationError("Page icons are stored in frontmatter.");
  }

  setMeta(ctx, metaPathFor(id), { icon });
}

function setOrder(ctx: Context, metaPath: string, pages: string[]): void {
  const folder = parentFolder(metaPath);
  setPages(ctx, folder, pages);
}

function addSeparator(
  ctx: Context,
  mutation: Extract<MetaMutation, { type: "addSeparator" }>,
): string {
  const raw = `---${mutation.icon ? `[${mutation.icon}]` : ""}${mutation.name}---`;
  const metaPath = metaPathFor(mutation.folder);
  const childCount = childNames(ctx.model, mutation.folder).length;
  insertIntoFolder(ctx, mutation.folder, raw, mutation.beforeId ?? null);
  void childCount;
  return `separator:${metaPath}:0`;
}

function addLink(
  ctx: Context,
  mutation: Extract<MetaMutation, { type: "addLink" }>,
): string {
  const raw = `${mutation.external ? "external:" : ""}[${mutation.name}](${mutation.url})`;
  const metaPath = metaPathFor(mutation.folder);
  insertIntoFolder(ctx, mutation.folder, raw, mutation.beforeId ?? null);
  return `link:${metaPath}:0`;
}
