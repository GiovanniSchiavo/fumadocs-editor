"use client";

import { useCallback } from "react";
import { renderMediaTemplate } from "../media/paths";
import { useEditorWorkspace } from "../workspace/context";
import { useFumadocsEditor } from "./context";

export function useMediaFileHandler(): (files: File[]) => Promise<string[]> {
  const editor = useFumadocsEditor();
  const workspace = useEditorWorkspace();

  return useCallback(
    async (files: File[]) => {
      const pagePath = editor.document?.path ?? "index.mdx";
      const snippets: string[] = [];

      // Dropped into the text of a page: the asset belongs to that page.
      for (const file of files) {
        const result = await workspace.uploadMedia(file, {
          base: "content",
          pagePath,
        });
        snippets.push(
          renderMediaTemplate(workspace.mediaConfig.insertTemplate, {
            alt: result.name.replace(/\.[^.]+$/, ""),
            src: result.src,
            name: result.name,
          }),
        );
      }

      return snippets;
    },
    [editor.document?.path, workspace],
  );
}
