export interface MediaConfig {
  /**
   * Directory served at `/`, relative to the project root. Its own name never
   * appears in a URL: `public/logo.png` is served as `/logo.png`.
   *
   * @defaultValue "public"
   */
  publicDir?: string;
  /**
   * Folders inside {@link publicDir} that uploads may target, `""` being its
   * root. An empty list means pages can only use colocated assets.
   *
   * @defaultValue [""]
   */
  publicFolders?: string[];
  /**
   * Maximum upload size in bytes.
   *
   * @defaultValue 10 * 1024 * 1024
   */
  maxSize?: number;
  /**
   * Allowed file extensions (lowercase, with dot).
   */
  types?: string[];
  /**
   * Markdown template used when inserting media.
   * Available placeholders: {alt}, {src}, {name}.
   *
   * @defaultValue "![{alt}]({src})"
   */
  insertTemplate?: string;
}

export interface ResolvedMediaConfig {
  publicDir: string;
  publicFolders: string[];
  maxSize: number;
  types: string[];
  insertTemplate: string;
}

export const DEFAULT_MEDIA_TYPES = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".gif",
  ".svg",
];

export const DEFAULT_MEDIA_MAX_SIZE = 10 * 1024 * 1024;

export function resolveMediaConfig(
  config: MediaConfig | undefined,
): ResolvedMediaConfig {
  return {
    publicDir: config?.publicDir ?? "public",
    publicFolders: config?.publicFolders ?? [""],
    maxSize: config?.maxSize ?? DEFAULT_MEDIA_MAX_SIZE,
    types: config?.types ?? DEFAULT_MEDIA_TYPES,
    insertTemplate: config?.insertTemplate ?? "![{alt}]({src})",
  };
}

export type MediaBase = "content" | "public";

export interface MediaFileInput {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface MediaUploadResult {
  base: MediaBase;
  path: string;
  src: string;
  name: string;
}
