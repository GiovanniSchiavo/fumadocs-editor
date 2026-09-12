"use client";

import type * as PageTree from "fumadocs-core/page-tree";
import { useTreeContext } from "fumadocs-ui/contexts/tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  Sidebar,
  type SidebarProps,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "fumadocs-ui/layouts/docs/slots/sidebar";
import { type ComponentProps, useMemo } from "react";
import type { MdxComponentHint } from "./editor/component-hints";
import { FumadocsEditorProvider, useFumadocsEditor } from "./editor/context";
import { mapTabsToEditorUrls, mapTreeToEditorUrls } from "./editor/editor-tree";
import {
  createMdxPreviewRenderer,
  type EditorPreviewComponents,
  type EditorRenderPreview,
  type MdxPreviewRendererOptions,
} from "./editor/mdx-preview";
import {
  EditorSidebarBody,
  EditorSidebarFooter,
  EditorSidebarHead,
  EditorSidebarQueryProvider,
} from "./editor/sidebar";
import { EditorSidebarAuth } from "./editor/sidebar-auth";
import type { MediaConfig } from "./media/types";
import type { EditorFormatter, RepositorySession } from "./types";
import type { WebMcpConfig } from "./webmcp/types";

export {
  createMdxPreviewRenderer,
  type EditorPreviewComponents,
  type EditorRenderPreview,
  type MdxPreviewRendererOptions,
};

function useIsFirstRootChild(node: object): boolean {
  const { root } = useTreeContext();
  return root.children[0] === node;
}

function EditorItem({ item }: { item: PageTree.Item }) {
  return useIsFirstRootChild(item) ? <EditorSidebarBody /> : null;
}

function EditorFolder({ item }: { item: PageTree.Folder }) {
  return useIsFirstRootChild(item) ? <EditorSidebarBody /> : null;
}

function EditorSeparator({ item }: { item: PageTree.Separator }) {
  return useIsFirstRootChild(item) ? <EditorSidebarBody /> : null;
}

function EditorSidebarRoot(props: SidebarProps) {
  const { isEditing } = useFumadocsEditor();
  const { root } = useTreeContext();
  const empty = isEditing && root.children.length === 0;

  return (
    <EditorSidebarQueryProvider>
      <Sidebar
        {...props}
        components={
          isEditing
            ? {
                Item: EditorItem,
                Folder: EditorFolder,
                Separator: EditorSeparator,
              }
            : undefined
        }
        banner={
          <>
            {props.banner}
            {isEditing ? <EditorSidebarHead /> : null}
            {empty ? <EditorSidebarBody /> : null}
          </>
        }
        footer={
          <>
            {isEditing ? <EditorSidebarFooter /> : null}
            {props.footer}
            <EditorSidebarAuth />
          </>
        }
      />
    </EditorSidebarQueryProvider>
  );
}

const editorSidebarSlots = {
  provider: SidebarProvider,
  root: EditorSidebarRoot,
  trigger: SidebarTrigger,
  useSidebar,
};

function EditorDocsLayout({
  children,
  containerProps,
  tree,
  tabs,
  ...props
}: ComponentProps<typeof DocsLayout>) {
  const { isEditing, editorHref } = useFumadocsEditor();

  // Fumadocs resolves the active tab from the current path. While editing,
  // that path lives under the editor route, so the tree has to point there.
  const editorTree = useMemo(
    () => (isEditing ? mapTreeToEditorUrls(tree, editorHref) : tree),
    [isEditing, tree, editorHref],
  );
  const editorTabs = useMemo(
    () =>
      isEditing && Array.isArray(tabs)
        ? mapTabsToEditorUrls(tabs, editorHref)
        : tabs,
    [isEditing, tabs, editorHref],
  );

  return (
    <DocsLayout
      {...props}
      tree={editorTree}
      tabs={editorTabs}
      containerProps={{ ...containerProps }}
      slots={{ sidebar: editorSidebarSlots }}
    >
      {children}
    </DocsLayout>
  );
}

export interface FumadocsEditorLayoutProps
  extends Omit<ComponentProps<typeof DocsLayout>, "tree" | "sidebar"> {
  tree: PageTree.Root;
  repository: RepositorySession;
  apiBase?: string;
  docsBaseUrl?: string;
  /** Route segment the editor lives under. Defaults to `/editor`. */
  editorBasePath?: string;
  media?: MediaConfig;
  webmcp?: false | WebMcpConfig;
  formatter?: EditorFormatter;
  /** Component catalog for completions/snippets. */
  components?: MdxComponentHint[];
  /**
   * MDX components used to render the preview pane. Imports in the document
   * are ignored while previewing, so components resolve by name from this
   * map; anything missing renders as a placeholder.
   */
  mdxComponents?: EditorPreviewComponents;
  renderPreview?: EditorRenderPreview;
}

export function FumadocsEditorLayout({
  repository,
  apiBase = "/api/editor",
  docsBaseUrl = "/docs",
  editorBasePath,
  media,
  webmcp,
  formatter,
  components,
  mdxComponents,
  renderPreview,
  children,
  ...docsProps
}: FumadocsEditorLayoutProps) {
  const defaultRenderPreview = useMemo(
    () => createMdxPreviewRenderer(mdxComponents),
    [mdxComponents],
  );

  return (
    <FumadocsEditorProvider
      repository={repository}
      apiBase={apiBase}
      docsBaseUrl={docsBaseUrl}
      editorBasePath={editorBasePath}
      renderPreview={renderPreview ?? defaultRenderPreview}
      formatter={formatter}
      components={components}
      media={media}
      webmcp={webmcp}
    >
      <EditorDocsLayout {...docsProps}>{children}</EditorDocsLayout>
    </FumadocsEditorProvider>
  );
}
