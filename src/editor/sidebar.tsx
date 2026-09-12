"use client";

import {
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderTrigger,
  SidebarItem,
  SidebarSeparator,
} from "fumadocs-ui/components/sidebar/base";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import { useTreeContext } from "fumadocs-ui/contexts/tree";
import {
  File,
  FilePlus2,
  FolderPlus,
  GitBranch,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  createContext,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type EditableFolder,
  type EditableNode,
  isPageFile,
  metaPathFor,
  parentFolder,
} from "../content/model";
import { collectRelativeMedia, isMediaFile } from "../media/paths";
import type { MetaMutation } from "../meta/types";
import { useEditorWorkspace } from "../workspace/context";
import { useFumadocsEditor } from "./context";
import { activeRootPath, findNodeByPath } from "./editor-tree";
import { parseSource, serializeSource } from "./frontmatter";
import { GitPanel } from "./git-panel";
import { IconPicker, NodeIcon } from "./icon-picker";
import { MediaPanel } from "./media-panel";

type DropPosition = "before" | "after" | "inside";
interface DragState {
  id: string;
  label: string;
  mode: "pointer" | "keyboard";
}

interface SidebarQuery {
  query: string;
  setQuery: (value: string) => void;
}

const SidebarQueryContext = createContext<SidebarQuery | null>(null);

function useSidebarQuery(): SidebarQuery {
  const context = useContext(SidebarQueryContext);
  if (!context) {
    throw new Error(
      "The editor sidebar must be wrapped in its query provider.",
    );
  }
  return context;
}

export function EditorSidebarQueryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return (
    <SidebarQueryContext.Provider value={value}>
      {children}
    </SidebarQueryContext.Provider>
  );
}

/** The page tree is scoped to the active tab, so the editor follows it. */
function useSidebarScope(): { nodes: EditableNode[]; folder: string } {
  const workspace = useEditorWorkspace();
  const { root } = useTreeContext();

  return useMemo(() => {
    const all = workspace.tree?.root.children ?? [];
    const path = activeRootPath(root);
    if (!path) return { nodes: all, folder: "" };

    const folder = findNodeByPath(all, path);
    if (folder?.type !== "folder") return { nodes: all, folder: "" };
    return { nodes: folder.children, folder: folder.id };
  }, [workspace.tree, root]);
}

export function EditorSidebarHead() {
  const editor = useFumadocsEditor();
  const active = editor.sidePanel === "media" ? "media" : "pages";
  const scope = useSidebarScope();
  const { query, setQuery } = useSidebarQuery();

  return (
    <div className="fde-sidebar-head">
      <div
        className="fde-sidebar-tabs"
        role="tablist"
        aria-label="Editor sidebar"
      >
        <button
          type="button"
          role="tab"
          aria-selected={active === "pages"}
          data-active={active === "pages" || undefined}
          onClick={() => editor.setSidePanel("pages")}
        >
          <File size={13} /> Pages
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === "media"}
          data-active={active === "media" || undefined}
          onClick={() => editor.setSidePanel("media")}
        >
          <ImageIcon size={13} /> Assets
        </button>
      </div>
      {editor.sidePanel === "pages" ? (
        <div className="fde-sidebar-tools">
          <label className="fde-sidebar-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pages"
              aria-label="Search pages"
            />
          </label>
          <AddRow folder={scope.folder} compact />
        </div>
      ) : null}
    </div>
  );
}

export function EditorSidebarBody({ className }: { className?: string }) {
  const editor = useFumadocsEditor();
  const tab = editor.sidePanel;

  return (
    <div className={`fde-sidebar${className ? ` ${className}` : ""}`}>
      <div className="fde-sidebar-body">
        {tab === "git" ? (
          <ReviewPanel />
        ) : tab === "media" ? (
          <MediaPanel />
        ) : (
          <SidebarTree />
        )}
      </div>
    </div>
  );
}

export function EditorSidebarFooter() {
  const editor = useFumadocsEditor();
  const workspace = useEditorWorkspace();
  const tab = editor.sidePanel;
  const changeCount = workspace.changes.length;

  return (
    <div className="fde-sidebar-review">
      <span className="fde-review-branch">
        <GitBranch size={14} /> main
      </span>
      <span
        className="fde-review-count"
        data-visible={changeCount > 0}
        title={`${changeCount} change${changeCount === 1 ? "" : "s"}`}
      >
        <span aria-hidden="true" /> {changeCount}
      </span>
      <button
        type="button"
        className="fde-review-button"
        data-active={tab === "git"}
        onClick={() => editor.setSidePanel(tab === "git" ? "pages" : "git")}
      >
        {tab === "git" ? "Back" : "Review"}
      </button>
    </div>
  );
}

export function EditorSidebarPanel({ className }: { className?: string }) {
  return (
    <EditorSidebarQueryProvider>
      <EditorSidebarHead />
      <EditorSidebarBody className={className} />
      <EditorSidebarFooter />
    </EditorSidebarQueryProvider>
  );
}

function ReviewPanel() {
  return (
    <div className="fde-review-panel">
      <GitPanel />
    </div>
  );
}

function SidebarTree() {
  const workspace = useEditorWorkspace();
  const { query } = useSidebarQuery();
  const scope = useSidebarScope();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const nodes = useMemo(
    () => filterNodes(scope.nodes, query),
    [scope.nodes, query],
  );

  if (!workspace.ready)
    return (
      <div className="fde-sidebar-empty">
        <Loader2 size={14} className="fde-spin" /> Loading content…
      </div>
    );
  if (!workspace.tree)
    return (
      <div className="fde-sidebar-empty">
        {workspace.error ?? "Unable to load content."}
      </div>
    );

  return (
    <div className="fde-pages">
      <div className="fde-tree" role="tree" aria-label="Documentation pages">
        {nodes.length === 0 ? (
          <p className="fde-tree-no-results">No pages match “{query}”.</p>
        ) : (
          nodes.map((node, index) => (
            <TreeNode
              key={node.id}
              node={node}
              siblings={nodes}
              index={index}
              drag={drag}
              setDrag={setDrag}
              announce={setAnnouncement}
              forceOpen={query.length > 0}
            />
          ))
        )}
      </div>
      <span className="fde-sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

const STATUS_MARK: Record<string, string> = {
  new: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
};

function StatusMark({ status }: { status?: string }) {
  if (!status || !STATUS_MARK[status]) return null;
  return (
    <span
      className="fde-tree-status"
      data-status={status}
      title={`Git status: ${status}`}
    >
      {STATUS_MARK[status]}
    </span>
  );
}

function TreeNode({
  node,
  siblings,
  index,
  drag,
  setDrag,
  announce,
  forceOpen,
}: {
  node: EditableNode;
  siblings: EditableNode[];
  index: number;
  drag: DragState | null;
  setDrag: (state: DragState | null) => void;
  announce: (message: string) => void;
  forceOpen: boolean;
}) {
  const editor = useFumadocsEditor();
  const workspace = useEditorWorkspace();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(defaultName(node));
  const [drop, setDrop] = useState<DropPosition | null>(null);
  const [showProps, setShowProps] = useState(false);
  const status =
    node.type === "page"
      ? workspace.statuses[node.path]
      : node.type === "folder"
        ? ((node.index ? workspace.statuses[node.index.path] : undefined) ??
          workspace.statuses[node.metaPath ?? metaPathFor(node.path)])
        : undefined;
  const active = node.type === "page" && editor.document?.path === node.path;
  const icon = node.icon;

  /** Folder, separator and link icons live in meta.json; page icons in frontmatter. */
  async function setIcon(next: string | undefined) {
    try {
      if (node.type !== "page") {
        await workspace.mutate({ type: "setIcon", id: node.id, icon: next });
        return;
      }
      const source = await workspace.getFile(node.path);
      const parsed = parseSource(source);
      if (parsed.error) throw new Error(`Invalid frontmatter: ${parsed.error}`);
      const frontmatter = { ...parsed.frontmatter };
      if (next) frontmatter.icon = next;
      else delete frontmatter.icon;
      const updated = serializeSource(frontmatter, parsed.body);
      if (editor.document?.path === node.path) editor.update(updated);
      else workspace.saveFile(node.path, updated);
    } catch (caught) {
      window.alert(
        caught instanceof Error ? caught.message : "Unable to set the icon.",
      );
    }
  }

  async function run(mutation: MetaMutation) {
    try {
      if (
        (mutation.type === "moveNode" || mutation.type === "renameNode") &&
        isPageFile(mutation.id)
      ) {
        const content = await workspace.getFile(mutation.id);
        const references = collectRelativeMedia(content, mutation.id).filter(
          (reference) =>
            isMediaFile(reference.path, workspace.mediaConfig.types),
        );
        if (
          references.length > 0 &&
          window.confirm(
            `This page references ${references.length} image(s). Move them with the page?`,
          )
        ) {
          await workspace.moveNodeWithMedia(
            mutation.type === "renameNode"
              ? { id: mutation.id, name: mutation.name }
              : {
                  id: mutation.id,
                  targetFolder: mutation.targetFolder,
                  beforeId: mutation.beforeId,
                },
          );
          return;
        }
      }
      await workspace.mutate(mutation);
    } catch (caught) {
      window.alert(
        caught instanceof Error ? caught.message : "Operation failed.",
      );
    }
  }

  function moveTarget(position: DropPosition) {
    return {
      targetFolder:
        position === "inside" && node.type === "folder"
          ? node.id
          : parentOfNode(node),
      beforeId:
        position === "before"
          ? node.id
          : position === "after"
            ? (siblings[index + 1]?.id ?? null)
            : null,
    };
  }

  function onDragStart(event: DragEvent) {
    event.dataTransfer.setData("text/plain", node.id);
    event.dataTransfer.effectAllowed = "move";
    setDrag({ id: node.id, label: node.name ?? "item", mode: "pointer" });
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(rect.height, 1);
    setDrop(
      ratio < 0.3
        ? "before"
        : ratio > 0.7 || node.type !== "folder"
          ? "after"
          : "inside",
    );
  }

  async function onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const dragged = event.dataTransfer.getData("text/plain") || drag?.id;
    const position = drop;
    setDrop(null);
    setDrag(null);
    if (!dragged || dragged === node.id || !position) return;
    await run({ type: "moveNode", id: dragged, ...moveTarget(position) });
    announce(`Moved item ${position} ${node.name}.`);
  }

  async function onHandleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && drag?.mode === "keyboard") {
      event.preventDefault();
      setDrag(null);
      announce("Move cancelled.");
      return;
    }
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (drag?.mode !== "keyboard") {
      setDrag({ id: node.id, label: node.name ?? "item", mode: "keyboard" });
      announce(
        `Picked up ${node.name ?? "item"}. Tab to another item and press Space to place it before, or Shift Space to place it inside a folder.`,
      );
      return;
    }
    if (drag.id === node.id) {
      setDrag(null);
      announce("Move cancelled.");
      return;
    }
    const position: DropPosition =
      event.shiftKey && node.type === "folder" ? "inside" : "before";
    await run({ type: "moveNode", id: drag.id, ...moveTarget(position) });
    announce(`Moved ${drag.label} ${position} ${node.name}.`);
    setDrag(null);
  }

  const dndProps = {
    draggable: true,
    onDragStart,
    onDragEnd: () => {
      setDrop(null);
      setDrag(null);
    },
    onDragOver,
    onDragLeave: () => setDrop(null),
    onDrop: (event: DragEvent) => void onDrop(event),
    "data-drop": drop ?? undefined,
    "data-dragging": drag?.id === node.id || undefined,
  };

  if (node.type === "separator")
    return (
      <div className="fde-tree-node" {...dndProps}>
        <SidebarSeparator className="fde-tree-separator" role="treeitem">
          <NodeIcon name={node.icon} />
          {node.name || "Section"}
        </SidebarSeparator>
        <NodeControls
          node={node}
          icon={icon}
          onIcon={(next) => void setIcon(next)}
          onDelete={() => void run({ type: "deleteNode", id: node.id })}
          onHandleKeyDown={onHandleKeyDown}
        />
      </div>
    );

  if (node.type === "link")
    return (
      <div className="fde-tree-node" {...dndProps}>
        <SidebarItem
          className="fde-tree-item"
          href={node.url}
          external
          icon={node.icon ? <NodeIcon name={node.icon} /> : undefined}
        >
          {node.name}
        </SidebarItem>
        <NodeControls
          node={node}
          onDelete={() => void run({ type: "deleteNode", id: node.id })}
          onHandleKeyDown={onHandleKeyDown}
        />
      </div>
    );

  if (node.type === "folder") {
    // The index page doubles as the folder row, so it is not repeated below.
    const childNodes = node.children.filter(
      (child) =>
        !(
          node.index &&
          child.type === "page" &&
          child.path === node.index.path
        ),
    );

    return (
      <SidebarFolder
        className="fde-tree-branch"
        defaultOpen={forceOpen || node.defaultOpen !== false}
        collapsible={node.collapsible}
        active={Boolean(
          node.index && editor.document?.path === node.index.path,
        )}
      >
        <div
          className="fde-tree-node fde-tree-folder"
          {...dndProps}
          data-status={status}
        >
          {renaming ? (
            <RenameInput
              value={name}
              onChange={setName}
              onSubmit={async () => {
                setRenaming(false);
                await run({ type: "renameNode", id: node.id, name });
              }}
              onCancel={() => setRenaming(false)}
            />
          ) : node.index ? (
            <SidebarItem
              className="fde-tree-item"
              href={editor.editorHref(node.index.path)}
              active={editor.document?.path === node.index.path}
              icon={node.icon ? <NodeIcon name={node.icon} /> : undefined}
            >
              {node.name}
              <StatusMark status={status} />
            </SidebarItem>
          ) : (
            <SidebarFolderTrigger className="fde-tree-item fde-tree-folder-trigger">
              <NodeIcon name={node.icon} /> {node.name}
              <StatusMark status={status} />
            </SidebarFolderTrigger>
          )}
          <NodeControls
            node={node}
            folder={node}
            icon={icon}
            onIcon={(next) => void setIcon(next)}
            onRename={() => {
              setName(defaultName(node));
              setRenaming(true);
            }}
            onSettings={() => setShowProps((value) => !value)}
            onDelete={() => {
              if (window.confirm(`Delete "${node.name}" and its pages?`))
                void run({ type: "deleteNode", id: node.id });
            }}
            onHandleKeyDown={onHandleKeyDown}
          />
        </div>
        {showProps ? (
          <FolderPropsPanel folder={node} onClose={() => setShowProps(false)} />
        ) : null}
        <SidebarFolderContent className="fde-tree-children">
          {childNodes.map((child, childIndex) => (
            <TreeNode
              key={child.id}
              node={child}
              siblings={childNodes}
              index={childIndex}
              drag={drag}
              setDrag={setDrag}
              announce={announce}
              forceOpen={forceOpen}
            />
          ))}
        </SidebarFolderContent>
      </SidebarFolder>
    );
  }

  return (
    <div className="fde-tree-node" {...dndProps} data-status={status}>
      {renaming ? (
        <RenameInput
          value={name}
          onChange={setName}
          onSubmit={async () => {
            setRenaming(false);
            await run({ type: "renameNode", id: node.id, name });
          }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <SidebarItem
          className="fde-tree-item"
          href={editor.editorHref(node.path)}
          active={active}
          icon={node.icon ? <NodeIcon name={node.icon} /> : undefined}
          onDoubleClick={(event) => {
            event.preventDefault();
            setName(defaultName(node));
            setRenaming(true);
          }}
        >
          {node.name}
          <StatusMark status={status} />
        </SidebarItem>
      )}
      <NodeControls
        node={node}
        icon={icon}
        onIcon={(next) => void setIcon(next)}
        onRename={() => {
          setName(defaultName(node));
          setRenaming(true);
        }}
        onDelete={() => {
          if (window.confirm(`Delete "${node.name}"?`))
            void run({ type: "deleteNode", id: node.id });
        }}
        onHandleKeyDown={onHandleKeyDown}
      />
    </div>
  );
}

function NodeControls({
  node,
  folder,
  icon,
  onIcon,
  onRename,
  onSettings,
  onDelete,
  onHandleKeyDown,
}: {
  node: EditableNode;
  folder?: EditableFolder;
  icon?: string;
  onIcon?: (icon: string | undefined) => void;
  onRename?: () => void;
  onSettings?: () => void;
  onDelete: () => void;
  onHandleKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <span className="fde-tree-controls">
      <button
        type="button"
        className="fde-tree-grip"
        aria-label={`Move ${node.name}`}
        title="Drag to move. Press Space for keyboard move."
        onKeyDown={(event) => void onHandleKeyDown(event)}
      >
        <GripVertical size={13} />
      </button>
      <Popover>
        <PopoverTrigger
          className="fde-tree-menu-trigger"
          aria-label={`Actions for ${node.name}`}
        >
          <MoreHorizontal size={14} />
        </PopoverTrigger>
        <PopoverContent className="fde-tree-menu" align="end">
          {folder ? <AddRow folder={folder.id} menuItem /> : null}
          {onIcon ? (
            <IconPicker
              value={icon}
              onChange={onIcon}
              className="fde-menu-item"
              label={`Icon for ${node.name ?? "item"}`}
            >
              {icon ? " Change icon" : " Add icon"}
            </IconPicker>
          ) : null}
          {onRename ? (
            <PopoverClose className="fde-menu-item" onClick={onRename}>
              <Pencil size={13} /> Rename
            </PopoverClose>
          ) : null}
          {folder && onSettings ? (
            <PopoverClose className="fde-menu-item" onClick={onSettings}>
              <Settings2 size={13} /> Folder settings
            </PopoverClose>
          ) : null}
          <PopoverClose className="fde-menu-item fde-danger" onClick={onDelete}>
            <Trash2 size={13} /> Delete
          </PopoverClose>
        </PopoverContent>
      </Popover>
    </span>
  );
}

function AddRow({
  folder,
  menuItem = false,
  compact = false,
}: {
  folder: string;
  menuItem?: boolean;
  compact?: boolean;
}) {
  const workspace = useEditorWorkspace();
  const [kind, setKind] = useState<"page" | "folder" | "separator">("page");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | undefined>();
  const [format, setFormat] = useState<"mdx" | "md">("mdx");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await workspace.mutate(
        kind === "page"
          ? { type: "createPage", folder, name, title: name, icon, format }
          : kind === "folder"
            ? {
                type: "createFolder",
                parent: folder,
                name,
                title: name,
                icon,
                withIndex: true,
              }
            : { type: "addSeparator", folder, name, icon },
      );
      setName("");
      setIcon(undefined);
    } catch (caught) {
      window.alert(
        caught instanceof Error ? caught.message : "Unable to create.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover
      onOpenChange={(open) =>
        open && requestAnimationFrame(() => inputRef.current?.focus())
      }
    >
      <PopoverTrigger
        className={
          menuItem
            ? "fde-menu-item"
            : compact
              ? "fde-tree-add-icon"
              : "fde-tree-add-button"
        }
        title="Add page, folder, or separator"
      >
        <Plus size={compact ? 15 : 13} />
        {menuItem ? " Add inside" : compact ? null : " Add"}
      </PopoverTrigger>
      <PopoverContent className="fde-add-popover" align="start">
        <p className="fde-popover-title">
          Create in {folder ? "this folder" : "documentation"}
        </p>
        <div className="fde-tree-add-kinds" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={kind === "page"}
            data-active={kind === "page"}
            onClick={() => setKind("page")}
          >
            <FilePlus2 size={13} /> Page
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === "folder"}
            data-active={kind === "folder"}
            onClick={() => setKind("folder")}
          >
            <FolderPlus size={13} /> Folder
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === "separator"}
            data-active={kind === "separator"}
            onClick={() => setKind("separator")}
          >
            <Minus size={13} /> Separator
          </button>
        </div>
        <div className="fde-add-field">
          <span>{kind === "separator" ? "Label" : "Name"}</span>
          <div className="fde-add-name">
            <IconPicker
              value={icon}
              onChange={setIcon}
              className="fde-add-icon"
              label="Choose icon"
              align="start"
            />
            <input
              ref={inputRef}
              className="fde-input"
              value={name}
              placeholder={
                kind === "page"
                  ? "Getting started"
                  : kind === "folder"
                    ? "Guides"
                    : "Reference"
              }
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
            />
          </div>
        </div>
        {kind === "page" ? (
          <div className="fde-add-field">
            <span>Format</span>
            <div className="fde-tree-add-kinds">
              <button
                type="button"
                data-active={format === "mdx"}
                onClick={() => setFormat("mdx")}
              >
                .mdx
              </button>
              <button
                type="button"
                data-active={format === "md"}
                onClick={() => setFormat("md")}
              >
                .md
              </button>
            </div>
          </div>
        ) : null}
        <PopoverClose
          className="fde-button fde-button-primary"
          onClick={() => void submit()}
          disabled={busy || !name.trim()}
        >
          Create {kind}
        </PopoverClose>
      </PopoverContent>
    </Popover>
  );
}

function FolderPropsPanel({
  folder,
  onClose,
}: {
  folder: EditableFolder;
  onClose: () => void;
}) {
  const workspace = useEditorWorkspace();
  const [title, setTitle] = useState(folder.name);
  const [icon, setIcon] = useState(folder.icon ?? "");
  const [description, setDescription] = useState(folder.description ?? "");
  const [defaultOpen, setDefaultOpen] = useState(Boolean(folder.defaultOpen));
  const [collapsible, setCollapsible] = useState(folder.collapsible ?? true);
  const [root, setRoot] = useState(Boolean(folder.root));

  async function submit() {
    try {
      await workspace.mutate({
        type: "setMeta",
        metaPath: folder.metaPath ?? metaPathFor(folder.path),
        patch: {
          title: title.trim() || undefined,
          icon: icon.trim() || undefined,
          description: description.trim() || undefined,
          defaultOpen: defaultOpen || undefined,
          collapsible,
          root: root || undefined,
        },
      });
      onClose();
    } catch (caught) {
      window.alert(
        caught instanceof Error ? caught.message : "Unable to save.",
      );
    }
  }

  return (
    <div className="fde-tree-props">
      <div className="fde-panel-title">
        <strong>Folder settings</strong>
      </div>
      <label>
        Title
        <input
          className="fde-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <div className="fde-tree-props-icon">
        <span>Icon</span>
        <IconPicker
          value={icon}
          onChange={(next) => setIcon(next ?? "")}
          className="fde-button"
          label="Choose folder icon"
        />
      </div>
      <label>
        Description
        <input
          className="fde-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="fde-check">
        <input
          type="checkbox"
          checked={defaultOpen}
          onChange={(e) => setDefaultOpen(e.target.checked)}
        />{" "}
        Default open
      </label>
      <label className="fde-check">
        <input
          type="checkbox"
          checked={collapsible}
          onChange={(e) => setCollapsible(e.target.checked)}
        />{" "}
        Collapsible
      </label>
      <label className="fde-check">
        <input
          type="checkbox"
          checked={root}
          onChange={(e) => setRoot(e.target.checked)}
        />{" "}
        Root folder
      </label>
      <div className="fde-tree-add-actions">
        <button type="button" className="fde-button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="fde-button fde-button-primary"
          onClick={() => void submit()}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function RenameInput({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const inputRef = useAutoFocus<HTMLInputElement>();
  return (
    <input
      ref={inputRef}
      className="fde-input fde-tree-rename"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => void onSubmit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") void onSubmit();
        if (event.key === "Escape") onCancel();
      }}
    />
  );
}

function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => ref.current?.focus(), []);
  return ref;
}

function filterNodes(nodes: EditableNode[], query: string): EditableNode[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return nodes;
  const filtered: EditableNode[] = [];
  for (const node of nodes) {
    if (node.type !== "folder") {
      if ((node.name ?? "").toLowerCase().includes(normalized))
        filtered.push(node);
      continue;
    }
    const children = filterNodes(node.children, query);
    if (node.name.toLowerCase().includes(normalized) || children.length > 0) {
      filtered.push({ ...node, children });
    }
  }
  return filtered;
}

function defaultName(node: EditableNode): string {
  if (node.type === "page")
    return (
      node.path
        .split("/")
        .pop()
        ?.replace(/\.(mdx?|md)$/i, "") ?? ""
    );
  if (node.type === "folder") return node.path.split("/").pop() ?? "";
  return node.name ?? "";
}

function parentOfNode(node: EditableNode): string {
  if (node.type === "page" || node.type === "folder")
    return parentFolder(node.path);
  const metaPath = node.id.split(":").slice(1, -1).join(":");
  return parentFolder(metaPath);
}
