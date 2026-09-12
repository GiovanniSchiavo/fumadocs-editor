"use client";

import { Link } from "fumadocs-core/framework";
import {
  Archive,
  ArchiveRestore,
  CloudUpload,
  GitCommitHorizontal,
  Loader2,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isPageFile } from "../content/model";
import { mediaDisplayPath } from "../media/paths";
import { isMetaPath } from "../workspace/changes";
import { useEditorWorkspace } from "../workspace/context";
import type { NodeStatus } from "../workspace/types";
import { useFumadocsEditor } from "./context";
import { diffLines, diffStats } from "./diff";
import { useEditorAuth } from "./use-auth";

interface ChangeRow {
  path: string;
  displayPath: string;
  status: NodeStatus;
}

interface DiffCount {
  added: number;
  removed: number;
}

export function GitPanel() {
  const editor = useFumadocsEditor();
  const workspace = useEditorWorkspace();
  const auth = useEditorAuth(editor.apiBase);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const map = new Map<string, ChangeRow>();
    for (const change of workspace.changes) {
      const path = change.type === "move" ? change.to : change.path;
      const base =
        "base" in change && change.base === "public" ? "public" : "content";
      const status: NodeStatus =
        change.type === "move"
          ? "renamed"
          : change.type === "delete"
            ? "deleted"
            : change.type === "create"
              ? "new"
              : "modified";
      map.set(path, {
        path,
        displayPath: mediaDisplayPath(
          base,
          path,
          workspace.mediaConfig.publicDir,
        ),
        status,
      });
    }
    return [...map.values()].sort((a, b) =>
      a.displayPath.localeCompare(b.displayPath),
    );
  }, [workspace.changes]);

  // ponytail: line stats are recomputed for every changed page whenever the
  // change set moves; diffLines caps at 4000 lines a side, swap in a real diff
  // library if that ever shows up in a profile.
  const [counts, setCounts] = useState<Record<string, DiffCount>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const next: Record<string, DiffCount> = {};
      for (const row of rows) {
        if (!isPageFile(row.path) && !isMetaPath(row.path)) continue;
        const [before, after] = await Promise.all([
          workspace.getOriginal(row.path).catch(() => ""),
          row.status === "deleted"
            ? Promise.resolve("")
            : workspace.getFile(row.path).catch(() => ""),
        ]);
        next[row.path] = diffStats(diffLines(before, after));
      }
      if (!cancelled) setCounts(next);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [rows, workspace.getFile, workspace.getOriginal]);

  const total = useMemo(
    () =>
      Object.values(counts).reduce(
        (sum, count) => ({
          added: sum.added + count.added,
          removed: sum.removed + count.removed,
        }),
        { added: 0, removed: 0 },
      ),
    [counts],
  );

  /** Text files still present can be inspected; binaries and deletes cannot. */
  function canOpen(row: ChangeRow) {
    return (
      row.status !== "deleted" && (isPageFile(row.path) || isMetaPath(row.path))
    );
  }

  const stagedSet = new Set(workspace.staged);
  const unstaged = rows.filter((row) => !stagedSet.has(row.path));
  const staged = rows.filter((row) => stagedSet.has(row.path));
  const unpushed = workspace.commits.filter((commit) => !commit.pushed);

  async function onCommit() {
    if (!message.trim()) return;
    setBusy(true);
    workspace.commitAll(message.trim());
    setMessage("");
    setBusy(false);
  }

  async function onPush() {
    setBusy(true);
    await workspace.push();
    setBusy(false);
  }

  return (
    <div className="fde-git">
      <div className="fde-panel-title">
        <strong>Review changes</strong>
        <DiffCounts count={total} />
        <button type="button" onClick={() => editor.setSidePanel("pages")}>
          Close
        </button>
      </div>

      <div className="fde-git-status">
        {auth.user ? (
          <>
            <span className="fde-git-branch">
              fumadocs-editor/{auth.user.login}
            </span>
            {auth.canWrite ? null : auth.canPropose ? (
              <span className="fde-git-note">
                Pushes go to your fork and open a pull request
              </span>
            ) : (
              <span className="fde-git-warning">
                No write access to the repository
              </span>
            )}
          </>
        ) : (
          <button
            type="button"
            className="fde-button"
            onClick={auth.signIn}
            disabled={!auth.configured}
          >
            {auth.configured ? "Sign in with GitHub" : "GitHub not configured"}
          </button>
        )}
      </div>

      <ChangeGroup
        title="Changes"
        rows={unstaged}
        counts={counts}
        empty="No changes"
        actionLabel="Stage"
        onAction={(paths) => workspace.stage(paths)}
        onDiscard={(paths) => workspace.discard(paths)}
        canOpen={canOpen}
      />
      <ChangeGroup
        title="Staged Changes"
        rows={staged}
        counts={counts}
        empty="Nothing staged"
        actionLabel="Unstage"
        onAction={(paths) => workspace.unstage(paths)}
        onDiscard={(paths) => workspace.discard(paths)}
        canOpen={canOpen}
      />

      <div className="fde-git-commit">
        <textarea
          className="fde-input fde-git-message"
          placeholder="Commit message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
        />
        <button
          type="button"
          className="fde-button fde-button-primary"
          onClick={() => void onCommit()}
          disabled={busy || !message.trim() || rows.length === 0}
        >
          <GitCommitHorizontal size={14} />
          Commit
        </button>
      </div>

      <div className="fde-git-actions">
        <button
          type="button"
          className="fde-button"
          onClick={() => void onPush()}
          disabled={
            busy ||
            workspace.pushing ||
            unpushed.length === 0 ||
            !auth.user ||
            !auth.canPropose
          }
        >
          {workspace.pushing ? (
            <Loader2 size={14} className="fde-spin" />
          ) : (
            <CloudUpload size={14} />
          )}
          Push {unpushed.length > 0 ? `(${unpushed.length})` : ""}
        </button>
        <button
          type="button"
          className="fde-button"
          onClick={() => workspace.stashChanges()}
          disabled={workspace.changes.length === 0}
        >
          <Archive size={14} />
          Stash
        </button>
      </div>

      {workspace.lastPush ? (
        <div className="fde-git-result">
          Pushed to <code>{workspace.lastPush.branch}</code>
          {workspace.lastPush.prUrl ? (
            <>
              {" — "}
              <a
                href={workspace.lastPush.prUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open pull request
              </a>
            </>
          ) : null}
        </div>
      ) : null}

      {workspace.stashes.length > 0 ? (
        <div className="fde-git-group">
          <p className="fde-git-title">Stashes</p>
          {workspace.stashes.map((stash) => (
            <div className="fde-git-row" key={stash.id}>
              <span className="fde-git-path">{stash.label}</span>
              <button
                type="button"
                className="fde-icon-button"
                title="Pop stash"
                onClick={() => workspace.stashPop(stash.id)}
              >
                <ArchiveRestore size={12} />
              </button>
              <button
                type="button"
                className="fde-icon-button"
                title="Drop stash"
                onClick={() => workspace.stashDrop(stash.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DiffCounts({ count }: { count: DiffCount }) {
  if (count.added === 0 && count.removed === 0) return null;
  return (
    <span
      className="fde-diff-counts"
      title={`${count.added} added, ${count.removed} removed`}
    >
      <span className="fde-diff-added">+{count.added}</span>
      <span className="fde-diff-removed">−{count.removed}</span>
    </span>
  );
}

function sumCounts(rows: ChangeRow[], counts: Record<string, DiffCount>) {
  return rows.reduce(
    (sum, row) => ({
      added: sum.added + (counts[row.path]?.added ?? 0),
      removed: sum.removed + (counts[row.path]?.removed ?? 0),
    }),
    { added: 0, removed: 0 },
  );
}

function ChangeGroup({
  title,
  rows,
  counts,
  empty,
  actionLabel,
  onAction,
  onDiscard,
  canOpen,
}: {
  title: string;
  rows: ChangeRow[];
  counts: Record<string, DiffCount>;
  empty: string;
  actionLabel: string;
  onAction: (paths: string[]) => void;
  onDiscard: (paths: string[]) => void;
  canOpen: (row: ChangeRow) => boolean;
}) {
  const editor = useFumadocsEditor();
  return (
    <div className="fde-git-group">
      <p className="fde-git-title">
        {title}
        <span className="fde-git-count">{rows.length}</span>
        <DiffCounts count={sumCounts(rows, counts)} />
      </p>
      {rows.length === 0 ? (
        <p className="fde-git-empty">{empty}</p>
      ) : (
        rows.map((row) => (
          <div className="fde-git-row" key={row.path}>
            <span className="fde-git-badge" data-status={row.status}>
              {statusLetter(row.status)}
            </span>
            {canOpen(row) ? (
              <Link
                className="fde-git-path fde-git-open"
                href={editor.editorHref(row.path)}
                title={`Open ${row.displayPath} in diff view`}
                onClick={() => editor.setMode("diff")}
              >
                {row.displayPath}
              </Link>
            ) : (
              <span className="fde-git-path" title={row.displayPath}>
                {row.displayPath}
              </span>
            )}
            <DiffCounts count={counts[row.path] ?? { added: 0, removed: 0 }} />
            <button
              type="button"
              className="fde-git-action"
              title={actionLabel}
              onClick={() => onAction([row.path])}
            >
              {actionLabel === "Stage" ? "+" : "−"}
            </button>
            <button
              type="button"
              className="fde-git-action"
              title="Discard changes"
              onClick={() => onDiscard([row.path])}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function statusLetter(status: NodeStatus): string {
  switch (status) {
    case "new":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "modified":
      return "M";
    default:
      return "·";
  }
}
