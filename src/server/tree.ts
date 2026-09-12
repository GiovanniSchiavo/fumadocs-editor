import { type Dirent, promises as fs } from "node:fs";
import path from "node:path";
import { type ContentModel, isPageFile } from "../content/model";
import { isMediaFile } from "../media/paths";
import { DEFAULT_MEDIA_TYPES } from "../media/types";
import type { MetaData } from "../meta/types";
import type { GitProvider } from "../types";

export async function readLocalModel(root: string): Promise<ContentModel> {
  const files: string[] = [];
  const metas: Record<string, MetaData> = {};
  const titles: Record<string, string> = {};
  const icons: Record<string, string> = {};
  const media: string[] = [];

  async function walk(directory: string, prefix: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await walk(full, relative);
        continue;
      }

      if (entry.name === "meta.json") {
        try {
          metas[relative] = JSON.parse(
            await fs.readFile(full, "utf8"),
          ) as MetaData;
        } catch {
          metas[relative] = {};
        }
        continue;
      }

      if (isPageFile(relative)) {
        files.push(relative);
        try {
          const content = await fs.readFile(full, "utf8");
          const title = frontmatterField(content, "title");
          if (title) titles[relative] = title;
          const icon = frontmatterField(content, "icon");
          if (icon) icons[relative] = icon;
        } catch {
          // ignore unreadable files
        }
        continue;
      }

      if (isMediaFile(relative, DEFAULT_MEDIA_TYPES)) {
        media.push(relative);
      }
    }
  }

  await walk(root, "");
  return { files, metas, titles, icons, media };
}

export async function readGitHubModel(
  provider: GitProvider,
  contentDir: string,
): Promise<ContentModel> {
  const tree = await provider.getTree();
  const prefix = contentDir ? `${contentDir.replace(/\/+$/, "")}/` : "";

  const files: string[] = [];
  const metas: Record<string, MetaData> = {};
  const media: string[] = [];

  for (const entry of tree) {
    if (entry.type !== "blob" || !entry.path.startsWith(prefix)) continue;
    const relative = entry.path.slice(prefix.length);
    if (!relative) continue;

    if (relative.endsWith("meta.json")) {
      try {
        metas[relative] = JSON.parse(
          await provider.getFile(entry.path),
        ) as MetaData;
      } catch {
        metas[relative] = {};
      }
    } else if (isPageFile(relative)) {
      files.push(relative);
    } else if (isMediaFile(relative, DEFAULT_MEDIA_TYPES)) {
      media.push(relative);
    }
  }

  return { files, metas, media };
}

export async function readLocalPublicMedia(
  publicDir: string,
): Promise<string[]> {
  const media: string[] = [];

  async function walk(directory: string, prefix: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(directory, entry.name), relative);
      } else if (isMediaFile(relative, DEFAULT_MEDIA_TYPES)) {
        media.push(relative);
      }
    }
  }

  await walk(publicDir, "");
  return media.sort();
}

export async function readGitHubPublicMedia(
  provider: GitProvider,
  publicDir: string,
): Promise<string[]> {
  const tree = await provider.getTree();
  const prefix = publicDir ? `${publicDir.replace(/\/+$/, "")}/` : "";

  return tree
    .filter((entry) => entry.type === "blob" && entry.path.startsWith(prefix))
    .map((entry) => entry.path.slice(prefix.length))
    .filter((relative) => isMediaFile(relative, DEFAULT_MEDIA_TYPES))
    .sort();
}

function frontmatterField(source: string, field: string): string | undefined {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!block) return undefined;
  const line = new RegExp(`^${field}:\\s*(.+)$`, "m").exec(block[1] ?? "");
  if (!line?.[1]) return undefined;
  return line[1].trim().replace(/^["']|["']$/g, "");
}
