import { baseName, joinPath, parentFolder } from "../content/model";
import type { MediaBase, ResolvedMediaConfig } from "./types";

export function mediaExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index).toLowerCase();
}

export function isMediaFile(path: string, types: string[]): boolean {
  return types.includes(mediaExtension(baseName(path)));
}

export function mimeForMedia(path: string): string {
  switch (mediaExtension(baseName(path))) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".avif":
      return "image/avif";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

export function sanitizeMediaName(name: string): string {
  const file = baseName(name);
  const extension = mediaExtension(file);
  const stem = file
    .slice(0, file.length - extension.length)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");

  return `${stem || "media"}${extension}`;
}

export function uniqueMediaName(existing: Set<string>, name: string): string {
  if (!existing.has(name)) return name;

  const extension = mediaExtension(name);
  const stem = name.slice(0, name.length - extension.length);
  let counter = 1;

  while (existing.has(`${stem}-${counter}${extension}`)) {
    counter += 1;
  }

  return `${stem}-${counter}${extension}`;
}

export function contentMediaPath(pagePath: string, name: string): string {
  return joinPath(parentFolder(pagePath), name);
}

export function publicMediaPath(
  config: ResolvedMediaConfig,
  name: string,
  folder?: string,
): string {
  // The destination can be typed by hand, so keep it inside the public
  // directory: leading slashes are dropped and `..` cannot escape.
  return joinPath(normalizePath(folder ?? config.publicFolders[0] ?? ""), name);
}

function normalizePath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}

export function relativeMediaSrc(pagePath: string, mediaPath: string): string {
  const from = parentFolder(pagePath).split("/").filter(Boolean);
  const to = normalizePath(mediaPath).split("/").filter(Boolean);
  const name = to.pop();
  if (!name) return mediaPath;

  let common = 0;
  while (
    common < from.length &&
    common < to.length &&
    from[common] === to[common]
  ) {
    common += 1;
  }

  const up = from.length - common;
  const parts = [
    ...Array.from({ length: up }, () => ".."),
    ...to.slice(common),
    name,
  ];
  const relative = parts.join("/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

/**
 * The URL a public asset is served at. Paths are stored relative to the public
 * directory, which the framework serves at `/` — its name is not part of the URL.
 */
export function publicMediaSrc(
  _config: ResolvedMediaConfig,
  mediaPath: string,
): string {
  return `/${normalizePath(mediaPath)}`;
}

export function renderMediaTemplate(
  template: string,
  input: { alt: string; src: string; name: string },
): string {
  return template
    .replaceAll("{alt}", input.alt.replaceAll("]", ""))
    .replaceAll("{src}", input.src)
    .replaceAll("{name}", input.name);
}

export interface RelativeMediaReference {
  raw: string;
  path: string;
}

const MARKDOWN_IMAGE = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HTML_IMAGE = /(<img\b[^>]*?\bsrc=)(?:"([^"]+)"|'([^']+)')/g;

export function collectRelativeMedia(
  source: string,
  pagePath: string,
): RelativeMediaReference[] {
  const references = new Map<string, RelativeMediaReference>();

  const collect = (src: string) => {
    if (!isRelativeSrc(src)) return;
    const resolved = normalizePath(joinPath(parentFolder(pagePath), src));
    references.set(src, { raw: src, path: resolved });
  };

  for (const match of source.matchAll(MARKDOWN_IMAGE)) {
    if (match[1]) collect(match[1]);
  }
  for (const match of source.matchAll(HTML_IMAGE)) {
    const src = match[2] ?? match[3];
    if (src) collect(src);
  }

  return [...references.values()];
}

export function isRelativeSrc(src: string): boolean {
  if (src.startsWith("/") || src.startsWith("#")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return false;
  return src.startsWith("./") || src.startsWith("../") || !src.includes("://");
}

export function rewriteRelativeMedia(
  source: string,
  pagePath: string,
  resolve: (mediaPath: string) => string | null,
): string {
  const rewrite = (src: string): string => {
    if (!isRelativeSrc(src)) return src;
    const mediaPath = normalizePath(joinPath(parentFolder(pagePath), src));
    return resolve(mediaPath) ?? src;
  };

  return source
    .replace(MARKDOWN_IMAGE, (match, src: string) => {
      if (!src) return match;
      return match.replace(src, rewrite(src));
    })
    .replace(
      HTML_IMAGE,
      (match, prefix: string, double: string, single: string) => {
        const src = double ?? single;
        if (!src || !isRelativeSrc(src)) return match;
        const quote = double ? '"' : "'";
        return `${prefix}${quote}${rewrite(src)}${quote}`;
      },
    );
}

/** Where the file lives on disk, for labels — not the URL it is served at. */
export function mediaDisplayPath(
  base: MediaBase,
  path: string,
  publicDir = "public",
): string {
  return base === "public" ? joinPath(publicDir, path) : path;
}
