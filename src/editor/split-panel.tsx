"use client";

import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFumadocsEditor } from "./context";
import { MarkdownEditor } from "./markdown-editor";
import { PreviewPanel } from "./preview-panel";
import { useMediaFileHandler } from "./use-media-files";

const MIN_RATIO = 20;
const MAX_RATIO = 80;

export function SplitPanel() {
  const {
    document,
    update,
    undo,
    redo,
    format,
    canFormat,
    lint,
    componentHints,
    splitRatio,
    setSplitRatio,
    setCursorOffset,
  } = useFumadocsEditor();
  const handleFiles = useMediaFileHandler();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;

    function onMove(event: PointerEvent) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;

      const ratio = ((event.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio)));
    }

    function stopDragging() {
      setDragging(false);
    }

    const body = window.document.body;
    const previousUserSelect = body.style.userSelect;
    body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [dragging, setSplitRatio]);

  if (!document) return null;

  function onHandleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setSplitRatio(Math.max(MIN_RATIO, splitRatio - 2));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setSplitRatio(Math.min(MAX_RATIO, splitRatio + 2));
    }
  }

  return (
    <div className="fde-split" ref={containerRef} data-dragging={dragging}>
      <div className="fde-split-pane" style={{ width: `${splitRatio}%` }}>
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
      </div>
      <hr
        className="fde-split-handle"
        aria-orientation="vertical"
        aria-label="Resize editor and preview"
        aria-valuenow={Math.round(splitRatio)}
        aria-valuemin={MIN_RATIO}
        aria-valuemax={MAX_RATIO}
        tabIndex={0}
        onPointerDown={(event: ReactPointerEvent<HTMLHRElement>) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDoubleClick={() => setSplitRatio(50)}
        onKeyDown={onHandleKeyDown}
      />
      <div className="fde-split-pane fde-split-pane-last">
        <PreviewPanel />
      </div>
    </div>
  );
}
