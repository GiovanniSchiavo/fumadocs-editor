import type {
  Change,
  CommitResult,
  GitProvider,
  Permissions,
  PullRequest,
  TreeEntry,
} from "../types";

const API_VERSION = "2022-11-28";
const DEFAULT_API_BASE_URL = "https://api.github.com";
// Forking is asynchronous: GitHub 404s the new repository until it lands.
const FORK_POLL_ATTEMPTS = 10;
const FORK_POLL_INTERVAL_MS = 1000;

export interface GitHubProviderOptions {
  owner: string;
  repo: string;
  baseBranch?: string;
  token: string | (() => string | Promise<string>);
  apiBaseUrl?: string;
}

export class GitHubError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

interface GitRef {
  object: { sha: string };
}

interface GitCommit {
  tree: { sha: string };
}

interface GitTree {
  tree: Array<{ path: string; type: string; sha: string }>;
}

interface TreeEntryInput {
  path: string;
  mode: "100644";
  type: "blob";
  sha: string | null;
}

export class GitHubProvider implements GitProvider {
  readonly owner: string;
  readonly repo: string;
  readonly baseBranch: string;

  private readonly token: GitHubProviderOptions["token"];
  private readonly apiBaseUrl: string;
  private branch: string | null = null;
  private forkOwner: string | null = null;
  private baseCommitSHA: string | null = null;
  private baseTreeSHA: string | null = null;

  constructor(options: GitHubProviderOptions) {
    this.owner = options.owner;
    this.repo = options.repo;
    this.baseBranch = options.baseBranch ?? "main";
    this.token = options.token;
    this.apiBaseUrl = (options.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(
      /\/$/,
      "",
    );
  }

  get workingBranch(): string {
    return this.branch ?? this.baseBranch;
  }

  /** Owner of the repository that receives commits — the fork, once forked. */
  get writeOwner(): string {
    return this.forkOwner ?? this.owner;
  }

  get isFork(): boolean {
    return this.forkOwner !== null;
  }

  /**
   * Write commits to `login`'s fork instead of the upstream repository,
   * creating the fork when it does not exist yet. Pull requests still target
   * upstream, so a contributor without push access can propose changes.
   */
  async forkTo(login: string): Promise<void> {
    if (login === this.owner) return;
    await this.ensureFork(login);
    this.forkOwner = login;
  }

  private async ensureFork(login: string): Promise<void> {
    const fork = `/repos/${login}/${this.repo}`;
    if (await this.exists(fork)) return;

    await this.json(this.repoPath("/forks"), { method: "POST" });

    for (let attempt = 0; attempt < FORK_POLL_ATTEMPTS; attempt += 1) {
      await delay(FORK_POLL_INTERVAL_MS);
      if (await this.exists(fork)) return;
    }

    throw new GitHubError(
      `Timed out waiting for GitHub to create ${login}/${this.repo}.`,
      504,
    );
  }

  private async exists(pathname: string): Promise<boolean> {
    try {
      await this.json(pathname);
      return true;
    } catch (error) {
      if (error instanceof GitHubError && error.status === 404) return false;
      throw error;
    }
  }

  async getFile(filePath: string): Promise<string> {
    const response = await this.request(
      this.writePath(
        `/contents/${encodePath(filePath)}?ref=${encodeURIComponent(this.workingBranch)}`,
      ),
      {},
      "application/vnd.github.raw+json",
    );
    return response.text();
  }

  async getFileBinary(filePath: string): Promise<string> {
    const payload = await this.json<{ content?: string; encoding?: string }>(
      this.writePath(
        `/contents/${encodePath(filePath)}?ref=${encodeURIComponent(this.workingBranch)}`,
      ),
    );
    return (payload.content ?? "").replace(/\n/g, "");
  }

  async getTree(): Promise<TreeEntry[]> {
    const ref = await this.json<GitRef>(
      this.writePath(`/git/ref/heads/${encodeRef(this.workingBranch)}`),
    );
    const commit = await this.json<GitCommit>(
      this.writePath(`/git/commits/${ref.object.sha}`),
    );
    const tree = await this.json<GitTree>(
      this.writePath(`/git/trees/${commit.tree.sha}?recursive=1`),
    );

    return tree.tree
      .filter((entry) => entry.type === "blob" || entry.type === "tree")
      .map((entry) => ({
        path: entry.path,
        type: entry.type as TreeEntry["type"],
        sha: entry.sha,
      }));
  }

  async getPermissions(): Promise<Permissions> {
    const repository = await this.json<{
      permissions?: { push?: boolean; admin?: boolean };
    }>(this.repoPath());

    return {
      read: true,
      write: repository.permissions?.push ?? false,
      admin: repository.permissions?.admin ?? false,
    };
  }

  async createBranch(name: string): Promise<void> {
    const existing = await this.findRef(name, this.writePath());
    // Always branch off upstream: a fork may sit behind, and forks share an
    // object store with their parent, so its commits resolve either way.
    const base =
      existing ?? (await this.findRef(this.baseBranch, this.repoPath()));
    if (!base) {
      throw new Error(`Base branch "${this.baseBranch}" was not found.`);
    }

    if (!existing) {
      await this.json(this.writePath("/git/refs"), {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${name}`, sha: base.sha }),
      });
    }

    const commit = await this.json<GitCommit>(
      this.writePath(`/git/commits/${base.sha}`),
    );

    this.branch = name;
    this.baseCommitSHA = base.sha;
    this.baseTreeSHA = commit.tree.sha;
  }

  async commitChanges(
    changes: Change[],
    input?: { message?: string },
  ): Promise<CommitResult> {
    if (!this.branch || !this.baseCommitSHA || !this.baseTreeSHA) {
      throw new Error("createBranch() must be called before commitChanges().");
    }

    const expanded = await this.expandMoves(changes);
    const entries: TreeEntryInput[] = [];

    for (const change of expanded) {
      switch (change.type) {
        case "update":
        case "create": {
          const blob = await this.json<{ sha: string }>(
            this.writePath("/git/blobs"),
            {
              method: "POST",
              body: JSON.stringify({
                content: change.content,
                encoding: change.encoding === "base64" ? "base64" : "utf-8",
              }),
            },
          );
          entries.push({
            path: normalizePath(change.path),
            mode: "100644",
            type: "blob",
            sha: blob.sha,
          });
          break;
        }
        case "delete":
          entries.push({
            path: normalizePath(change.path),
            mode: "100644",
            type: "blob",
            sha: null,
          });
          break;
        case "move":
          break;
      }
    }

    const tree = await this.json<{ sha: string }>(
      this.writePath("/git/trees"),
      {
        method: "POST",
        body: JSON.stringify({ base_tree: this.baseTreeSHA, tree: entries }),
      },
    );
    const commit = await this.json<{ sha: string }>(
      this.writePath("/git/commits"),
      {
        method: "POST",
        body: JSON.stringify({
          message: input?.message ?? "docs: update content",
          tree: tree.sha,
          parents: [this.baseCommitSHA],
        }),
      },
    );

    await this.json(
      this.writePath(`/git/refs/heads/${encodeRef(this.branch)}`),
      {
        method: "PATCH",
        body: JSON.stringify({ sha: commit.sha }),
      },
    );

    this.baseCommitSHA = commit.sha;
    this.baseTreeSHA = tree.sha;

    return { sha: commit.sha, branch: this.branch };
  }

  async createPullRequest(input: {
    title: string;
    body?: string;
    head?: string;
    base?: string;
  }): Promise<PullRequest> {
    const branch = input.head ?? this.branch;
    if (!branch) {
      throw new Error(
        "createBranch() must be called before createPullRequest().",
      );
    }

    const head = this.qualify(branch);
    const existing = await this.findPullRequest(head);
    if (existing) return existing;

    const pullRequest = await this.json<{
      number: number;
      html_url: string;
      title: string;
    }>(this.repoPath("/pulls"), {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        head,
        base: input.base ?? this.baseBranch,
      }),
    });

    return {
      number: pullRequest.number,
      url: pullRequest.html_url,
      title: pullRequest.title,
    };
  }

  async getDiff(base?: string, head?: string): Promise<string> {
    const from = base ?? this.baseBranch;
    const to = head ?? this.branch;
    if (!to) {
      throw new Error(
        "createBranch() must be called before getDiff() with no arguments.",
      );
    }

    const response = await this.request(
      this.repoPath(
        `/compare/${encodeCompare(from)}...${encodeCompare(this.qualify(to))}`,
      ),
      {},
      "application/vnd.github.diff",
    );
    return response.text();
  }

  private repoPath(suffix = ""): string {
    return `/repos/${this.owner}/${this.repo}${suffix}`;
  }

  private writePath(suffix = ""): string {
    return `/repos/${this.writeOwner}/${this.repo}${suffix}`;
  }

  /** `owner:branch`, the form GitHub needs to name a branch across a fork. */
  private qualify(branch: string): string {
    return branch.includes(":") ? branch : `${this.writeOwner}:${branch}`;
  }

  private async findRef(
    name: string,
    scope: string,
  ): Promise<GitRef["object"] | null> {
    try {
      const ref = await this.json<GitRef>(
        `${scope}/git/ref/heads/${encodeRef(name)}`,
      );
      return ref.object;
    } catch {
      return null;
    }
  }

  private async findPullRequest(head: string): Promise<PullRequest | null> {
    const query = new URLSearchParams({
      head,
      state: "open",
    });
    const pulls = await this.json<
      Array<{ number: number; html_url: string; title: string }>
    >(this.repoPath(`/pulls?${query.toString()}`));
    const pull = pulls[0];
    if (!pull) return null;
    return { number: pull.number, url: pull.html_url, title: pull.title };
  }

  private async expandMoves(changes: Change[]): Promise<Change[]> {
    const expanded: Change[] = [];

    for (const change of changes) {
      if (change.type !== "move") {
        expanded.push(change);
        continue;
      }

      if (isBinaryPath(change.from) || isBinaryPath(change.to)) {
        let content: string | null = null;
        try {
          content = await this.getFileBinary(change.from);
        } catch {
          content = null;
        }
        if (content !== null) {
          expanded.push({
            type: "create",
            path: change.to,
            content,
            encoding: "base64",
          });
        }
        expanded.push({ type: "delete", path: change.from });
        continue;
      }

      let content: string | null = null;
      try {
        content = await this.getFile(change.from);
      } catch {
        content = null;
      }

      if (content !== null) {
        expanded.push({ type: "create", path: change.to, content });
      }
      expanded.push({ type: "delete", path: change.from });
    }

    return expanded;
  }

  private async request(
    pathname: string,
    init: RequestInit = {},
    accept = "application/vnd.github+json",
  ): Promise<Response> {
    const token =
      typeof this.token === "function" ? await this.token() : this.token;
    const headers = new Headers(init.headers);
    headers.set("accept", accept);
    headers.set("authorization", `Bearer ${token}`);
    headers.set("x-github-api-version", API_VERSION);

    const response = await fetch(`${this.apiBaseUrl}${pathname}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      let detail = response.statusText;
      try {
        const payload = (await response.json()) as { message?: string };
        detail = payload.message ?? detail;
      } catch {}
      throw new GitHubError(
        `GitHub request failed (${response.status}): ${detail}`,
        response.status,
      );
    }

    return response;
  }

  private async json<T>(pathname: string, init?: RequestInit): Promise<T> {
    const response = await this.request(pathname, init);
    return (await response.json()) as T;
  }
}

export function github(options: GitHubProviderOptions): GitHubProvider {
  return new GitHubProvider(options);
}

function normalizePath(filePath: string): string {
  return filePath.replace(/^\.?\//, "");
}

const BINARY_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".gif",
  ".ico",
  ".pdf",
  ".mp4",
  ".webm",
];

function isBinaryPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return BINARY_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function encodePath(filePath: string): string {
  return normalizePath(filePath).split("/").map(encodeURIComponent).join("/");
}

function encodeRef(ref: string): string {
  return ref.split("/").map(encodeURIComponent).join("/");
}

// `owner:branch` in a compare path: the colon must survive encoding.
function encodeCompare(ref: string): string {
  return ref.split(":").map(encodeRef).join(":");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
