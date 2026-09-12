import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubProvider } from "./provider";

interface Call {
  method: string;
  path: string;
  body: unknown;
}

/**
 * Answers the Git data API with just enough for a branch + commit + pull
 * request, and records where every request went.
 */
function stubGitHub(routes: Record<string, unknown>) {
  const calls: Call[] = [];

  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const method = init?.method ?? "GET";
    const key = `${method} ${url.pathname}`;
    calls.push({
      method,
      path: url.pathname + url.search,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });

    const route = routes[key];
    if (route === undefined) {
      return new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
      });
    }
    const payload = typeof route === "function" ? route() : route;
    return new Response(JSON.stringify(payload), { status: 200 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const BASE_ROUTES = {
  "GET /repos/acme/docs/git/ref/heads/main": { object: { sha: "base-sha" } },
  "GET /repos/acme/docs/pulls": [],
  "POST /repos/acme/docs/pulls": {
    number: 7,
    html_url: "https://github.com/acme/docs/pull/7",
    title: "docs: update",
  },
};

const FORK_WRITE_ROUTES = {
  "POST /repos/bob/docs/git/refs": {},
  "GET /repos/bob/docs/git/commits/base-sha": { tree: { sha: "base-tree" } },
  "POST /repos/bob/docs/git/blobs": { sha: "blob-sha" },
  "POST /repos/bob/docs/git/trees": { sha: "tree-sha" },
  "POST /repos/bob/docs/git/commits": { sha: "commit-sha" },
  "PATCH /repos/bob/docs/git/refs/heads/edit/bob": {},
};

function provider() {
  return new GitHubProvider({
    owner: "acme",
    repo: "docs",
    baseBranch: "main",
    token: "t",
  });
}

async function pushOnce(git: GitHubProvider) {
  await git.createBranch("edit/bob");
  await git.commitChanges([
    { type: "create", path: "docs/new.mdx", content: "hi" },
  ]);
  return git.createPullRequest({ title: "docs: update" });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("GitHubProvider fork flow", () => {
  it("commits to the fork and opens the pull request upstream", async () => {
    const calls = stubGitHub({
      ...BASE_ROUTES,
      ...FORK_WRITE_ROUTES,
      "GET /repos/bob/docs": { name: "docs" },
    });

    const git = provider();
    await git.forkTo("bob");
    const pullRequest = await pushOnce(git);

    expect(git.isFork).toBe(true);
    expect(pullRequest.url).toBe("https://github.com/acme/docs/pull/7");

    // Every write lands in the fork, never upstream.
    const writes = calls.filter((call) => call.method !== "GET");
    for (const write of writes) {
      if (write.path.endsWith("/pulls")) continue;
      expect(write.path.startsWith("/repos/bob/docs")).toBe(true);
    }

    // The branch is cut from upstream's base, not the fork's copy of it.
    expect(calls).toContainEqual(
      expect.objectContaining({
        method: "GET",
        path: "/repos/acme/docs/git/ref/heads/main",
      }),
    );

    // The pull request is upstream, with the fork named in the head ref.
    const opened = calls.find(
      (call) =>
        call.method === "POST" && call.path === "/repos/acme/docs/pulls",
    );
    expect(opened?.body).toMatchObject({ head: "bob:edit/bob", base: "main" });
  });

  it("creates the fork when it does not exist yet and waits for it", async () => {
    // The stub 404s unknown routes, so the fork is absent until it is added.
    const routes: Record<string, unknown> = {
      ...BASE_ROUTES,
      ...FORK_WRITE_ROUTES,
      "POST /repos/acme/docs/forks": { name: "docs" },
    };
    const calls = stubGitHub(routes);

    vi.useFakeTimers();
    const git = provider();

    let forked = false;
    const pending = git.forkTo("bob").then(() => {
      forked = true;
    });

    // First probe 404s and the fork is requested; GitHub has not finished yet.
    await vi.advanceTimersByTimeAsync(0);
    expect(forked).toBe(false);
    expect(calls).toContainEqual(
      expect.objectContaining({
        method: "POST",
        path: "/repos/acme/docs/forks",
      }),
    );

    routes["GET /repos/bob/docs"] = { name: "docs" };
    await vi.advanceTimersByTimeAsync(1000);
    await pending;

    expect(forked).toBe(true);
    expect(git.isFork).toBe(true);
  });

  it("leaves writes upstream when the user has push access", async () => {
    const calls = stubGitHub({
      ...BASE_ROUTES,
      "POST /repos/acme/docs/git/refs": {},
      "GET /repos/acme/docs/git/commits/base-sha": {
        tree: { sha: "base-tree" },
      },
      "POST /repos/acme/docs/git/blobs": { sha: "blob-sha" },
      "POST /repos/acme/docs/git/trees": { sha: "tree-sha" },
      "POST /repos/acme/docs/git/commits": { sha: "commit-sha" },
      "PATCH /repos/acme/docs/git/refs/heads/edit/bob": {},
    });

    const git = provider();
    await pushOnce(git);

    expect(git.isFork).toBe(false);
    expect(
      calls.every((call) => call.path.startsWith("/repos/acme/docs")),
    ).toBe(true);
  });
});
