import type { ContentModel } from "../content/model";
import type { MetaMutation, WorkspaceChange } from "../meta/types";

export type NodeStatus = "clean" | "new" | "modified" | "deleted" | "renamed";

export interface StashEntry {
  id: string;
  label: string;
  createdAt: string;
  changes: WorkspaceChange[];
  staged: string[];
}

export interface VirtualCommit {
  id: string;
  message: string;
  createdAt: string;
  changes: WorkspaceChange[];
  pushed?: {
    branch: string;
    prUrl?: string;
  };
}

export interface PushResult {
  branch: string;
  prUrl?: string;
  /** The branch went to the user's fork rather than the upstream repository. */
  forked?: boolean;
}

export interface WorkspaceSnapshot {
  changes: WorkspaceChange[];
  staged: string[];
  stashes: StashEntry[];
  commits: VirtualCommit[];
}

export interface WorkspaceBackend {
  getTree(): Promise<ContentModel>;
  getFile(path: string): Promise<string>;
  readBinary?(input: {
    base: "content" | "public";
    path: string;
  }): Promise<{ base64: string; mime: string }>;
  listMedia?(): Promise<{ content: string[]; public: string[] }>;
  push(input: {
    commits: VirtualCommit[];
    title: string;
    body?: string;
  }): Promise<PushResult>;
}

export type { ContentModel, MetaMutation, WorkspaceChange };
