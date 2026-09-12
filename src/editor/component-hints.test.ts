import { describe, expect, it } from "vitest";
import {
  defaultComponentHints,
  importInsertionPoint,
  type MdxComponentImport,
  planImportEdit,
} from "./component-hints";

const TABS: MdxComponentImport = {
  specifiers: ["Tabs", "Tab"],
  source: "fumadocs-ui/components/tabs",
};

describe("importInsertionPoint", () => {
  it("inserts at the top without frontmatter or imports", () => {
    expect(importInsertionPoint("# Title\n\ntext")).toBe(0);
  });

  it("inserts after frontmatter", () => {
    const doc = "---\ntitle: X\n---\n\n# Title\n";
    expect(importInsertionPoint(doc)).toBe("---\ntitle: X\n---\n".length);
  });

  it("inserts after existing imports", () => {
    const doc = 'import { A } from "a";\nimport { B } from "b";\n\n# T\n';
    expect(importInsertionPoint(doc)).toBe(doc.indexOf("\n\n# T") + 1);
  });
});

describe("planImportEdit", () => {
  it("adds an import statement", () => {
    const edit = planImportEdit("# Title\n", TABS);
    expect(edit).toEqual({
      from: 0,
      to: 0,
      insert: 'import { Tabs, Tab } from "fumadocs-ui/components/tabs";\n\n',
    });
  });

  it("merges missing specifiers into an existing import", () => {
    const doc = 'import { Tabs } from "fumadocs-ui/components/tabs";\n\n# T\n';
    const edit = planImportEdit(doc, TABS);
    expect(edit?.insert).toBe(
      'import { Tabs, Tab } from "fumadocs-ui/components/tabs";',
    );
  });

  it("returns null when the import already contains every specifier", () => {
    const doc = 'import { Tabs, Tab } from "fumadocs-ui/components/tabs";\n';
    expect(planImportEdit(doc, TABS)).toBeNull();
  });
});

describe("defaultComponentHints", () => {
  it("has unique names and snippets", () => {
    const names = defaultComponentHints.map((hint) => hint.name);
    expect(new Set(names).size).toBe(names.length);
    for (const hint of defaultComponentHints) {
      expect(hint.snippet.length).toBeGreaterThan(0);
    }
  });

  it("declares imports for optional Fumadocs components", () => {
    const tabs = defaultComponentHints.find((hint) => hint.name === "Tabs");
    expect(tabs?.import?.source).toBe("fumadocs-ui/components/tabs");
  });
});
