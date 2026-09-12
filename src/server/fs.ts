import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  BinaryContentFile,
  ContentFile,
  ContentProvider,
} from "../content/provider";

export function createLocalContentProvider(root: string): ContentProvider {
  const base = path.resolve(root);

  return {
    async read(filePath: string): Promise<ContentFile> {
      const full = resolveInside(base, filePath);
      return { path: filePath, content: await fs.readFile(full, "utf8") };
    },

    async write(filePath: string, content: string): Promise<void> {
      const full = resolveInside(base, filePath);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, "utf8");
    },

    async readBinary(filePath: string): Promise<BinaryContentFile> {
      const full = resolveInside(base, filePath);
      const buffer = await fs.readFile(full);
      return { path: filePath, bytes: new Uint8Array(buffer) };
    },

    async writeBinary(filePath: string, bytes: Uint8Array): Promise<void> {
      const full = resolveInside(base, filePath);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, bytes);
    },

    async delete(filePath: string): Promise<void> {
      const full = resolveInside(base, filePath);
      await fs.rm(full, { force: true });
    },
  };
}

export function resolveInside(base: string, filePath: string): string {
  const full = path.resolve(base, filePath);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error(`Path escapes the content directory: ${filePath}`);
  }
  return full;
}
