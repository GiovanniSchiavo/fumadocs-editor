"use client";

import { get as idbGet, set as idbSet } from "idb-keyval";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  baseName,
  buildContentTree,
  type ContentModel,
  type ContentTree,
  parentFolder,
} from "../content/model";
import { base64ToDataUrl, fileToBase64 } from "../media/base64";
import {
  contentMediaPath,
  isMediaFile,
  mediaDisplayPath,
  mimeForMedia,
  publicMediaPath,
  publicMediaSrc,
  relativeMediaSrc,
  rewriteRelativeMedia,
  sanitizeMediaName,
  uniqueMediaName,
} from "../media/paths";
import {
  type MediaBase,
  type MediaConfig,
  type MediaFileInput,
  type MediaUploadResult,
  type ResolvedMediaConfig,
  resolveMediaConfig,
} from "../media/types";
import { applyMutation, slugify } from "../meta/operations";
import type { MetaMutation, WorkspaceChange } from "../meta/types";
import {
  applyChanges,
  collapseChanges,
  retargetChanges,
  statusesFromChanges,
} from "./changes";
import type {
  NodeStatus,
  PushResult,
  StashEntry,
  VirtualCommit,
  WorkspaceBackend,
  WorkspaceSnapshot,
} from "./types";

export interface MediaListItem {
  base: MediaBase;
  path: string;
  displayPath: string;
  status: NodeStatus;
}

export interface UploadMediaOptions {
  base: MediaBase;
  pagePath: string;
  /** Folder inside the public directory; defaults to the first configured one. */
  folder?: string;
}

export interface EditorWorkspaceValue {
  ready: boolean;
  error: string | null;
  model: ContentModel | null;
  tree: ContentTree | null;
  changes: WorkspaceChange[];
  statuses: Record<string, NodeStatus>;
  mediaConfig: ResolvedMediaConfig;
  mediaItems: MediaListItem[];
  staged: string[];
  stashes: StashEntry[];
  commits: VirtualCommit[];
  pushing: boolean;
  lastPush: PushResult | null;
  mutate: (mutation: MetaMutation) => Promise<string | undefined>;
  saveFile: (path: string, content: string) => void;
  getFile: (path: string) => Promise<string>;
  /** True when the path exists in the last loaded server tree, so readers have a route for it. */
  isPublished: (path: string) => boolean;
  getOriginal: (path: string) => Promise<string>;
  uploadMedia: (
    file: MediaFileInput,
    options: UploadMediaOptions,
  ) => Promise<MediaUploadResult>;
  deleteMedia: (base: MediaBase, path: string) => void;
  renameMedia: (
    base: MediaBase,
    path: string,
    name: string,
  ) => string | undefined;
  readMediaUrl: (base: MediaBase, path: string) => Promise<string>;
  moveNodeWithMedia: (input: {
    id: string;
    targetFolder?: string;
    name?: string;
    beforeId?: string | null;
  }) => Promise<string | undefined>;
  stage: (paths: string[]) => void;
  unstage: (paths: string[]) => void;
  discard: (paths: string[]) => void;
  stashChanges: (label?: string) => void;
  stashPop: (id?: string) => void;
  stashDrop: (id: string) => void;
  commitAll: (message: string) => void;
  push: (title?: string) => Promise<void>;
  refresh: () => Promise<void>;
  hasChanges: boolean;
}

const WorkspaceContext = createContext<EditorWorkspaceValue | null>(null);

export function useEditorWorkspace(): EditorWorkspaceValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error(
      "useEditorWorkspace must be used inside <FumadocsEditorProvider>.",
    );
  }
  return context;
}

export interface EditorWorkspaceProviderProps {
  apiBase: string;
  storageKey: string;
  baseUrl?: string;
  media?: MediaConfig;
  backend?: WorkspaceBackend;
  children: ReactNode;
}

const EMPTY: WorkspaceSnapshot = {
  changes: [],
  staged: [],
  stashes: [],
  commits: [],
};

export function EditorWorkspaceProvider({
  apiBase,
  storageKey,
  baseUrl = "/docs",
  media,
  backend,
  children,
}: EditorWorkspaceProviderProps) {
  const mediaConfig = useMemo(() => resolveMediaConfig(media), [media]);
  const [base, setBase] = useState<ContentModel | null>(null);
  const [baseMedia, setBaseMedia] = useState<{
    content: string[];
    public: string[];
  }>({ content: [], public: [] });
  const [snapshot, setSnapshotState] = useState<WorkspaceSnapshot>(EMPTY);

  // Every writer funnels through here, so changes that undo each other never
  // reach the change list, the git panel, or a push.
  const setSnapshot = useCallback(
    (
      update:
        | WorkspaceSnapshot
        | ((current: WorkspaceSnapshot) => WorkspaceSnapshot),
    ) => {
      setSnapshotState((current) => {
        const next = typeof update === "function" ? update(current) : update;
        if (next.changes === current.changes) return next;
        return { ...next, changes: collapseChanges(next.changes) };
      });
    },
    [],
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [lastPush, setLastPush] = useState<PushResult | null>(null);
  const fileCache = useRef(new Map<string, string>());
  const mediaUrls = useRef(new Map<string, string>());
  const persisted = useRef(false);

  const remote = useMemo<WorkspaceBackend>(
    () =>
      backend ?? {
        async getTree() {
          const response = await fetch(`${apiBase}?op=tree`, {
            headers: { accept: "application/json" },
          });
          const payload = (await response.json()) as {
            model?: ContentModel;
            error?: string;
          };
          if (!response.ok || !payload.model) {
            throw new Error(
              payload.error ?? "Unable to load the content tree.",
            );
          }
          return payload.model;
        },
        async getFile(path: string) {
          const response = await fetch(
            `${apiBase}?op=file&path=${encodeURIComponent(path)}`,
            { headers: { accept: "application/json" } },
          );
          const payload = (await response.json()) as {
            content?: string;
            error?: string;
          };
          if (!response.ok || typeof payload.content !== "string") {
            throw new Error(payload.error ?? `Unable to read ${path}.`);
          }
          return payload.content;
        },
        async readBinary(input) {
          const response = await fetch(
            `${apiBase}?op=raw&base=${input.base}&path=${encodeURIComponent(input.path)}`,
            { headers: { accept: "application/json" } },
          );
          const payload = (await response.json()) as {
            base64?: string;
            mime?: string;
            error?: string;
          };
          if (!response.ok || typeof payload.base64 !== "string") {
            throw new Error(payload.error ?? `Unable to read ${input.path}.`);
          }
          return {
            base64: payload.base64,
            mime: payload.mime ?? "application/octet-stream",
          };
        },
        async listMedia() {
          const response = await fetch(`${apiBase}?op=media`, {
            headers: { accept: "application/json" },
          });
          const payload = (await response.json()) as {
            content?: string[];
            public?: string[];
            error?: string;
          };
          if (!response.ok) {
            throw new Error(payload.error ?? "Unable to list media.");
          }
          return {
            content: payload.content ?? [],
            public: payload.public ?? [],
          };
        },
        async push(input) {
          const response = await fetch(`${apiBase}?op=push`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
          const payload = (await response.json()) as PushResult & {
            error?: string;
          };
          if (!response.ok) {
            throw new Error(payload.error ?? "Unable to push changes.");
          }
          return payload;
        },
      },
    [apiBase, backend],
  );

  const persist = useCallback(
    async (next: WorkspaceSnapshot) => {
      try {
        await idbSet(`fumadocs-editor:${storageKey}`, next);
      } catch {
        // persistence is best-effort
      }
    },
    [storageKey],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const [stored, model, media] = await Promise.all([
        idbGet<WorkspaceSnapshot>(`fumadocs-editor:${storageKey}`).catch(
          () => undefined,
        ),
        remote.getTree(),
        remote.listMedia?.().catch(() => ({ content: [], public: [] })) ??
          Promise.resolve({ content: [], public: [] }),
      ]);

      setSnapshot(stored ?? EMPTY);
      setBase(model);
      setBaseMedia(media);
      setReady(true);
      persisted.current = true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load the workspace.",
      );
      setReady(true);
    }
  }, [remote, storageKey, setSnapshot]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!persisted.current) return;
    void persist(snapshot);
  }, [persist, snapshot]);

  /**
   * Committed changes leave `snapshot.changes` but stay client-side until they
   * are pushed, so every derivation of "what the content looks like now" has to
   * replay commits too. Re-applying an already pushed commit is a no-op.
   */
  const allChanges = useMemo(
    () => [
      ...snapshot.commits.flatMap((commit) => commit.changes),
      ...snapshot.changes,
    ],
    [snapshot.commits, snapshot.changes],
  );

  const model = useMemo(
    () => (base ? applyChanges(base, allChanges) : null),
    [base, allChanges],
  );

  const tree = useMemo(
    () => (model ? buildContentTree(model, baseUrl) : null),
    [model, baseUrl],
  );

  const statuses = useMemo(
    () => statusesFromChanges(snapshot.changes) as Record<string, NodeStatus>,
    [snapshot.changes],
  );

  const mediaItems = useMemo<MediaListItem[]>(() => {
    const items = new Map<string, MediaListItem>();
    const key = (base: MediaBase, path: string) => `${base}:${path}`;

    for (const path of baseMedia.content) {
      items.set(key("content", path), {
        base: "content",
        path,
        displayPath: path,
        status: "clean",
      });
    }
    for (const path of baseMedia.public) {
      items.set(key("public", path), {
        base: "public",
        path,
        displayPath: mediaDisplayPath("public", path, mediaConfig.publicDir),
        status: "clean",
      });
    }

    for (const change of allChanges) {
      const base: MediaBase =
        "base" in change && change.base === "public" ? "public" : "content";
      if (change.type === "delete") {
        items.delete(key(base, change.path));
      } else if (change.type === "move") {
        const existing = items.get(key(base, change.from));
        items.delete(key(base, change.from));
        if (existing) {
          items.delete(key(base, change.from));
          items.set(key(base, change.to), {
            ...existing,
            path: change.to,
            displayPath: mediaDisplayPath(
              base,
              change.to,
              mediaConfig.publicDir,
            ),
            status: "renamed",
          });
        } else if (isMediaFile(change.to, mediaConfig.types)) {
          items.set(key(base, change.to), {
            base,
            path: change.to,
            displayPath: mediaDisplayPath(
              base,
              change.to,
              mediaConfig.publicDir,
            ),
            status: "renamed",
          });
        }
      } else if (change.encoding === "base64") {
        items.set(key(base, change.path), {
          base,
          path: change.path,
          displayPath: mediaDisplayPath(
            base,
            change.path,
            mediaConfig.publicDir,
          ),
          status: change.type === "create" ? "new" : "modified",
        });
      }
    }

    return [...items.values()].sort((a, b) =>
      a.displayPath.localeCompare(b.displayPath),
    );
  }, [baseMedia, allChanges, mediaConfig.types]);

  const resolveBinary = useCallback(
    (
      base: MediaBase,
      path: string,
      visited = new Set<string>(),
    ): string | null => {
      if (visited.has(path)) return null;
      visited.add(path);

      for (const change of [...allChanges].reverse()) {
        const changeBase: MediaBase =
          "base" in change && change.base === "public" ? "public" : "content";
        if (changeBase !== base) continue;
        if (change.type === "move" && change.to === path) {
          return resolveBinary(base, change.from, visited);
        }
        if (
          (change.type === "create" || change.type === "update") &&
          change.encoding === "base64" &&
          change.path === path
        ) {
          return change.content;
        }
      }

      return null;
    },
    [allChanges],
  );

  const readMediaUrl = useCallback(
    async (base: MediaBase, path: string): Promise<string> => {
      const key = `${base}:${path}`;
      const cached = mediaUrls.current.get(key);
      if (cached) return cached;

      const overlay = resolveBinary(base, path);
      if (overlay) {
        const url = base64ToDataUrl(overlay, mimeForMedia(path));
        mediaUrls.current.set(key, url);
        return url;
      }

      if (!remote.readBinary) return "";
      const result = await remote.readBinary({ base, path });
      const url = base64ToDataUrl(result.base64, result.mime);
      mediaUrls.current.set(key, url);
      return url;
    },
    [remote, resolveBinary],
  );

  const uploadMedia = useCallback(
    async (
      file: MediaFileInput,
      options: UploadMediaOptions,
    ): Promise<MediaUploadResult> => {
      const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
      if (!mediaConfig.types.includes(extension)) {
        throw new Error(`Unsupported media type: ${extension || "unknown"}.`);
      }
      if (file.size > mediaConfig.maxSize) {
        throw new Error(
          `File is too large (max ${Math.round(mediaConfig.maxSize / 1024 / 1024)} MB).`,
        );
      }

      const base64 = await fileToBase64(file);
      const existing = new Set(
        mediaItems
          .filter((item) => item.base === options.base)
          .map((item) => item.path),
      );
      const name = uniqueMediaName(existing, sanitizeMediaName(file.name));
      const path =
        options.base === "public"
          ? publicMediaPath(mediaConfig, name, options.folder)
          : contentMediaPath(options.pagePath, name);

      setSnapshot((current) => ({
        ...current,
        changes: [
          ...current.changes,
          {
            type: "create",
            path,
            content: base64,
            encoding: "base64",
            base: options.base,
          },
        ],
      }));

      mediaUrls.current.set(
        `${options.base}:${path}`,
        base64ToDataUrl(base64, mimeForMedia(path)),
      );

      const src =
        options.base === "public"
          ? publicMediaSrc(mediaConfig, path)
          : relativeMediaSrc(options.pagePath, path);

      return { base: options.base, path, src, name };
    },
    [mediaConfig, mediaItems, setSnapshot],
  );

  const deleteMedia = useCallback(
    (base: MediaBase, path: string) => {
      mediaUrls.current.delete(`${base}:${path}`);
      setSnapshot((current) => {
        const changeBase = (change: WorkspaceChange) =>
          "base" in change && change.base === "public" ? "public" : "content";
        const isDraft = current.changes.some(
          (change) =>
            (change.type === "create" || change.type === "update") &&
            change.path === path &&
            changeBase(change) === base,
        );

        if (isDraft) {
          return {
            ...current,
            changes: current.changes.filter(
              (change) =>
                !(
                  (change.type === "create" || change.type === "update") &&
                  change.path === path &&
                  changeBase(change) === base
                ),
            ),
            staged: current.staged.filter((staged) => staged !== path),
          };
        }

        return {
          ...current,
          changes: [...current.changes, { type: "delete", path, base }],
          staged: current.staged.filter((staged) => staged !== path),
        };
      });
    },
    [setSnapshot],
  );

  const renameMedia = useCallback(
    (base: MediaBase, path: string, name: string): string | undefined => {
      const existing = new Set(
        mediaItems
          .filter((item) => item.base === base && item.path !== path)
          .map((item) => item.path),
      );
      const nextName = uniqueMediaName(existing, sanitizeMediaName(name));
      const folder = parentFolder(path);
      const to = folder ? `${folder}/${nextName}` : nextName;
      if (to === path) return;

      setSnapshot((current) => {
        const changeBase = (change: WorkspaceChange) =>
          "base" in change && change.base === "public" ? "public" : "content";
        const index = current.changes.findIndex(
          (change) =>
            (change.type === "create" || change.type === "update") &&
            change.path === path &&
            changeBase(change) === base,
        );

        if (index !== -1) {
          const changes = [...current.changes];
          const change = changes[index] as Extract<
            WorkspaceChange,
            { type: "create" | "update" }
          >;
          changes[index] = { ...change, path: to };
          return { ...current, changes };
        }

        return {
          ...current,
          changes: [...current.changes, { type: "move", from: path, to, base }],
        };
      });

      return to;
    },
    [mediaItems, setSnapshot],
  );

  const resolveContent = useCallback(
    async (path: string, visited = new Set<string>()): Promise<string> => {
      if (visited.has(path)) throw new Error("Circular move detected.");
      visited.add(path);

      for (const change of [...allChanges].reverse()) {
        if (change.type === "move" && change.to === path) {
          return resolveContent(change.from, visited);
        }
        if (
          (change.type === "create" || change.type === "update") &&
          change.path === path
        ) {
          return change.content;
        }
      }

      const cached = fileCache.current.get(path);
      if (cached !== undefined) return cached;

      const content = await remote.getFile(path);
      fileCache.current.set(path, content);
      return content;
    },
    [remote, allChanges],
  );

  const resolveOriginalPath = useCallback(
    (path: string, visited = new Set<string>()): string => {
      if (visited.has(path)) return path;
      visited.add(path);
      for (const change of [...allChanges].reverse()) {
        if (change.type === "move" && change.to === path) {
          return resolveOriginalPath(change.from, visited);
        }
      }
      return path;
    },
    [allChanges],
  );

  const getOriginal = useCallback(
    async (path: string): Promise<string> => {
      const originalPath = resolveOriginalPath(path);
      if (!(base?.files.includes(originalPath) ?? false)) return "";

      const key = `original:${originalPath}`;
      const cached = fileCache.current.get(key);
      if (cached !== undefined) return cached;

      try {
        const content = await remote.getFile(originalPath);
        fileCache.current.set(key, content);
        return content;
      } catch {
        return "";
      }
    },
    [base, remote, resolveOriginalPath],
  );

  const moveNodeWithMedia = useCallback(
    async (input: {
      id: string;
      targetFolder?: string;
      name?: string;
      beforeId?: string | null;
    }): Promise<string | undefined> => {
      if (!model) throw new Error("Workspace is not ready.");

      const id = input.id;
      const folder = parentFolder(id);
      const extension =
        id.endsWith(".md") && !id.endsWith(".mdx") ? ".md" : ".mdx";
      const targetFolder = input.targetFolder ?? folder;
      const targetPath = input.name
        ? `${folder ? `${folder}/` : ""}${slugify(input.name)}${extension}`
        : `${targetFolder ? `${targetFolder}/` : ""}${baseName(id)}`;

      const content = await resolveContent(id);
      const mediaMoves: WorkspaceChange[] = [];
      const seen = new Set<string>();
      const targetDir = parentFolder(targetPath);

      const rewritten = rewriteRelativeMedia(content, id, (mediaPath) => {
        if (!isMediaFile(mediaPath, mediaConfig.types)) return null;
        const name = baseName(mediaPath);
        if (seen.has(mediaPath)) return `./${name}`;
        seen.add(mediaPath);

        const to = `${targetDir ? `${targetDir}/` : ""}${name}`;
        if (to !== mediaPath) {
          mediaMoves.push({
            type: "move",
            from: mediaPath,
            to,
            base: "content",
          });
        }
        return `./${name}`;
      });

      const result = input.name
        ? applyMutation(model, { type: "renameNode", id, name: input.name })
        : applyMutation(model, {
            type: "moveNode",
            id,
            targetFolder,
            beforeId: input.beforeId,
          });

      const extra: WorkspaceChange[] = [...mediaMoves];
      if (rewritten !== content) {
        extra.push({
          type: "update",
          path: targetPath,
          content: rewritten,
          base: "content",
        });
      }

      const moves = [...result.changes, ...extra]
        .filter(
          (change): change is Extract<WorkspaceChange, { type: "move" }> =>
            change.type === "move",
        )
        .map((change) => ({ from: change.from, to: change.to }));

      setSnapshot((current) => ({
        ...current,
        changes: [
          ...retargetChanges(current.changes, moves),
          ...result.changes,
          ...extra,
        ],
      }));

      return result.focusId ?? targetPath;
    },
    [model, mediaConfig.types, resolveContent, setSnapshot],
  );

  const mutate = useCallback(
    async (mutation: MetaMutation): Promise<string | undefined> => {
      if (!model) throw new Error("Workspace is not ready.");
      const result = applyMutation(model, mutation);
      const moves = result.changes
        .filter(
          (change): change is Extract<WorkspaceChange, { type: "move" }> =>
            change.type === "move",
        )
        .map((change) => ({ from: change.from, to: change.to }));

      setSnapshot((current) => ({
        ...current,
        changes: [
          ...retargetChanges(current.changes, moves),
          ...result.changes,
        ],
        staged: current.staged.filter(
          (path) =>
            !result.changes.some((change) =>
              change.type === "move"
                ? change.to === path || change.from === path
                : change.path === path,
            ),
        ),
      }));

      return result.focusId;
    },
    [model, setSnapshot],
  );

  const saveFile = useCallback(
    (path: string, content: string) => {
      setSnapshot((current) => {
        const movedTo = current.changes.some(
          (change) => change.type === "move" && change.to === path,
        );
        const inBase = base?.files.includes(path) ?? false;

        const filtered = current.changes.filter((change) => {
          if (change.type === "move") return change.to !== path;
          return change.path !== path;
        });

        const next: WorkspaceChange =
          movedTo || inBase
            ? { type: "update", path, content }
            : { type: "create", path, content };

        return { ...current, changes: [...filtered, next] };
      });
    },
    [base, setSnapshot],
  );

  const stage = useCallback(
    (paths: string[]) => {
      setSnapshot((current) => ({
        ...current,
        staged: [...new Set([...current.staged, ...paths])],
      }));
    },
    [setSnapshot],
  );

  const unstage = useCallback(
    (paths: string[]) => {
      setSnapshot((current) => ({
        ...current,
        staged: current.staged.filter((path) => !paths.includes(path)),
      }));
    },
    [setSnapshot],
  );

  const discard = useCallback(
    (paths: string[]) => {
      setSnapshot((current) => ({
        ...current,
        changes: current.changes.filter((change) => {
          const path = change.type === "move" ? change.to : change.path;
          return (
            !paths.includes(path) &&
            !paths.includes(change.type === "move" ? change.from : path)
          );
        }),
        staged: current.staged.filter((path) => !paths.includes(path)),
      }));
    },
    [setSnapshot],
  );

  const stashChanges = useCallback(
    (label?: string) => {
      setSnapshot((current) => {
        if (current.changes.length === 0) return current;
        const entry: StashEntry = {
          id: `stash-${Date.now().toString(36)}`,
          label: label ?? `Stash ${current.stashes.length + 1}`,
          createdAt: new Date().toISOString(),
          changes: current.changes,
          staged: current.staged,
        };
        return {
          ...current,
          changes: [],
          staged: [],
          stashes: [entry, ...current.stashes],
        };
      });
    },
    [setSnapshot],
  );

  const stashPop = useCallback(
    (id?: string) => {
      setSnapshot((current) => {
        const entry = id
          ? current.stashes.find((stash) => stash.id === id)
          : current.stashes[0];
        if (!entry) return current;
        return {
          ...current,
          changes: [...current.changes, ...entry.changes],
          staged: [...new Set([...current.staged, ...entry.staged])],
          stashes: current.stashes.filter((stash) => stash.id !== entry.id),
        };
      });
    },
    [setSnapshot],
  );

  const stashDrop = useCallback(
    (id: string) => {
      setSnapshot((current) => ({
        ...current,
        stashes: current.stashes.filter((stash) => stash.id !== id),
      }));
    },
    [setSnapshot],
  );

  const commitAll = useCallback(
    (message: string) => {
      setSnapshot((current) => {
        const stagedSet = new Set(current.staged);
        const staged = current.changes.filter((change) => {
          const path = change.type === "move" ? change.to : change.path;
          return stagedSet.size === 0 || stagedSet.has(path);
        });
        if (staged.length === 0) return current;

        const commit: VirtualCommit = {
          id: `commit-${Date.now().toString(36)}`,
          message,
          createdAt: new Date().toISOString(),
          changes: staged,
        };

        return {
          ...current,
          changes: current.changes.filter((change) => !staged.includes(change)),
          staged: [],
          commits: [...current.commits, commit],
        };
      });
    },
    [setSnapshot],
  );

  const push = useCallback(
    async (title?: string) => {
      const unpushed = snapshot.commits.filter((commit) => !commit.pushed);
      if (unpushed.length === 0) return;

      setPushing(true);
      setError(null);
      try {
        const result = await remote.push({
          commits: unpushed,
          title:
            title ??
            unpushed[unpushed.length - 1]?.message ??
            "docs: update content",
        });
        setLastPush(result);
        setSnapshot((current) => ({
          ...current,
          commits: current.commits.map((commit) =>
            commit.pushed ? commit : { ...commit, pushed: result },
          ),
        }));
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to push changes.",
        );
      } finally {
        setPushing(false);
      }
    },
    [remote, snapshot.commits, setSnapshot],
  );

  const isPublished = useCallback(
    (path: string) => base?.files.includes(path) ?? false,
    [base],
  );

  const value = useMemo<EditorWorkspaceValue>(
    () => ({
      ready,
      error,
      model,
      tree,
      changes: snapshot.changes,
      statuses,
      mediaConfig,
      mediaItems,
      staged: snapshot.staged,
      stashes: snapshot.stashes,
      commits: snapshot.commits,
      pushing,
      lastPush,
      mutate,
      saveFile,
      getFile: resolveContent,
      isPublished,
      getOriginal,
      uploadMedia,
      deleteMedia,
      renameMedia,
      readMediaUrl,
      moveNodeWithMedia,
      stage,
      unstage,
      discard,
      stashChanges,
      stashPop,
      stashDrop,
      commitAll,
      push,
      refresh: load,
      hasChanges: snapshot.changes.length > 0,
    }),
    [
      ready,
      error,
      model,
      tree,
      statuses,
      mediaConfig,
      mediaItems,
      snapshot,
      pushing,
      lastPush,
      mutate,
      saveFile,
      resolveContent,
      isPublished,
      getOriginal,
      uploadMedia,
      deleteMedia,
      renameMedia,
      readMediaUrl,
      moveNodeWithMedia,
      stage,
      unstage,
      discard,
      stashChanges,
      stashPop,
      stashDrop,
      commitAll,
      push,
      load,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
