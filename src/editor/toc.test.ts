import { describe, expect, it } from "vitest";
import { sourceToc } from "./toc";

describe("sourceToc", () => {
  it("collects headings and skips frontmatter and code fences", () => {
    const source = [
      "---",
      "title: Not a heading",
      "---",
      "",
      "# Getting Started",
      "",
      "```md",
      "## Inside a fence",
      "```",
      "",
      "## Install `the` **package**",
      "### [Deep](https://x.dev) link",
    ].join("\n");

    expect(sourceToc(source)).toEqual([
      { title: "Getting Started", url: "#getting-started", depth: 1 },
      { title: "Install the package", url: "#install-the-package", depth: 2 },
      { title: "Deep link", url: "#deep-link", depth: 3 },
    ]);
  });

  it("returns nothing for a source without headings", () => {
    expect(sourceToc("just a paragraph")).toEqual([]);
  });
});
