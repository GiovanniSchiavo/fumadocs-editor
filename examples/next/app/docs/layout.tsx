import { EditorDocsLayout } from "@/components/editor-layout";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <EditorDocsLayout tree={source.getPageTree()} base={baseOptions()}>
      {children}
    </EditorDocsLayout>
  );
}
