"use client";

import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { ImagePlus, Upload } from "lucide-react";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { pageFormat } from "../content/model";
import { createEditorExtensions, type EditorCallbacks } from "./codemirror";
import type { MdxComponentHint } from "./completions";

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  path: string;
  onUndo?: () => void;
  onRedo?: () => void;
  onFormat?: () => void;
  onFiles?: (files: File[]) => Promise<string[] | undefined>;
  onSelectionChange?: (offset: number) => void;
  lint?: boolean;
  componentHints?: MdxComponentHint[];
}

export function MarkdownEditor({
  value,
  onChange,
  path,
  onUndo,
  onRedo,
  onFormat,
  onFiles,
  onSelectionChange,
  lint,
  componentHints,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacksRef = useRef<EditorCallbacks>({
    onChange,
    onUndo: onUndo ?? noop,
    onRedo: onRedo ?? noop,
    onFormat,
  });
  const filesRef = useRef(onFiles);
  const selectionRef = useRef(onSelectionChange);
  const dragDepthRef = useRef(0);
  const [draggingFiles, setDraggingFiles] = useState(false);

  callbacksRef.current = {
    onChange,
    onUndo: onUndo ?? noop,
    onRedo: onRedo ?? noop,
    onFormat,
  };
  filesRef.current = onFiles;
  selectionRef.current = onSelectionChange;

  const initialValueRef = useRef(value);
  const initialPathRef = useRef(path);
  const lintRef = useRef(lint);
  const hintsRef = useRef(componentHints);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleFiles(
      files: FileList | null | undefined,
      view: EditorView,
      position: number,
    ): boolean {
      const list = files ? [...files] : [];
      if (list.length === 0 || !filesRef.current) return false;

      void filesRef.current(list).then((snippets) => {
        if (!snippets || snippets.length === 0) return;
        const insert = snippets.join("\n\n");
        view.dispatch({
          changes: { from: position, insert },
          selection: EditorSelection.cursor(position + insert.length),
          userEvent: "input",
        });
      });

      return true;
    }

    const view = new EditorView({
      doc: initialValueRef.current,
      extensions: [
        ...createEditorExtensions({
          callbacks: () => callbacksRef.current,
          lint: lintRef.current,
          format: pageFormat(initialPathRef.current),
          componentHints: hintsRef.current,
          label: `Edit ${initialPathRef.current}`,
        }),
        EditorView.domEventHandlers({
          paste: (event, editor) => {
            return handleFiles(
              event.clipboardData?.files,
              editor,
              editor.state.selection.main.head,
            );
          },
          drop: (event, editor) => {
            dragDepthRef.current = 0;
            setDraggingFiles(false);
            const position =
              editor.posAtCoords({ x: event.clientX, y: event.clientY }) ??
              editor.state.selection.main.head;
            return handleFiles(event.dataTransfer?.files, editor, position);
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.selectionSet || update.docChanged) {
            selectionRef.current?.(update.state.selection.main.head);
          }
        }),
      ],
      parent: container,
    });
    viewRef.current = view;
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current === value) return;

    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  function onDragEnter(event: DragEvent) {
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepthRef.current += 1;
    setDraggingFiles(true);
  }

  function onDragLeave(event: DragEvent) {
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDraggingFiles(false);
  }

  return (
    <div
      className="fde-editor-shell"
      data-dragging={draggingFiles}
      role="application"
      aria-label={`Markdown editor for ${path}`}
      onDragEnter={onDragEnter}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDragLeave={onDragLeave}
      onDrop={() => {
        dragDepthRef.current = 0;
        setDraggingFiles(false);
      }}
    >
      <div ref={containerRef} className="fde-editor" data-path={path} />
      {draggingFiles ? (
        <div className="fde-editor-drop-overlay" aria-live="polite">
          <span className="fde-editor-drop-icon">
            <ImagePlus size={24} />
            <Upload size={13} />
          </span>
          <strong>Drop images to upload and insert</strong>
          <span>They’ll be added at your cursor position.</span>
        </div>
      ) : null}
    </div>
  );
}

function noop() {}
