export interface MdxComponentImport {
  specifiers: string[];
  source: string;
}

export interface MdxComponentHint {
  name: string;
  snippet: string;
  description?: string;
  import?: MdxComponentImport;
}

export interface ImportEdit {
  from: number;
  to: number;
  insert: string;
}

export const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export const defaultComponentHints: MdxComponentHint[] = [
  {
    name: "Callout",
    description: "Fumadocs callout",
    snippet: '<Callout type="info" title="Note">\n  ${}\n</Callout>',
  },
  {
    name: "Cards",
    description: "Card grid",
    snippet: '<Cards>\n  <Card title="Card" href="/" />\n  ${}\n</Cards>',
  },
  {
    name: "Card",
    description: "Single card",
    snippet: '<Card title="Card" href="/" />',
  },
  {
    name: "CodeBlockTabs",
    description: "Tabs of code blocks",
    snippet:
      '<CodeBlockTabs defaultValue="npm">\n  <CodeBlockTabsList>\n    <CodeBlockTabsTrigger value="npm">npm</CodeBlockTabsTrigger>\n  </CodeBlockTabsList>\n  <CodeBlockTab value="npm">\n    ```bash\n    ${}\n    ```\n  </CodeBlockTab>\n</CodeBlockTabs>',
  },
  {
    name: "Tabs",
    description: "Fumadocs tabs",
    import: {
      specifiers: ["Tabs", "Tab"],
      source: "fumadocs-ui/components/tabs",
    },
    snippet:
      '<Tabs items={["Tab 1", "Tab 2"]}>\n  <Tab value="Tab 1">\n    ${}\n  </Tab>\n  <Tab value="Tab 2">\n    ...\n  </Tab>\n</Tabs>',
  },
  {
    name: "Files",
    description: "File tree",
    import: {
      specifiers: ["Files", "File", "Folder"],
      source: "fumadocs-ui/components/files",
    },
    snippet:
      '<Files>\n  <Folder name="src" defaultOpen>\n    <File name="index.ts" />\n  </Folder>\n  ${}\n</Files>',
  },
  {
    name: "Steps",
    description: "Numbered steps",
    import: {
      specifiers: ["Steps", "Step"],
      source: "fumadocs-ui/components/steps",
    },
    snippet: "<Steps>\n  <Step>\n    ${}\n  </Step>\n</Steps>",
  },
  {
    name: "Accordions",
    description: "Accordion group",
    import: {
      specifiers: ["Accordion", "Accordions"],
      source: "fumadocs-ui/components/accordion",
    },
    snippet:
      '<Accordions>\n  <Accordion title="Title">\n    ${}\n  </Accordion>\n</Accordions>',
  },
  {
    name: "Banner",
    description: "Top banner",
    import: {
      specifiers: ["Banner"],
      source: "fumadocs-ui/components/banner",
    },
    snippet: '<Banner id="banner-id">\n  ${}\n</Banner>',
  },
  {
    name: "InlineTOC",
    description: "Inline table of contents",
    import: {
      specifiers: ["InlineTOC"],
      source: "fumadocs-ui/components/inline-toc",
    },
    snippet: "<InlineTOC />",
  },
  {
    name: "ImageZoom",
    description: "Zoomable image",
    import: {
      specifiers: ["ImageZoom"],
      source: "fumadocs-ui/components/image-zoom",
    },
    snippet: '<ImageZoom src="/image.png" alt="Image" />',
  },
  {
    name: "DynamicCodeBlock",
    description: "Highlighted code block",
    import: {
      specifiers: ["DynamicCodeBlock"],
      source: "fumadocs-ui/components/dynamic-codeblock",
    },
    snippet: '<DynamicCodeBlock lang="ts" code={`const x = 1;`} />',
  },
  {
    name: "TypeTable",
    description: "API type table",
    import: {
      specifiers: ["TypeTable"],
      source: "fumadocs-ui/components/type-table",
    },
    snippet:
      '<TypeTable\n  type={{\n    name: {\n      description: "${1:description}",\n      type: "string",\n    },\n  }}\n/>',
  },
];

export function planImportEdit(
  doc: string,
  hint: MdxComponentImport,
): ImportEdit | null {
  const escapedSource = hint.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escapedSource}['"]\\s*;?`,
  ).exec(doc);

  if (existing) {
    const specifiers = (existing[1] ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const missing = hint.specifiers.filter(
      (specifier) => !specifiers.includes(specifier),
    );
    if (missing.length === 0) return null;

    const start = existing.index;
    return {
      from: start,
      to: start + existing[0].length,
      insert: `import { ${[...specifiers, ...missing].join(", ")} } from "${hint.source}";`,
    };
  }

  const statement = `import { ${hint.specifiers.join(", ")} } from "${hint.source}";\n`;
  const insertion = importInsertionPoint(doc);
  return { from: insertion, to: insertion, insert: `${statement}\n` };
}

export function importInsertionPoint(doc: string): number {
  const frontmatter = FRONTMATTER_PATTERN.exec(doc);
  if (frontmatter) return frontmatter[0].length;

  const imports = [...doc.matchAll(/^import\s.+\n/gm)];
  const last = imports[imports.length - 1];
  if (last?.index !== undefined) return last.index + last[0].length;

  return 0;
}
