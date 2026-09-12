import path from "node:path";
import { GitHubProvider } from "../github/provider";
import { mimeForMedia } from "../media/paths";
import { type MediaConfig, resolveMediaConfig } from "../media/types";
import type { Change, GitProvider, RepositorySession } from "../types";
import type { VirtualCommit } from "../workspace/types";
import {
  type AuthSession,
  createGitHubAuth,
  type GitHubAuth,
  type GitHubAuthOptions,
} from "./auth";
import { createLocalContentProvider } from "./fs";
import { pushVirtualCommits } from "./push";
import {
  readGitHubModel,
  readGitHubPublicMedia,
  readLocalModel,
  readLocalPublicMedia,
} from "./tree";

export interface EditorHandlerOptions {
  dir?: string;
  repository?: Partial<RepositorySession>;
  git?: GitProvider;
  authorize?: (request: Request) => boolean | Promise<boolean>;
  branchPrefix?: string;
  auth?: GitHubAuthOptions;
  docsBaseUrl?: string;
  media?: MediaConfig;
  /**
   * Let a signed-in user without write access push to their own fork and open
   * a pull request from it. Off by default: enabling it means anyone who can
   * sign in with GitHub can open a pull request against the repository.
   *
   * @defaultValue false
   */
  allowForks?: boolean;
}

export interface EditorHandler {
  GET(request: Request): Promise<Response>;
  POST(request: Request): Promise<Response>;
}

interface SubmitPayload {
  op?: string;
  message?: string;
  description?: string;
  branch?: string;
  title?: string;
  body?: string;
  commits?: VirtualCommit[];
  changes?: Change[];
}

const CHANGE_TYPES = new Set(["update", "create", "delete", "move"]);

export function createEditorHandler(
  options: EditorHandlerOptions = {},
): EditorHandler {
  const repository: RepositorySession = {
    provider: options.repository?.provider ?? "github",
    owner: options.repository?.owner ?? "local",
    repo: options.repository?.repo ?? "local",
    baseBranch: options.repository?.baseBranch ?? "main",
    baseCommitSHA: options.repository?.baseCommitSHA,
    contentDir: options.repository?.contentDir ?? options.dir ?? "content/docs",
    publicDir: options.repository?.publicDir,
  };

  const dir = path.resolve(process.cwd(), options.dir ?? repository.contentDir);
  const content = createLocalContentProvider(dir);
  const media = resolveMediaConfig(options.media);
  const publicDir = path.resolve(process.cwd(), media.publicDir);
  // The repository may nest the app, so its public path can differ from disk.
  const publicRepoDir = repository.publicDir ?? media.publicDir;
  const publicContent = createLocalContentProvider(publicDir);
  const branchPrefix = options.branchPrefix ?? "fumadocs-editor/";
  const auth: GitHubAuth | null = options.auth
    ? createGitHubAuth(options.auth)
    : null;
  const docsBaseUrl = options.docsBaseUrl ?? "/docs";
  const allowForks = options.allowForks ?? false;

  function providerFor(session: AuthSession): GitHubProvider | null {
    if (repository.provider !== "github") return null;
    if (options.git) return options.git as GitHubProvider;
    return new GitHubProvider({
      owner: repository.owner,
      repo: repository.repo,
      baseBranch: repository.baseBranch,
      token: session.accessToken,
    });
  }

  async function authorize(request: Request): Promise<boolean> {
    if (!options.authorize) return true;
    return options.authorize(request);
  }

  async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const op =
      url.searchParams.get("op") ??
      (url.searchParams.has("path") ? "file" : "tree");

    if (op === "login") {
      if (!auth) return unconfigured();
      return auth.login(request);
    }
    if (op === "callback") {
      if (!auth) return unconfigured();
      return auth.callback(request);
    }
    if (op === "logout") {
      if (!auth) return unconfigured();
      return auth.logout();
    }
    if (op === "session") {
      if (!auth) {
        return Response.json({
          configured: false,
          user: null,
          canWrite: false,
          canPropose: false,
        });
      }
      return auth.status(request, { allowForks });
    }

    if (!(await authorize(request))) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    try {
      const session = auth ? await auth.readSession(request) : null;

      if (op === "tree") {
        if (session) {
          const provider = providerFor(session);
          if (provider) {
            const model = await readGitHubModel(
              provider,
              repository.contentDir,
            );
            return Response.json({
              model,
              source: "github",
              baseUrl: docsBaseUrl,
            });
          }
        }

        const model = await readLocalModel(dir);
        return Response.json({ model, source: "local", baseUrl: docsBaseUrl });
      }

      if (op === "file") {
        const filePath = url.searchParams.get("path");
        if (!filePath) {
          return Response.json(
            { error: 'Missing "path" query parameter.' },
            { status: 400 },
          );
        }

        if (session) {
          const provider = providerFor(session);
          if (provider) {
            const repoPath = repository.contentDir
              ? `${repository.contentDir.replace(/\/+$/, "")}/${filePath}`
              : filePath;
            const value = await provider.getFile(repoPath);
            return Response.json({ path: filePath, content: value });
          }
        }

        const file = await content.read(filePath);
        return Response.json(file);
      }

      if (op === "raw") {
        const filePath = url.searchParams.get("path");
        if (!filePath) {
          return Response.json(
            { error: 'Missing "path" query parameter.' },
            { status: 400 },
          );
        }
        const base =
          url.searchParams.get("base") === "public" ? "public" : "content";

        if (session) {
          const provider = providerFor(session);
          if (provider) {
            const rootDir =
              base === "public" ? publicRepoDir : repository.contentDir;
            const repoPath = rootDir
              ? `${rootDir.replace(/\/+$/, "")}/${filePath}`
              : filePath;
            const base64 = provider.getFileBinary
              ? await provider.getFileBinary(repoPath)
              : Buffer.from(await provider.getFile(repoPath)).toString(
                  "base64",
                );
            return Response.json({
              path: filePath,
              base,
              base64,
              mime: mimeForMedia(filePath),
            });
          }
        }

        const provider = base === "public" ? publicContent : content;
        const file = await provider.readBinary?.(filePath);
        if (!file) {
          return Response.json({ error: "File not found." }, { status: 404 });
        }
        return Response.json({
          path: filePath,
          base,
          base64: Buffer.from(file.bytes).toString("base64"),
          mime: mimeForMedia(filePath),
        });
      }

      if (op === "media") {
        if (session) {
          const provider = providerFor(session);
          if (provider) {
            const model = await readGitHubModel(
              provider,
              repository.contentDir,
            );
            const publicMedia = await readGitHubPublicMedia(
              provider,
              publicRepoDir,
            );
            return Response.json({
              content: model.media ?? [],
              public: publicMedia,
            });
          }
        }

        const model = await readLocalModel(dir);
        const publicMedia = await readLocalPublicMedia(publicDir);
        return Response.json({
          content: model.media ?? [],
          public: publicMedia,
        });
      }

      return Response.json({ error: `Unknown op "${op}".` }, { status: 400 });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to read content.";
      return Response.json({ error: message }, { status: 404 });
    }
  }

  async function POST(request: Request): Promise<Response> {
    if (!(await authorize(request))) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    let payload: SubmitPayload;
    try {
      payload = (await request.json()) as SubmitPayload;
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (payload.op === "push") {
      return push(request, payload);
    }

    return legacySubmit(payload);
  }

  async function push(
    request: Request,
    payload: SubmitPayload,
  ): Promise<Response> {
    if (!auth) return unconfigured();

    const session = await auth.readSession(request);
    if (!session) {
      return Response.json(
        { error: "Sign in with GitHub first." },
        { status: 401 },
      );
    }

    const writable = await auth.canWrite(session);
    if (!writable && !allowForks) {
      return Response.json(
        { error: "You do not have write access to this repository." },
        { status: 403 },
      );
    }

    const provider = providerFor(session);
    if (!provider) {
      return Response.json(
        { error: "GitHub provider is not configured." },
        { status: 501 },
      );
    }

    // No write access: commit to the user's fork and propose from there.
    if (!writable) {
      try {
        await provider.forkTo(session.login);
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Unable to prepare your fork.";
        return Response.json({ error: message }, { status: 502 });
      }
    }

    const commits = payload.commits ?? [];
    if (commits.length === 0) {
      return Response.json({ error: "No commits to push." }, { status: 400 });
    }

    for (const commit of commits) {
      if (!commit.message || !Array.isArray(commit.changes)) {
        return Response.json(
          { error: "Invalid commit payload." },
          { status: 400 },
        );
      }
    }

    const branch = `${branchPrefix}${session.login.replace(/[^a-zA-Z0-9-]/g, "-")}`;

    try {
      const result = await pushVirtualCommits(provider, {
        commits,
        branch,
        baseBranch: repository.baseBranch,
        title:
          payload.title ??
          commits[commits.length - 1]?.message ??
          "docs: update content",
        body: payload.body,
        contentDir: repository.contentDir,
        publicDir: publicRepoDir,
      });

      return Response.json({ ...result, forked: provider.isFork });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to push changes.";
      return Response.json({ error: message }, { status: 500 });
    }
  }

  async function legacySubmit(payload: SubmitPayload): Promise<Response> {
    const changes = payload.changes;
    if (!Array.isArray(changes) || changes.length === 0) {
      return Response.json(
        { error: "At least one change is required." },
        { status: 400 },
      );
    }

    for (const change of changes) {
      if (!CHANGE_TYPES.has(change.type)) {
        return Response.json(
          { error: `Unsupported change type: ${String(change.type)}` },
          { status: 400 },
        );
      }
    }

    const message = payload.message?.trim() || "docs: update content";

    try {
      if (options.git && repository.provider === "github") {
        const branch =
          payload.branch ?? `${branchPrefix}${Date.now().toString(36)}`;
        await options.git.createBranch(branch);
        const commit = await options.git.commitChanges(changes, { message });
        const pullRequest = await options.git.createPullRequest({
          title: message,
          body: payload.description,
          head: branch,
          base: repository.baseBranch,
        });

        return Response.json({
          ok: true,
          mode: "pull-request",
          message: `Pull request #${pullRequest.number} created.`,
          branch: commit.branch,
          pullRequest: { number: pullRequest.number, url: pullRequest.url },
        });
      }

      for (const change of changes) {
        switch (change.type) {
          case "update":
          case "create":
            await content.write(change.path, change.content);
            break;
          case "delete":
            await content.delete?.(change.path);
            break;
          case "move": {
            const file = await content.read(change.from);
            await content.write(change.to, file.content);
            await content.delete?.(change.from);
            break;
          }
        }
      }

      return Response.json({
        ok: true,
        mode: "local",
        message: `Saved ${changes.length} file(s) to ${repository.contentDir}.`,
      });
    } catch (caught) {
      const messageText =
        caught instanceof Error ? caught.message : "Unable to submit changes.";
      return Response.json({ error: messageText }, { status: 500 });
    }
  }

  return { GET, POST };
}

function unconfigured(): Response {
  return Response.json(
    { error: "GitHub authentication is not configured." },
    { status: 501 },
  );
}

export { createLocalContentProvider, resolveInside } from "./fs";
