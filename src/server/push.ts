import type { WorkspaceChange } from "../meta/types";
import type { Change, GitProvider } from "../types";
import type { PushResult, VirtualCommit } from "../workspace/types";

export interface PushInput {
  commits: VirtualCommit[];
  branch: string;
  baseBranch: string;
  title: string;
  body?: string;
  contentDir?: string;
  publicDir?: string;
}

export async function pushVirtualCommits(
  git: GitProvider,
  input: PushInput,
): Promise<PushResult> {
  await git.createBranch(input.branch);

  for (const commit of input.commits) {
    await git.commitChanges(
      commit.changes.map((change) =>
        toRepoChange(
          change,
          input.contentDir ?? "",
          input.publicDir ?? "public",
        ),
      ),
      { message: commit.message },
    );
  }

  const pullRequest = await git.createPullRequest({
    title: input.title,
    body: input.body,
    head: input.branch,
    base: input.baseBranch,
  });

  return { branch: input.branch, prUrl: pullRequest.url };
}

export function toRepoChange(
  change: WorkspaceChange,
  contentDir: string,
  publicDir: string,
): Change {
  const prefix = (base: string | undefined) =>
    base === "public" ? publicDir : contentDir;
  const join = (dir: string, path: string) =>
    [dir.replace(/\/+$/, ""), path.replace(/^\/+/, "")]
      .filter(Boolean)
      .join("/");

  switch (change.type) {
    case "create":
    case "update":
      return {
        type: change.type,
        path: join(prefix(change.base), change.path),
        content: change.content,
        encoding: change.encoding,
      };
    case "delete":
      return { type: "delete", path: join(prefix(change.base), change.path) };
    case "move":
      return {
        type: "move",
        from: join(prefix(change.base), change.from),
        to: join(prefix(change.base), change.to),
      };
  }
}
