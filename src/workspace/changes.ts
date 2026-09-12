import type { ContentModel } from "../content/model";
import { isPageFile } from "../content/model";
import type { MetaData, WorkspaceChange } from "../meta/types";

export function isMetaPath(path: string): boolean {
  return path === "meta.json" || path.endsWith("/meta.json");
}

export function isPublicChange(change: WorkspaceChange): boolean {
  return "base" in change && change.base === "public";
}

export function applyChanges(
  model: ContentModel,
  changes: WorkspaceChange[],
): ContentModel {
  const files = new Set(model.files);
  const metas: Record<string, MetaData> = { ...model.metas };
  const titles: Record<string, string> = { ...model.titles };
  const icons: Record<string, string> = { ...model.icons };
  const media = new Set(model.media);

  for (const change of changes) {
    if (isPublicChange(change)) continue;

    switch (change.type) {
      case "create":
      case "update": {
        if (isMetaPath(change.path)) {
          try {
            metas[change.path] = JSON.parse(change.content) as MetaData;
          } catch {
            metas[change.path] = {};
          }
        } else if (change.encoding === "base64") {
          media.add(change.path);
        } else if (isPageFile(change.path)) {
          files.add(change.path);
          const title = frontmatterField(change.content, "title");
          if (title) titles[change.path] = title;
          const icon = frontmatterField(change.content, "icon");
          if (icon) icons[change.path] = icon;
          else delete icons[change.path];
        }
        break;
      }
      case "delete": {
        if (isMetaPath(change.path)) {
          delete metas[change.path];
        } else {
          files.delete(change.path);
          media.delete(change.path);
          delete titles[change.path];
          delete icons[change.path];
        }
        break;
      }
      case "move": {
        if (isMetaPath(change.from)) {
          metas[change.to] = metas[change.from] ?? {};
          delete metas[change.from];
        } else if (media.has(change.from)) {
          media.delete(change.from);
          media.add(change.to);
        } else {
          files.delete(change.from);
          files.add(change.to);
          if (titles[change.from] !== undefined) {
            titles[change.to] = titles[change.from] as string;
            delete titles[change.from];
          }
          if (icons[change.from] !== undefined) {
            icons[change.to] = icons[change.from] as string;
            delete icons[change.from];
          }
        }
        break;
      }
    }
  }

  return {
    files: [...files],
    metas,
    titles: Object.keys(titles).length > 0 ? titles : undefined,
    icons: Object.keys(icons).length > 0 ? icons : undefined,
    media: [...media],
  };
}

function frontmatterField(source: string, field: string): string | undefined {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!block) return undefined;
  const line = new RegExp(`^${field}:\\s*(.+)$`, "m").exec(block[1] ?? "");
  if (!line?.[1]) return undefined;
  return line[1].trim().replace(/^["']|["']$/g, "");
}

export function statusesFromChanges(
  changes: WorkspaceChange[],
): Record<string, "new" | "modified" | "deleted" | "renamed"> {
  const statuses: Record<string, "new" | "modified" | "deleted" | "renamed"> =
    {};

  for (const change of changes) {
    switch (change.type) {
      case "create":
        statuses[change.path] = "new";
        break;
      case "update":
        statuses[change.path] = statuses[change.path] ?? "modified";
        break;
      case "delete":
        statuses[change.path] = "deleted";
        break;
      case "move":
        delete statuses[change.from];
        statuses[change.to] = "renamed";
        break;
    }
  }

  return statuses;
}

/**
 * Drop pending changes that cancel each other out: deleting a file that was
 * created in this session (directly, or under a name it was later moved from)
 * leaves nothing for the repository to do, so neither change is recorded.
 */
export function collapseChanges(changes: WorkspaceChange[]): WorkspaceChange[] {
  const result: WorkspaceChange[] = [];

  for (const change of changes) {
    if (change.type !== "delete") {
      result.push(change);
      continue;
    }

    // Walk backwards so moves lead to the name the file first appeared under.
    const paths = new Set([change.path]);
    const kept: WorkspaceChange[] = [];
    let created = false;

    for (let index = result.length - 1; index >= 0; index -= 1) {
      const existing = result[index] as WorkspaceChange;
      const target = existing.type === "move" ? existing.to : existing.path;
      if (!paths.has(target)) {
        kept.unshift(existing);
        continue;
      }
      if (existing.type === "move") paths.add(existing.from);
      if (existing.type === "create") created = true;
    }

    result.length = 0;
    result.push(...kept);
    if (created) continue;

    // The file is in the repository, under whichever name it started with.
    const origin = [...paths].pop() ?? change.path;
    result.push(origin === change.path ? change : { ...change, path: origin });
  }

  return result;
}

export function retargetChanges(
  changes: WorkspaceChange[],
  moves: Array<{ from: string; to: string }>,
): WorkspaceChange[] {
  if (moves.length === 0) return changes;

  const resolve = (path: string): string => {
    let current = path;
    const visited = new Set<string>();
    let moved = true;

    while (moved && !visited.has(current)) {
      moved = false;
      visited.add(current);
      for (const move of moves) {
        if (move.from === current) {
          current = move.to;
          moved = true;
          break;
        }
      }
    }

    return current;
  };

  return changes.map((change) => {
    if (change.type === "move") return change;
    const next = resolve(change.path);
    return next === change.path ? change : { ...change, path: next };
  });
}
