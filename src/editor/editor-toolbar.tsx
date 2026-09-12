"use client";

import {
  Image as ImageIcon,
  Keyboard,
  Redo2,
  Repeat,
  Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { isPageFile } from "../content/model";
import { type EditorMode, useFumadocsEditor } from "./context";
import { EditThisPage } from "./edit-this-page";
import { ShortcutsDialog } from "./shortcuts-dialog";

const MODES: Array<{ id: EditorMode; label: string }> = [
  { id: "edit", label: "Edit" },
  { id: "split", label: "Split" },
  { id: "preview", label: "Preview" },
  { id: "diff", label: "Diff" },
];

const DEFAULT_MODE: { id: EditorMode; label: string } = {
  id: "edit",
  label: "Edit",
};

export interface EditorToolbarProps {
  /** Content file path. Required on a docs page, implied by the editor route. */
  path?: string;
  title?: string;
}

export function EditorToolbar({ path, title }: EditorToolbarProps) {
  const editor = useFumadocsEditor();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { document, isDirty, isEditing, mode, saving } = editor;

  useEffect(() => {
    if (!isEditing) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;

      if (event.shiftKey && event.code === "KeyH") {
        event.preventDefault();
        setShortcutsOpen((open) => !open);
        return;
      }

      const key = event.key.toLowerCase();

      if (shortcutsOpen) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest(".fde-editor")) return;

      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          editor.redo();
        } else {
          editor.undo();
        }
        return;
      }

      if (key === "y") {
        event.preventDefault();
        editor.redo();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditing, shortcutsOpen, editor]);

  if (!isEditing || !document) {
    return (
      <span className="fde-toolbar">
        {path ? <EditThisPage path={path} title={title} /> : null}
        {editor.error ? (
          <span className="fde-status" data-kind="error" role="alert">
            {editor.error}
            <button
              type="button"
              className="fde-status-dismiss"
              onClick={editor.clearFeedback}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </span>
        ) : null}
      </span>
    );
  }

  function requestExit() {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    setShortcutsOpen(false);
    editor.exit();
  }

  // Files that are not pages (meta.json) open read-only, in diff view.
  const readOnly = !isPageFile(document.path);

  const activeIndex = MODES.findIndex((entry) => entry.id === mode);
  const activeMode = MODES[activeIndex] ?? DEFAULT_MODE;
  const nextMode = MODES[(activeIndex + 1) % MODES.length] ?? DEFAULT_MODE;

  return (
    <span className="fde-toolbar">
      <button type="button" className="fde-button" onClick={requestExit}>
        Exit
      </button>
      {readOnly ? (
        <span className="fde-readonly-badge">Read-only diff</span>
      ) : (
        <>
          <button
            type="button"
            className="fde-button fde-mode-button"
            onClick={() => editor.setMode(nextMode.id)}
            title={`Switch view (next: ${nextMode.label})`}
            aria-label={`View: ${activeMode.label}. Switch to ${nextMode.label}`}
          >
            <Repeat size={14} />
            {activeMode.label}
          </button>
          <button
            type="button"
            className="fde-icon-button"
            onClick={editor.undo}
            disabled={!editor.canUndo}
            aria-label="Undo"
            title="Undo"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            className="fde-icon-button"
            onClick={editor.redo}
            disabled={!editor.canRedo}
            aria-label="Redo"
            title="Redo"
          >
            <Redo2 size={14} />
          </button>
          {editor.canFormat ? (
            <button
              type="button"
              className="fde-button fde-format-button"
              onClick={() => void editor.format()}
              disabled={editor.formatting || saving}
              title="Format document (Shift+Alt+F)"
            >
              {editor.formatting ? "Formatting…" : "Format"}
            </button>
          ) : null}
          <button
            type="button"
            className="fde-icon-button"
            onClick={() => setShortcutsOpen(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
          >
            <Keyboard size={14} />
          </button>
          <button
            type="button"
            className="fde-icon-button"
            onClick={() => editor.setSidePanel("media")}
            aria-label="Media library"
            title="Media library"
          >
            <ImageIcon size={14} />
          </button>
          <span
            className="fde-dirty"
            data-dirty={isDirty}
            title={isDirty ? "Unsaved changes" : "No changes"}
          />
        </>
      )}
      {editor.error ? (
        <span className="fde-status" data-kind="error" role="alert">
          {editor.error}
          <button
            type="button"
            className="fde-status-dismiss"
            onClick={editor.clearFeedback}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </span>
      ) : null}
      {editor.result ? (
        <span className="fde-status" data-kind="success" role="status">
          {editor.result.message}
          {editor.result.pullRequest?.url ? (
            <>
              {" "}
              <a
                href={editor.result.pullRequest.url}
                target="_blank"
                rel="noreferrer"
              >
                Open pull request
              </a>
            </>
          ) : null}
          <button
            type="button"
            className="fde-status-dismiss"
            onClick={editor.clearFeedback}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </span>
      ) : null}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </span>
  );
}
