"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useEditorWorkspace } from "../workspace/context";
import { useFumadocsEditor } from "./context";
import { diffLines, diffStats } from "./diff";

export function DiffPanel() {
  const { document } = useFumadocsEditor();
  const workspace = useEditorWorkspace();
  const path = document?.path;

  // Against the repository, not against the state the file was opened in: this
  // is the change that will be pushed, and what the review panel counts.
  const [committed, setCommitted] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setCommitted(null);
    void workspace
      .getOriginal(path)
      .catch(() => "")
      .then((source) => {
        if (!cancelled) setCommitted(source);
      });
    return () => {
      cancelled = true;
    };
  }, [path, workspace.getOriginal]);

  const lines = useMemo(
    () =>
      document && committed !== null
        ? diffLines(committed, document.current)
        : [],
    [committed, document],
  );
  const stats = useMemo(() => diffStats(lines), [lines]);

  if (!document) return null;
  if (committed === null) {
    return <div className="fde-diff-empty">Loading diff…</div>;
  }

  if (stats.added === 0 && stats.removed === 0) {
    return <div className="fde-diff-empty">No changes yet.</div>;
  }

  const rendered: ReactNode[] = [];
  let oldLine = 1;
  let newLine = 1;

  lines.forEach((line) => {
    let number = "";
    let sign = " ";

    if (line.type === "context") {
      number = String(oldLine);
      oldLine += 1;
      newLine += 1;
    } else if (line.type === "remove") {
      number = String(oldLine);
      sign = "-";
      oldLine += 1;
    } else {
      number = String(newLine);
      sign = "+";
      newLine += 1;
    }

    rendered.push(
      <div
        className="fde-diff-line"
        data-type={line.type}
        key={`${line.type}:${oldLine}:${newLine}`}
      >
        <span className="fde-diff-gutter">
          {sign}
          {number}
        </span>
        <span className="fde-diff-value">{line.value || " "}</span>
      </div>,
    );
  });

  return (
    <div className="fde-diff">
      <div className="fde-diff-summary">
        <span className="fde-diff-added">+{stats.added}</span>
        <span className="fde-diff-removed">−{stats.removed}</span>
      </div>
      {rendered}
    </div>
  );
}
