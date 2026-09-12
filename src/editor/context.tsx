"use client";

import { usePathname, useRouter } from "fumadocs-core/framework";
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
import { pageUrl } from "../content/model";
import type { MediaConfig } from "../media/types";
import type { Change, EditorFormatter, RepositorySession } from "../types";
import type { WebMcpConfig } from "../webmcp/types";
import {
  EditorWorkspaceProvider,
  useEditorWorkspace,
} from "../workspace/context";
import type { MdxComponentHint } from "./completions";
import { editorStyles } from "./styles";
import { EditorWebMcpBridge } from "./use-webmcp";

export type EditorMode = "edit" | "split" | "preview" | "diff";

const CHECKPOINT_DELAY = 500;
const MAX_HISTORY = 200;

export const DEFAULT_EDITOR_BASE_PATH = "/editor";

/**
 * Editor UI state that survives a reload. The file being edited is not here —
 * that lives in the URL, which is the editor route itself.
 */
interface PersistedEditorState {
  mode?: EditorMode;
  splitRatio?: number;
  sidePanel?: EditorSidePanel;
}

function readPersisted(key: string): PersistedEditorState | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PersistedEditorState) : null;
  } catch {
    return null;
  }
}

export interface EditorDocument {
  path: string;
  title?: string;
  original: string;
  current: string;
}

export type EditorSidePanel = "pages" | "git" | "media";

export interface EnterDocumentInput {
  path: string;
  title?: string;
  source?: string;
}

export interface SubmitInput {
  message?: string;
  description?: string;
  branch?: string;
}

export interface SubmitResult {
  ok: boolean;
  mode: "local" | "pull-request";
  message: string;
  branch?: string;
  pullRequest?: {
    number?: number;
    url?: string;
  };
}

export interface FumadocsEditorConfig {
  repository: RepositorySession;
  apiBase?: string;
  docsBaseUrl?: string;
  /** Route segment the editor lives under. Defaults to `/editor`. */
  editorBasePath?: string;
  renderPreview?: (source: string) => ReactNode | Promise<ReactNode>;
  formatter?: EditorFormatter;
  lint?: boolean;
  components?: MdxComponentHint[];
  media?: MediaConfig;
  webmcp?: false | WebMcpConfig;
}

export interface UpdateOptions {
  checkpoint?: boolean;
}

export interface FumadocsEditorContextValue {
  repository: RepositorySession;
  apiBase: string;
  editorBasePath: string;
  /** Route of the editor for a content file, e.g. `/editor/guides/intro.mdx`. */
  editorHref: (path: string) => string;
  document: EditorDocument | null;
  isEditing: boolean;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canFormat: boolean;
  formatting: boolean;
  mode: EditorMode;
  splitRatio: number;
  saving: boolean;
  error: string | null;
  result: SubmitResult | null;
  renderPreview?: FumadocsEditorConfig["renderPreview"];
  lint: boolean;
  componentHints: MdxComponentHint[];
  media: FumadocsEditorConfig["media"];
  sidePanel: EditorSidePanel;
  setSidePanel: (panel: EditorSidePanel) => void;
  setCursorOffset: (offset: number) => void;
  insertAtCursor: (text: string) => void;
  setMode: (mode: EditorMode) => void;
  setSplitRatio: (ratio: number) => void;
  undo: () => void;
  redo: () => void;
  format: () => Promise<void>;
  enter: (input: EnterDocumentInput) => Promise<void>;
  exit: () => void;
  update: (value: string, options?: UpdateOptions) => void;
  submit: (input?: SubmitInput) => Promise<SubmitResult | null>;
  clearFeedback: () => void;
}

const EditorContext = createContext<FumadocsEditorContextValue | null>(null);

export function useFumadocsEditor(): FumadocsEditorContextValue {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error(
      "useFumadocsEditor must be used inside <FumadocsEditorProvider>.",
    );
  }
  return context;
}

export interface FumadocsEditorProviderProps extends FumadocsEditorConfig {
  children: ReactNode;
}

export function FumadocsEditorProvider(props: FumadocsEditorProviderProps) {
  return (
    <EditorWorkspaceProvider
      apiBase={props.apiBase ?? "/api/editor"}
      storageKey={`${props.repository.owner}/${props.repository.repo}`}
      baseUrl={props.docsBaseUrl ?? "/docs"}
      media={props.media}
    >
      <EditorProviderInner {...props} />
    </EditorWorkspaceProvider>
  );
}

function EditorProviderInner({
  repository,
  apiBase = "/api/editor",
  docsBaseUrl = "/docs",
  editorBasePath = DEFAULT_EDITOR_BASE_PATH,
  renderPreview,
  formatter,
  lint = true,
  components,
  media,
  webmcp,
  children,
}: FumadocsEditorProviderProps) {
  const workspace = useEditorWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const [document, setDocument] = useState<EditorDocument | null>(null);
  const [mode, setMode] = useState<EditorMode>("edit");
  const [splitRatio, setSplitRatio] = useState(50);
  const [sidePanel, setSidePanel] = useState<EditorSidePanel>("pages");
  const [saving, setSaving] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [, setHistoryTick] = useState(0);
  const saveTimerRef = useRef<number | null>(null);
  const cursorRef = useRef(0);

  const openRef = useRef(false);
  const lastViewRef = useRef<EditorMode>("edit");
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const lastCheckpointRef = useRef(0);

  const stateKey = `fumadocs-editor:ui:${repository.owner}/${repository.repo}`;
  const restoredRef = useRef(false);

  const scheduleSave = useCallback(
    (path: string, value: string) => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        workspace.saveFile(path, value);
      }, 400);
    },
    [workspace],
  );

  const pushCheckpoint = useCallback((value: string) => {
    pastRef.current.push(value);
    if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
    futureRef.current = [];
    lastCheckpointRef.current = Date.now();
    setHistoryTick((tick) => tick + 1);
  }, []);

  const enter = useCallback(
    async (input: EnterDocumentInput) => {
      setError(null);
      setResult(null);
      if (!openRef.current) setMode("edit");
      openRef.current = true;
      pastRef.current = [];
      futureRef.current = [];
      lastCheckpointRef.current = 0;

      try {
        let source: string | undefined;
        try {
          source = await workspace.getFile(input.path);
        } catch {
          source = input.source;
        }

        if (source === undefined) {
          throw new Error(`Unable to load ${input.path}.`);
        }

        setDocument({
          path: input.path,
          title: input.title,
          original: source,
          current: source,
        });
      } catch (caught) {
        openRef.current = false;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to open the editor.",
        );
      }
    },
    [workspace],
  );

  const exit = useCallback(() => {
    openRef.current = false;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      if (document) workspace.saveFile(document.path, document.current);
    }
    setError(null);
    setResult(null);
    pastRef.current = [];
    futureRef.current = [];
    lastCheckpointRef.current = 0;
    // Only a file the repository has can be read at its docs route; a page that
    // exists solely as a pending change would land on a 404.
    router.push(
      document && workspace.isPublished(document.path)
        ? pageUrl(document.path, docsBaseUrl)
        : docsBaseUrl,
    );
  }, [document, workspace, router, docsBaseUrl]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const saved = readPersisted(stateKey);
    if (saved?.sidePanel) setSidePanel(saved.sidePanel);
    if (typeof saved?.splitRatio === "number") setSplitRatio(saved.splitRatio);
    if (saved?.mode) setMode(saved.mode);
  }, [stateKey]);

  useEffect(() => {
    if (!restoredRef.current) return;
    // Diff is a transient view — opening it (from a change row, say) must not
    // replace the view the reader chose to work in.
    if (mode !== "diff") lastViewRef.current = mode;
    try {
      window.localStorage.setItem(
        stateKey,
        JSON.stringify({
          mode: lastViewRef.current,
          splitRatio,
          sidePanel,
        } satisfies PersistedEditorState),
      );
    } catch {
      // storage unavailable (private mode, quota) — state just will not survive
    }
  }, [mode, splitRatio, sidePanel, stateKey]);

  const update = useCallback(
    (value: string, options?: UpdateOptions) => {
      if (!document || value === document.current) return;

      if (
        options?.checkpoint ||
        Date.now() - lastCheckpointRef.current > CHECKPOINT_DELAY
      ) {
        pushCheckpoint(document.current);
      }

      scheduleSave(document.path, value);

      setDocument((current) =>
        current ? { ...current, current: value } : current,
      );
    },
    [document, pushCheckpoint, scheduleSave],
  );

  const setCursorOffset = useCallback((offset: number) => {
    cursorRef.current = offset;
  }, []);

  const insertAtCursor = useCallback(
    (text: string) => {
      if (!document) return;
      const offset = Math.min(cursorRef.current, document.current.length);
      const next = `${document.current.slice(0, offset)}${text}${document.current.slice(offset)}`;
      cursorRef.current = offset + text.length;
      update(next, { checkpoint: true });
    },
    [document, update],
  );

  const undo = useCallback(() => {
    if (!document) return;

    const previous = pastRef.current.pop();
    if (previous === undefined) return;

    futureRef.current.push(document.current);
    lastCheckpointRef.current = 0;
    workspace.saveFile(document.path, previous);
    setDocument((current) =>
      current ? { ...current, current: previous } : current,
    );
    setHistoryTick((tick) => tick + 1);
  }, [document, workspace]);

  const redo = useCallback(() => {
    if (!document) return;

    const next = futureRef.current.pop();
    if (next === undefined) return;

    pastRef.current.push(document.current);
    lastCheckpointRef.current = 0;
    workspace.saveFile(document.path, next);
    setDocument((current) =>
      current ? { ...current, current: next } : current,
    );
    setHistoryTick((tick) => tick + 1);
  }, [document, workspace]);

  const format = useCallback(async () => {
    if (!document || !formatter) return;

    setFormatting(true);
    setError(null);

    try {
      const formatted = await formatter({
        path: document.path,
        source: document.current,
      });

      if (typeof formatted !== "string") {
        throw new Error("The formatter must return a string.");
      }

      if (formatted === document.current) return;

      pushCheckpoint(document.current);
      workspace.saveFile(document.path, formatted);
      setDocument((current) =>
        current ? { ...current, current: formatted } : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Formatting failed.");
    } finally {
      setFormatting(false);
    }
  }, [document, formatter, pushCheckpoint, workspace]);

  const submit = useCallback(
    async (input?: SubmitInput): Promise<SubmitResult | null> => {
      if (!document) return null;

      setSaving(true);
      setError(null);

      const changes: Change[] = [
        { type: "update", path: document.path, content: document.current },
      ];

      try {
        const response = await fetch(apiBase, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...input, changes }),
        });
        const payload = (await response.json()) as SubmitResult & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to submit changes.");
        }

        setResult(payload);
        setDocument((current) =>
          current ? { ...current, original: current.current } : current,
        );
        return payload;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to submit changes.",
        );
        return null;
      } finally {
        setSaving(false);
      }
    },
    [apiBase, document],
  );

  const clearFeedback = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  const editorHref = useCallback(
    (path: string) => `${editorBasePath}/${path}`,
    [editorBasePath],
  );

  const value = useMemo<FumadocsEditorContextValue>(
    () => ({
      repository,
      apiBase,
      editorBasePath,
      editorHref,
      document,
      isEditing: pathname.startsWith(editorBasePath),
      isDirty: Boolean(document && document.current !== document.original),
      canUndo: pastRef.current.length > 0,
      canRedo: futureRef.current.length > 0,
      canFormat: formatter !== undefined,
      formatting,
      mode,
      splitRatio,
      saving,
      error,
      result,
      renderPreview,
      lint,
      componentHints: components ?? [],
      media,
      sidePanel,
      setSidePanel,
      setCursorOffset,
      insertAtCursor,
      setMode,
      setSplitRatio,
      undo,
      redo,
      format,
      enter,
      exit,
      update,
      submit,
      clearFeedback,
    }),
    [
      repository,
      apiBase,
      editorBasePath,
      editorHref,
      pathname,
      document,
      formatting,
      formatter,
      lint,
      components,
      media,
      sidePanel,
      setCursorOffset,
      insertAtCursor,
      mode,
      splitRatio,
      saving,
      error,
      result,
      renderPreview,
      undo,
      redo,
      format,
      enter,
      exit,
      update,
      submit,
      clearFeedback,
    ],
  );

  return (
    <EditorContext.Provider value={value}>
      <style>{editorStyles}</style>
      {children}
      {webmcp === false ? null : (
        <EditorWebMcpBridge webmcp={webmcp} formatter={formatter} />
      )}
    </EditorContext.Provider>
  );
}
