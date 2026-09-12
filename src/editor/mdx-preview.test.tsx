import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createMdxPreviewRenderer,
  type EditorPreviewComponents,
} from "./mdx-preview";

async function render(
  source: string,
  components?: EditorPreviewComponents,
): Promise<string> {
  const node = await createMdxPreviewRenderer(components)(source);
  return renderToStaticMarkup(node as ReactElement);
}

describe("createMdxPreviewRenderer", () => {
  it("renders components imported by the document", async () => {
    const html = await render(
      'import { Since } from "@/components/since";\n\n<Since version="1.2.3" />',
      {
        Since: ({ version }: { version: string }) => (
          <span>since {version}</span>
        ),
      },
    );

    expect(html).toContain("since 1.2.3");
  });

  it("renders components declared in the document itself", async () => {
    const html = await render(
      "export function Local() { return <em>inline</em> }\n\n<Local />",
    );

    expect(html).toContain("<em>inline</em>");
  });

  it("keeps local declarations sharing an ESM block with imports", async () => {
    const html = await render(
      'import { Since } from "@/components/since";\nexport function Local() { return <em>kept</em> }\n\n<Local />',
    );

    expect(html).toContain("<em>kept</em>");
  });

  it("renders a placeholder instead of failing on unresolved components", async () => {
    const html = await render(
      'import { Mystery } from "./mystery";\n\n<Mystery>body</Mystery>',
    );

    expect(html).toContain("Mystery");
    expect(html).toContain("body");
  });

  it("resolves unresolved components alongside markdown", async () => {
    const html = await render(
      "# Title\n\n<Mystery>body</Mystery>\n\n<Unknown.Group />",
    );

    expect(html).toContain("Title");
    expect(html).toContain("Mystery");
    expect(html).toContain("Unknown.Group");
    expect(html).toContain("body");
  });

  it("keeps import-looking code inside fences", async () => {
    const html = await render('```ts\nimport { Tabs } from "somewhere";\n```');

    expect(html).toContain("somewhere");
    expect(html).toContain("Tabs");
  });

  it("drops export-from statements and keeps local exports", async () => {
    const html = await render(
      'export { Card } from "fumadocs-ui/components/card";\nexport const answer = 42;\n\nThe answer is {answer}.',
    );

    expect(html).toContain("The answer is 42.");
  });

  it("accepts preset overrides", async () => {
    const node = await createMdxPreviewRenderer(undefined, {
      preset: { rehypeCodeOptions: false },
    })("```ts\nconst answer = 42;\n```");
    const html = renderToStaticMarkup(node as ReactElement);

    expect(html).toContain("language-ts");
    expect(html).not.toContain("--shiki-");
  });

  it("renders tabbed code fences as tabs", async () => {
    const source = [
      '```jsx tab="Next.js"',
      "export default function Layout() {}",
      "```",
      "",
      '```jsx tab="React Router"',
      "export function Layout() {}",
      "```",
    ].join("\n");

    const html = await render(source);

    expect(html).toContain('role="tablist"');
    expect(html).toContain("Next.js");
    expect(html).toContain("React Router");
    expect(html).toContain("Layout");
  });

  it("still reports syntax errors", async () => {
    await expect(render("<Unclosed>")).rejects.toThrow();
  });
});
