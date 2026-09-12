# Next.js consumer example

This is a minimal consumer fixture for `fumadocs-editor`. It uses released
Fumadocs packages while linking the editor from this workspace, which helps
catch missing dependencies and packaging assumptions that the Fumadocs
monorepo can mask.

The primary interactive playground is the Fumadocs documentation app in the
adjacent `fumadocs` repository.

From the `fumadocs-editor` root, run:

```bash
pnpm example:dev
```

Then open <http://localhost:3000>.

## Routes

| Route                     | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `/docs/[[...slug]]`       | Reading. `EditorToolbar` renders "Edit this page" |
| `/editor/[[...slug]]`     | Editing. The slug is the **content file path**    |
| `/api/editor`             | Workspace API (tree, file reads, push)           |

Editing lives on its own route so that a page which only exists as a pending
change — newly created, renamed, or committed but not pushed — still has a URL
that resolves:

```
/docs/basic             reading
/editor/basic.mdx       editing that file
/editor/guides/new.mdx  editing a file that is not on disk yet
/editor                 editor with no file open
```

Both route files are thin:

```tsx
// app/editor/[[...slug]]/page.tsx
export { EditorPage as default } from "fumadocs-editor";

// app/editor/layout.tsx — same layout as /docs, so the provider and sidebar match
```

Pass `editorBasePath` to `FumadocsEditorLayout` if you mount the editor
somewhere other than `/editor`.
