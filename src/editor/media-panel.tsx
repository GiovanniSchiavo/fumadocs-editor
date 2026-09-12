"use client";

import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Image as ImageIcon,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  type DragEvent,
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { parentFolder } from "../content/model";
import {
  mediaDisplayPath,
  publicMediaSrc,
  relativeMediaSrc,
  renderMediaTemplate,
} from "../media/paths";
import type { MediaBase } from "../media/types";
import type { MediaListItem } from "../workspace/context";
import { useEditorWorkspace } from "../workspace/context";
import { useFumadocsEditor } from "./context";

interface Section {
  base: MediaBase;
  title: string;
  note: string;
}

interface GalleryState {
  items: MediaListItem[];
  index: number;
}

export function MediaPanel() {
  const editor = useFumadocsEditor();
  const workspace = useEditorWorkspace();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [gallery, setGallery] = useState<GalleryState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadBase = useRef<MediaBase>("content");

  const { publicFolders, types, maxSize, insertTemplate } =
    workspace.mediaConfig;
  const pagePath = editor.document?.path ?? "index.mdx";
  const pageFolder = parentFolder(pagePath);
  const [publicFolder, setPublicFolder] = useState(publicFolders[0] ?? "");

  const sections = useMemo<Section[]>(
    () =>
      [
        {
          base: "content" as const,
          title: "Page assets",
          note: "Move and delete with the page",
        },
        publicFolders.length > 0 && {
          base: "public" as const,
          title: "Shared assets",
          note: "Reusable from any page",
        },
      ].filter((section): section is Section => Boolean(section)),
    [publicFolders],
  );

  /**
   * Page assets are colocated, so only the open page's folder belongs to that
   * section — except while searching, which looks across the whole library.
   */
  function itemsFor(base: MediaBase) {
    const normalized = query.trim().toLowerCase();
    return workspace.mediaItems.filter((item) => {
      if (item.base !== base) return false;
      if (normalized)
        return item.displayPath.toLowerCase().includes(normalized);
      return base === "public" || parentFolder(item.path) === pageFolder;
    });
  }

  async function upload(files: FileList | File[] | null, base: MediaBase) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of [...files]) {
        await workspace.uploadMedia(file, {
          base,
          pagePath,
          folder: publicFolder,
        });
      }
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function snippetFor(item: Pick<MediaListItem, "base" | "path">) {
    const name = item.path.split("/").pop() ?? item.path;
    const src =
      item.base === "public"
        ? publicMediaSrc(workspace.mediaConfig, item.path)
        : relativeMediaSrc(pagePath, item.path);
    return renderMediaTemplate(insertTemplate, {
      alt: name.replace(/\.[^.]+$/, ""),
      src,
      name,
    });
  }

  function insert(item: Pick<MediaListItem, "base" | "path">) {
    editor.insertAtCursor(snippetFor(item));
  }

  const hasAssets = workspace.mediaItems.length > 0;

  return (
    <section className="fde-media" aria-label="Asset library">
      <div className="fde-media-intro">
        <div>
          <strong>Asset library</strong>
        </div>
      </div>
      {hasAssets ? (
        <label className="fde-sidebar-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search assets"
            aria-label="Search assets"
          />
        </label>
      ) : null}

      {sections.map((section) => (
        <MediaSection
          key={section.base}
          section={section}
          scope={
            section.base === "public"
              ? { value: publicFolder, options: publicFolders }
              : { value: pageFolder, options: [pageFolder] }
          }
          onScope={setPublicFolder}
          items={itemsFor(section.base)}
          busy={busy}
          types={types}
          maxSize={maxSize}
          query={query}
          snippetFor={snippetFor}
          onOpen={(items, index) => setGallery({ items, index })}
          onFiles={(files) => void upload(files, section.base)}
          onChoose={() => {
            uploadBase.current = section.base;
            inputRef.current?.click();
          }}
        />
      ))}

      <input
        ref={inputRef}
        type="file"
        accept={types.join(",")}
        multiple
        hidden
        onChange={(event) =>
          void upload(event.target.files, uploadBase.current)
        }
      />

      {gallery
        ? createPortal(
            <MediaGallery
              items={gallery.items}
              index={gallery.index}
              onClose={() => setGallery(null)}
              onInsert={insert}
            />,
            document.body,
          )
        : null}
    </section>
  );
}

/** One destination: its assets, and a drop target that uploads into it. */
function MediaSection({
  section,
  scope,
  onScope,
  items,
  busy,
  types,
  maxSize,
  query,
  snippetFor,
  onOpen,
  onFiles,
  onChoose,
}: {
  section: Section;
  scope: { value: string; options: string[] };
  onScope: (folder: string) => void;
  items: MediaListItem[];
  busy: boolean;
  types: string[];
  maxSize: number;
  query: string;
  snippetFor: (item: MediaListItem) => string;
  onOpen: (items: MediaListItem[], index: number) => void;
  onFiles: (files: FileList | File[]) => void;
  onChoose: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const folderListId = useId();

  // Public assets live throughout the public directory, so list them under
  // the folder they actually belong to instead of one flat section.
  const groups = useMemo(() => {
    if (section.base !== "public") {
      return [{ folder: null as string | null, items }];
    }

    const byFolder = new Map<string, MediaListItem[]>();
    for (const item of items) {
      const folder = parentFolder(item.path);
      const list = byFolder.get(folder);
      if (list) list.push(item);
      else byFolder.set(folder, [item]);
    }

    return [...byFolder.entries()]
      .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)))
      .map(([folder, groupItems]) => ({
        folder: folder as string | null,
        items: groupItems,
      }));
  }, [section.base, items]);

  // Flatten in display order so the gallery walks rows as they are listed.
  const ordered = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups],
  );

  return (
    <section
      className="fde-media-section"
      aria-label={section.title}
      data-dragging={dragging}
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!hasFiles(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        onFiles(event.dataTransfer.files);
      }}
    >
      <p className="fde-media-section-title">
        {section.title}
        {section.base === "content" ? (
          <span className="fde-media-scope" title={section.note}>
            {folderLabel(scope.value)}
          </span>
        ) : null}
      </p>

      {items.length > 0 ? (
        groups.map((group) => (
          <Fragment key={group.folder ?? "__page"}>
            {group.folder !== null ? (
              <p className="fde-media-folder">{folderLabel(group.folder)}</p>
            ) : null}
            <div
              className="fde-media-list"
              role="listbox"
              aria-label={section.title}
            >
              {group.items.map((item) => {
                const key = `${item.base}:${item.path}`;
                const name = item.path.split("/").pop() ?? item.path;
                return (
                  <AssetRow
                    key={key}
                    item={item}
                    name={name}
                    snippet={snippetFor(item)}
                    // The gallery walks the whole section, not its folder.
                    onOpen={() => onOpen(ordered, ordered.indexOf(item))}
                  />
                );
              })}
            </div>
          </Fragment>
        ))
      ) : query ? (
        <p className="fde-media-empty">No matches here.</p>
      ) : null}

      <div className="fde-media-upload">
        {section.base === "public" ? (
          <label className="fde-media-upload-target">
            <span>Upload to</span>
            <input
              className="fde-input fde-media-upload-path"
              list={folderListId}
              value={scope.value}
              placeholder="folder inside public"
              aria-label={`Upload destination for ${section.title}`}
              onChange={(event) => onScope(event.target.value)}
            />
            <datalist id={folderListId}>
              {scope.options.map((folder) => (
                <option key={folder} value={folder} />
              ))}
            </datalist>
          </label>
        ) : null}
        <button
          type="button"
          className="fde-media-dropzone"
          data-dragging={dragging}
          onClick={onChoose}
          disabled={busy}
        >
          <Upload size={16} />
          <strong>
            {busy
              ? "Uploading…"
              : section.base === "public"
                ? `Drop or choose into ${folderLabel(scope.value)}`
                : `Drop or choose · ${section.note}`}
          </strong>
          <span>
            {types.join(", ").replaceAll(".", "").toUpperCase()} · up to{" "}
            {Math.round(maxSize / 1024 / 1024)}MB
          </span>
        </button>
      </div>
    </section>
  );
}

function AssetRow({
  item,
  name,
  snippet,
  onOpen,
}: {
  item: MediaListItem;
  name: string;
  snippet: string;
  onOpen: () => void;
}) {
  return (
    <div
      className="fde-media-row"
      role="option"
      tabIndex={0}
      data-status={item.status}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", snippet);
        event.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <MediaThumb base={item.base} path={item.path} />
      <span className="fde-media-meta">
        <strong title={item.displayPath}>{name}</strong>
        <span>{folderLabel(parentFolder(item.path))}</span>
      </span>
    </div>
  );
}

/** Large preview with navigation and the row actions as buttons. */
function MediaGallery({
  items: initialItems,
  index: initialIndex,
  onClose,
  onInsert,
}: {
  items: MediaListItem[];
  index: number;
  onClose: () => void;
  onInsert: (item: MediaListItem) => void;
}) {
  const workspace = useEditorWorkspace();
  const [items, setItems] = useState(initialItems);
  const [index, setIndex] = useState(initialIndex);
  const [url, setUrl] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  const item = items[index];
  const name = item ? (item.path.split("/").pop() ?? item.path) : "";

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setUrl(null);
    workspace
      .readMediaUrl(item.base, item.path)
      .then((value) => {
        if (!cancelled) setUrl(value || null);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workspace, item]);

  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  function step(delta: number) {
    if (items.length < 2) return;
    setIndex((current) => (current + delta + items.length) % items.length);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (renaming) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      const delta = event.key === "ArrowLeft" ? -1 : 1;
      setIndex((current) => {
        if (items.length < 2) return current;
        return (current + delta + items.length) % items.length;
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [renaming, onClose, items.length]);

  if (!item) return null;

  function submitRename() {
    if (!item) return;
    const to = workspace.renameMedia(item.base, item.path, renameValue);
    setRenaming(false);
    if (!to) return;

    setItems((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              path: to,
              displayPath: mediaDisplayPath(
                entry.base,
                to,
                workspace.mediaConfig.publicDir,
              ),
            }
          : entry,
      ),
    );
  }

  function remove() {
    if (!item) return;
    if (!window.confirm(`Delete ${name}?`)) return;
    workspace.deleteMedia(item.base, item.path);
    onClose();
  }

  return (
    <div className="fde-gallery-backdrop">
      <div
        className="fde-gallery"
        role="dialog"
        aria-modal="true"
        aria-label={`Asset ${name}`}
      >
        <header className="fde-gallery-head">
          <div className="fde-gallery-title">
            {renaming ? (
              <input
                ref={renameRef}
                className="fde-input"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={submitRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitRename();
                  if (event.key === "Escape") setRenaming(false);
                }}
              />
            ) : (
              <>
                <strong title={item.displayPath}>{name}</strong>
                <span>{folderLabel(parentFolder(item.path))}</span>
              </>
            )}
          </div>
          {items.length > 1 ? (
            <span className="fde-gallery-count">
              {index + 1} / {items.length}
            </span>
          ) : null}
          <button
            type="button"
            className="fde-icon-button"
            onClick={onClose}
            aria-label="Close gallery"
          >
            <X size={15} />
          </button>
        </header>

        <div className="fde-gallery-stage">
          <button
            type="button"
            className="fde-gallery-nav"
            disabled={items.length < 2}
            onClick={() => step(-1)}
            aria-label="Previous asset"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="fde-gallery-image">
            {url ? (
              // biome-ignore lint/performance/noImgElement: library thumbnails can be local data URLs and this package cannot depend on Next Image.
              <img src={url} alt={name} />
            ) : (
              <span className="fde-spinner" />
            )}
          </div>
          <button
            type="button"
            className="fde-gallery-nav"
            disabled={items.length < 2}
            onClick={() => step(1)}
            aria-label="Next asset"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="fde-gallery-actions">
          <button
            type="button"
            className="fde-button fde-button-primary"
            onClick={() => onInsert(item)}
          >
            <ImageIcon size={13} /> Insert
          </button>
          <button
            type="button"
            className="fde-button"
            onClick={() => void navigator.clipboard.writeText(item.displayPath)}
          >
            <Copy size={13} /> Copy path
          </button>
          <button
            type="button"
            className="fde-button"
            onClick={() => {
              setRenameValue(name);
              setRenaming(true);
            }}
          >
            <Pencil size={13} /> Rename
          </button>
          <button
            type="button"
            className="fde-button fde-gallery-delete"
            onClick={remove}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function MediaThumb({ base, path }: { base: MediaBase; path: string }) {
  const workspace = useEditorWorkspace();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    workspace
      .readMediaUrl(base, path)
      .then((value) => {
        if (!cancelled) setUrl(value || null);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workspace, base, path]);
  if (!url)
    return (
      <span className="fde-media-placeholder">
        <ImageIcon size={15} />
      </span>
    );
  // biome-ignore lint/performance/noImgElement: library thumbnails can be local data URLs and this package cannot depend on Next Image.
  return <img className="fde-media-thumb" src={url} alt="" loading="lazy" />;
}

function folderLabel(folder: string): string {
  return folder ? `/${folder.replace(/\/+$/, "")}` : "/";
}

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer.types.includes("Files");
}
