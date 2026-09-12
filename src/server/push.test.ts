import { describe, expect, it } from "vitest";
import { toRepoChange } from "./push";

describe("toRepoChange", () => {
  const contentDir = "apps/docs/content/docs";
  const publicDir = "apps/docs/public";

  it("prefixes public assets with the repository's public directory", () => {
    expect(
      toRepoChange(
        {
          type: "create",
          path: "docs/logo.png",
          content: "aGk=",
          encoding: "base64",
          base: "public",
        },
        contentDir,
        publicDir,
      ),
    ).toMatchObject({ type: "create", path: "apps/docs/public/docs/logo.png" });
  });

  it("prefixes page files with the content directory", () => {
    expect(
      toRepoChange(
        { type: "update", path: "guides/intro.mdx", content: "hi" },
        contentDir,
        publicDir,
      ),
    ).toMatchObject({ path: "apps/docs/content/docs/guides/intro.mdx" });
  });

  it("keeps both sides of a move in the same directory", () => {
    expect(
      toRepoChange(
        { type: "move", from: "a.mdx", to: "b.mdx" },
        contentDir,
        publicDir,
      ),
    ).toMatchObject({
      from: "apps/docs/content/docs/a.mdx",
      to: "apps/docs/content/docs/b.mdx",
    });
  });
});
