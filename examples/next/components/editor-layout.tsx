"use client";

import type { Root } from "fumadocs-core/page-tree";
import { FumadocsEditorLayout } from "fumadocs-editor";
import { prettierFormatter } from "fumadocs-editor/format";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import type { ReactNode } from "react";
import { getMDXComponents } from "./mdx";

export function EditorDocsLayout({
  tree,
  base,
  children,
}: {
  tree: Root;
  base: BaseLayoutProps;
  children: ReactNode;
}) {
  return (
    <FumadocsEditorLayout
      {...base}
      tree={tree}
      repository={{
        provider: "local",
        owner: "local",
        repo: "fumadocs-editor-example-next",
        baseBranch: "main",
        contentDir: "content/docs",
      }}
      formatter={prettierFormatter}
      mdxComponents={getMDXComponents()}
      components={[
        {
          name: "Since",
          description: "Example custom component",
          snippet: '<Since version="0.1.0" />',
        },
      ]}
    >
      {children}
    </FumadocsEditorLayout>
  );
}
