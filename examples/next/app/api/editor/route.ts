import { createEditorHandler } from "fumadocs-editor/server";

const owner = process.env.GITHUB_REPO_OWNER;
const repo = process.env.GITHUB_REPO_NAME;
const clientId = process.env.GITHUB_CLIENT_ID;
const clientSecret = process.env.GITHUB_CLIENT_SECRET;
const sessionSecret = process.env.GITHUB_SESSION_SECRET;
const baseBranch = process.env.GITHUB_BASE_BRANCH ?? "main";
const remoteContentDir = process.env.GITHUB_CONTENT_DIR ?? "content/docs";
const remotePublicDir = process.env.GITHUB_PUBLIC_DIR ?? "public";

const configured = Boolean(
  owner && repo && clientId && clientSecret && sessionSecret,
);

export const { GET, POST } = createEditorHandler({
  dir: "content/docs",
  docsBaseUrl: "/docs",
  media: {
    // Uploads land in public/ itself; add more entries to offer subfolders.
    publicDir: "public",
    publicFolders: [""],
  },
  repository: {
    provider: configured ? "github" : "local",
    owner: owner ?? "local",
    repo: repo ?? "local",
    baseBranch,
    contentDir: configured ? remoteContentDir : "content/docs",
    publicDir: configured ? remotePublicDir : "public",
  },
  auth:
    configured && owner && repo
      ? {
          clientId: clientId as string,
          clientSecret: clientSecret as string,
          sessionSecret: sessionSecret as string,
          repository: { owner, repo },
        }
      : undefined,
});
