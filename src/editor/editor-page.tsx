"use client";

import { usePathname } from "fumadocs-core/framework";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { FileText } from "lucide-react";
import { useEffect, useMemo } from "react";
import { isPageFile } from "../content/model";
import { useFumadocsEditor } from "./context";
import { DiffPanel } from "./diff-panel";
import { EditorToolbar } from "./editor-toolbar";
import { useFrontmatter } from "./frontmatter-text";
import { MarkdownEditor } from "./markdown-editor";
import { PreviewPanel } from "./preview-panel";
import { SplitPanel } from "./split-panel";
import { sourceToc } from "./toc";
import { useMediaFileHandler } from "./use-media-files";

/**
 * The `/editor/[[...slug]]` page. The URL carries the content file path, so a
 * page that exists only as a pending change is as routable as a committed one.
 */
export function EditorPage() {
  const editor = useFumadocsEditor();
  const pathname = usePathname();

  const path = decodeURIComponent(
    pathname.slice(editor.editorBasePath.length).replace(/^\//, ""),
  );

  const { document, enter } = editor;
  const open = document?.path;
  const frontmatter = useFrontmatter();

  useEffect(() => {
    if (path && path !== open) void enter({ path });
  }, [path, open, enter]);

  const toc = useMemo(
    () => (document ? sourceToc(document.current) : []),
    [document],
  );

  const title =
    typeof frontmatter.title === "string" && frontmatter.title
      ? frontmatter.title
      : (path.split("/").pop() ?? "Editor");
  const description =
    typeof frontmatter.description === "string"
      ? frontmatter.description
      : undefined;

  return (
    <DocsPage
      toc={toc}
      breadcrumb={{ enabled: false }}
      footer={{ enabled: false }}
    >
      <DocsTitle>{title}</DocsTitle>
      <DocsDescription className="mb-0">{description}</DocsDescription>
      <div className="fde-editor-header">
        <EditorToolbar path={path || undefined} title={title} />
      </div>
      <DocsBody className="fde-editor-route">
        {!path ? (
          <p className="fde-editor-placeholder">
            <FileText size={16} /> Choose a page from the sidebar to start
            editing.
          </p>
        ) : (
          <EditorPanes />
        )}
      </DocsBody>
    </DocsPage>
  );
}

function EditorPanes() {
  const {
    document,
    mode,
    undo,
    redo,
    update,
    format,
    canFormat,
    lint,
    componentHints,
    setCursorOffset,
  } = useFumadocsEditor();
  const handleFiles = useMediaFileHandler();

  if (!document) return <div className="fde-editor-placeholder">Loading…</div>;

  // meta.json and friends are opened to read the diff, not to edit.
  if (mode === "diff" || !isPageFile(document.path)) return <DiffPanel />;

  if (mode === "split") return <SplitPanel />;
  if (mode === "preview") return <PreviewPanel />;

  return (
    <MarkdownEditor
      value={document.current}
      onChange={update}
      onUndo={undo}
      onRedo={redo}
      onFormat={canFormat ? () => void format() : undefined}
      onFiles={handleFiles}
      onSelectionChange={setCursorOffset}
      lint={lint}
      componentHints={componentHints}
      path={document.path}
    />
  );
}
