# fumadocs-editor

Inline editing for [Fumadocs](https://fumadocs.dev), backed by Git pull requests.

Mount one route and your docs site gains an `/editor` mirror of `/docs`: a
CodeMirror MDX editor with live preview, a file tree that can create, rename and
reorder pages, and a Git panel that stages changes into local commits and pushes
them to GitHub as a pull request. Nothing is written to your repository until
someone signs in and pushes.

## Install

```bash
npm install fumadocs-editor
```

Peer dependencies: `fumadocs-core` and `fumadocs-ui` (>= 16.15), `react` and
`react-dom` (>= 18). `prettier` (>= 3) is optional — install it to enable the
built-in formatter.

## Quick start

Three files. The example app in [`examples/next`](examples/next) is the complete
version of this.

**1. The API route** — must live at `/api/editor`, since the OAuth callback
resolves to `<origin>/api/editor?op=callback`.

```ts
// app/api/editor/route.ts
import { createEditorHandler } from "fumadocs-editor/server";

export const { GET, POST } = createEditorHandler({
  dir: "content/docs",
  docsBaseUrl: "/docs",
  repository: {
    provider: "local", // "github" once OAuth is configured, see below
    owner: "local",
    repo: "local",
    baseBranch: "main",
    contentDir: "content/docs",
  },
});
```

**2. The editor page** — a catch-all under `/editor`.

```tsx
// app/editor/[[...slug]]/page.tsx
export { EditorPage as default } from "fumadocs-editor";
```

**3. The layout.** `FumadocsEditorLayout` wraps Fumadocs' `DocsLayout`, so the
editor keeps your sidebar, tabs and theme. It takes functions and component maps
as props, so it belongs in a client component.

```tsx
// components/editor-layout.tsx
"use client";

import { FumadocsEditorLayout } from "fumadocs-editor";
import { prettierFormatter } from "fumadocs-editor/format";
import { getMDXComponents } from "./mdx";

export function EditorDocsLayout({ tree, base, children }) {
  return (
    <FumadocsEditorLayout
      {...base}
      tree={tree}
      repository={{
        provider: "local",
        owner: "local",
        repo: "local",
        baseBranch: "main",
        contentDir: "content/docs",
      }}
      formatter={prettierFormatter}
      mdxComponents={getMDXComponents()}
    >
      {children}
    </FumadocsEditorLayout>
  );
}
```

```tsx
// app/editor/layout.tsx
import { EditorDocsLayout } from "@/components/editor-layout";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function Layout({ children }: LayoutProps<"/editor">) {
  return (
    <EditorDocsLayout tree={source.getPageTree()} base={baseOptions()}>
      {children}
    </EditorDocsLayout>
  );
}
```

`/editor/<slug>` now mirrors `/docs/<slug>`. Link to it from your docs pages with
a plain link, or with `<EditThisPage path="..." />` for pages that already render
inside the editor provider.

## GitHub mode

Local mode reads from disk and keeps edits in the browser — good for trying the
editor out. To open pull requests, register a GitHub OAuth app with the callback
URL `https://your-site.com/api/editor?op=callback` and pass `auth`:

```ts
export const { GET, POST } = createEditorHandler({
  dir: "content/docs",
  repository: {
    provider: "github",
    owner: process.env.GITHUB_REPO_OWNER!,
    repo: process.env.GITHUB_REPO_NAME!,
    baseBranch: "main",
    contentDir: "content/docs",
    publicDir: "public",
  },
  auth: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    sessionSecret: process.env.GITHUB_SESSION_SECRET!,
    scope: "repo", // "public_repo" is enough for a public repository
    repository: {
      owner: process.env.GITHUB_REPO_OWNER!,
      repo: process.env.GITHUB_REPO_NAME!,
    },
  },
});
```

The session is an encrypted JWT in the `fde_session` cookie, valid for 7 days;
`sessionSecret` is any high-entropy string. Before pushing, the handler checks
that the signed-in user actually has push permission on the repository — a
reader gets a 403, not a failed commit.

On push, commits are replayed onto a branch named
`fumadocs-editor/<login>` (change the prefix with `branchPrefix`) and a pull
request is opened against `baseBranch`.

### Monorepos

`repository.contentDir` and `repository.publicDir` are paths *inside the
repository*; `dir` and `media.publicDir` are paths on disk relative to the
process. For `apps/docs` in a monorepo these differ, and both need to be set.

## Open authoring

By default a signed-in user without push access gets a 403 — GitHub has no
"anyone can push" setting, so `permissions.push` is false for everyone outside
the collaborator list. Set `allowForks: true` and those users instead get the
flow GitHub's own edit button uses:

1. Fork the repository to their account, if they don't already have one.
2. Branch from **upstream's** base commit and commit there. Forks share an
   object store with their parent, so the fork never has to be synced first.
3. Open the pull request against upstream with `head: "<login>:<branch>"`.

Users with push access are unaffected — their branches still go straight to the
repository.

```ts
createEditorHandler({
  allowForks: true,
  // …
});
```

It's off by default because turning it on means anyone who can sign in with
GitHub can open a pull request against your repository.

> **Under a GitHub App**, a user token can only write to repositories where that
> app is installed, so each contributor has to install the app on their fork
> before the push succeeds. An OAuth App with `public_repo` has no such step.
> If open authoring is the point, an OAuth App is the lower-friction choice.

## Configuration

### `createEditorHandler(options)`

| Option | Default | Description |
| --- | --- | --- |
| `dir` | `"content/docs"` | Content directory on disk. |
| `repository` | provider `"github"` | Repository session: `provider`, `owner`, `repo`, `baseBranch`, `contentDir`, `publicDir`. |
| `auth` | — | GitHub OAuth options. Omit for local mode. |
| `git` | — | Custom `GitProvider`, instead of the built-in GitHub one. |
| `authorize` | — | `(request) => boolean` gate run before every operation. |
| `branchPrefix` | `"fumadocs-editor/"` | Prefix for pushed branches. |
| `allowForks` | `false` | Let users without write access propose changes from their own fork. |
| `docsBaseUrl` | `"/docs"` | Public base URL of the docs. |
| `media` | see below | Upload configuration. |

### `<FumadocsEditorLayout />`

Accepts everything `DocsLayout` does, plus:

| Prop | Default | Description |
| --- | --- | --- |
| `tree` | required | Fumadocs page tree. |
| `repository` | required | Same shape as the handler's `repository`. |
| `apiBase` | `"/api/editor"` | Where the handler is mounted. |
| `docsBaseUrl` | `"/docs"` | Public base URL of the docs. |
| `editorBasePath` | `"/editor"` | Route segment the editor lives under. |
| `formatter` | — | `EditorFormatter`; `prettierFormatter` from `fumadocs-editor/format`. |
| `components` | — | `MdxComponentHint[]` catalog for completions and snippets. |
| `mdxComponents` | — | Components used to render the preview pane. |
| `renderPreview` | MDX renderer | Full override of the preview renderer. |
| `media` | see below | Upload configuration. |
| `webmcp` | `true` | WebMCP tools; `false` disables. |

Preview rendering ignores imports in the document and resolves components by
name from `mdxComponents`. Anything missing renders as a placeholder rather than
breaking the preview.

### Media

```ts
media: {
  publicDir: "public",     // directory served at "/", relative to the project root
  publicFolders: [""],     // folders inside it uploads may target ("" is its root)
  maxSize: 10 * 1024 * 1024,
  types: [".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"],
  insertTemplate: "![{alt}]({src})", // placeholders: {alt} {src} {name}
}
```

Assets colocated with content work too, and relative sources are rewritten when
a page moves.

## What's in the editor

- **Editing** — CodeMirror 6 with MDX and YAML syntax, component completions and
  snippets from your `components` catalog, and a frontmatter form.
- **Views** — edit, split, preview, and a diff against the original.
- **Linting** — frontmatter YAML plus a remark-lint rule set, inline in the
  gutter.
- **File tree** — create, rename, move and delete pages; edit `meta.json`
  ordering and icons from the sidebar.
- **Git panel** — stage, commit and stash locally, review the diff, then push
  the stack as one pull request.
- **Media panel** — upload and insert images.
- **Persistence** — the workspace lives in IndexedDB, so a refresh doesn't lose
  work.
- **Keyboard** — `Mod+S` submit, `Mod+B/I/E/K` formatting, `Shift+Alt+F` format
  document, `Shift+Mod+H` for the full list.

## WebMCP

When a [WebMCP](https://github.com/webmachinelearning/webmcp) implementation is
present in the browser, the editor registers tools that let an agent work on the
docs: `list-pages`, `get-content`, `get-original`, `get-diff`,
`list-components`, `list-media`, `validate-content`, `format-content`,
`edit-content`, `new-page`, `delete-page`, `reorder-sidebar`, `add-image`,
`insert-component`.

```tsx
webmcp={{ prefix: "docs-", tools: ["list-pages", "get-content", "edit-content"] }}
```

Tools write to the same in-browser workspace as the UI, so an agent's edits
still go through commit and push under a human's account.

## Exports

| Entry | Contents |
| --- | --- |
| `fumadocs-editor` | React components, hooks, types. |
| `fumadocs-editor/server` | `createEditorHandler`, GitHub auth, content providers. |
| `fumadocs-editor/github` | `GitHubProvider`, `github`. |
| `fumadocs-editor/format` | `prettierFormatter`. |

## Development

```bash
pnpm install
pnpm dev            # build the package in watch mode
pnpm example:dev    # run examples/next against it
pnpm test           # vitest
pnpm lint           # biome
pnpm types:check    # tsc --noEmit
```

## License

MIT
