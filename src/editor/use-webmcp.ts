"use client";

import { useEffect, useMemo, useRef } from "react";
import type { EditorFormatter } from "../types";
import { createEditorWebMcpTools, type WebMcpContext } from "../webmcp/tools";
import { getModelContext, type WebMcpConfig } from "../webmcp/types";
import { useEditorWorkspace } from "../workspace/context";
import { useFumadocsEditor } from "./context";

export function EditorWebMcpBridge({
  webmcp,
  formatter,
}: {
  webmcp: false | WebMcpConfig | undefined;
  formatter: EditorFormatter | undefined;
}) {
  useEditorWebMcp(webmcp, formatter);
  return null;
}

export function useEditorWebMcp(
  config: false | WebMcpConfig | undefined,
  formatter: EditorFormatter | undefined,
): void {
  const editor = useFumadocsEditor();
  const workspace = useEditorWorkspace();
  const contextRef = useRef<WebMcpContext | null>(null);

  contextRef.current = {
    workspace: {
      tree: workspace.tree,
      changes: workspace.changes,
      statuses: workspace.statuses,
      mediaItems: workspace.mediaItems,
      mediaConfig: workspace.mediaConfig,
      getFile: workspace.getFile,
      getOriginal: workspace.getOriginal,
      saveFile: workspace.saveFile,
      mutate: workspace.mutate,
      moveNodeWithMedia: workspace.moveNodeWithMedia,
      uploadMedia: workspace.uploadMedia,
    },
    editor: {
      document: editor.document
        ? { path: editor.document.path, current: editor.document.current }
        : null,
      enter: editor.enter,
      exit: editor.exit,
      insertAtCursor: editor.insertAtCursor,
      formatSource: async (path, source) => {
        if (!formatter) {
          throw new Error("No formatter is configured for this editor.");
        }
        return formatter({ path, source });
      },
      hasFormatter: Boolean(formatter),
      components: editor.componentHints,
    },
  };

  const enabled =
    config !== false &&
    (typeof config !== "object" || config?.enabled !== false);
  const prefix = typeof config === "object" ? config?.prefix : undefined;
  const allowlist =
    typeof config === "object" && config?.tools
      ? config.tools.join(",")
      : undefined;

  const tools = useMemo(
    () =>
      createEditorWebMcpTools(
        () => {
          const context = contextRef.current;
          if (!context) throw new Error("The editor is not ready yet.");
          return context;
        },
        {
          prefix,
          tools: allowlist ? allowlist.split(",") : undefined,
        },
      ),
    [prefix, allowlist],
  );

  useEffect(() => {
    if (!enabled) return;

    const modelContext = getModelContext();
    if (!modelContext) return;

    const controller = new AbortController();
    for (const tool of tools) {
      void modelContext
        .registerTool(tool, { signal: controller.signal })
        .catch(() => {
          // Registration can fail when the feature is not enabled.
        });
    }

    return () => controller.abort();
  }, [enabled, tools]);
}
