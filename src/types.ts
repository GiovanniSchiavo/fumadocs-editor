export type GitProviderKind = "github" | "gitlab" | "local";

export interface FormatInput {
  source: string;
  path: string;
}

export type EditorFormatter = (input: FormatInput) => string | Promise<string>;

export interface RepositorySession {
  provider: GitProviderKind;
  owner: string;
  repo: string;
  baseBranch: string;
  baseCommitSHA?: string;
  contentDir: string;
  /**
   * Path of the public directory inside the repository, when it differs from
   * the local one — a monorepo app has `apps/docs/public` in the repository
   * but `public` on disk. Defaults to the local `media.publicDir`.
   */
  publicDir?: string;
}

export type Change =
  | {
      type: "update";
      path: string;
      content: string;
      encoding?: "base64";
    }
  | {
      type: "create";
      path: string;
      content: string;
      encoding?: "base64";
    }
  | { type: "delete"; path: string }
  | { type: "move"; from: string; to: string };

export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  sha: string;
}

export interface Permissions {
  read: boolean;
  write: boolean;
  admin: boolean;
}

export interface PullRequest {
  number: number;
  url: string;
  title: string;
}

export interface CommitResult {
  sha: string;
  branch: string;
}

export interface GitProvider {
  getFile(path: string): Promise<string>;
  getFileBinary?(path: string): Promise<string>;
  getTree(): Promise<TreeEntry[]>;
  getPermissions(): Promise<Permissions>;
  createBranch(name: string): Promise<void>;
  commitChanges(
    changes: Change[],
    input?: { message?: string },
  ): Promise<CommitResult>;
  createPullRequest(input: {
    title: string;
    body?: string;
    head?: string;
    base?: string;
  }): Promise<PullRequest>;
  getDiff(base?: string, head?: string): Promise<string>;
}
