import type { MediaBase } from "../media/types";

export interface MetaData {
  title?: string;
  description?: string;
  icon?: string;
  root?: boolean | string;
  defaultOpen?: boolean;
  collapsible?: boolean;
  pagesIndex?: string;
  pages?: string[];
  [key: string]: unknown;
}

export type WorkspaceChange =
  | {
      type: "create";
      path: string;
      content: string;
      encoding?: "base64";
      base?: MediaBase;
    }
  | {
      type: "update";
      path: string;
      content: string;
      encoding?: "base64";
      base?: MediaBase;
    }
  | { type: "delete"; path: string; base?: MediaBase }
  | { type: "move"; from: string; to: string; base?: MediaBase };

export type MetaMutation =
  | {
      type: "createPage";
      folder: string;
      name: string;
      title?: string;
      icon?: string;
      content?: string;
      format?: "md" | "mdx";
    }
  | {
      type: "createFolder";
      parent: string;
      name: string;
      title?: string;
      icon?: string;
      withIndex?: boolean;
    }
  | { type: "deleteNode"; id: string }
  | { type: "renameNode"; id: string; name: string }
  | {
      type: "moveNode";
      id: string;
      targetFolder: string;
      beforeId?: string | null;
    }
  | { type: "setMeta"; metaPath: string; patch: Record<string, unknown> }
  | { type: "setIcon"; id: string; icon?: string }
  | { type: "setOrder"; metaPath: string; pages: string[] }
  | {
      type: "addSeparator";
      folder: string;
      name: string;
      icon?: string;
      beforeId?: string | null;
    }
  | {
      type: "addLink";
      folder: string;
      name: string;
      url: string;
      external?: boolean;
      beforeId?: string | null;
    };

export class MetaOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaOperationError";
  }
}
