import { describe, expect, it } from "vitest";
import {
  collectRelativeMedia,
  mediaDisplayPath,
  publicMediaPath,
  publicMediaSrc,
  relativeMediaSrc,
  renderMediaTemplate,
  rewriteRelativeMedia,
  sanitizeMediaName,
  uniqueMediaName,
} from "./paths";
import { resolveMediaConfig } from "./types";

const config = resolveMediaConfig(undefined);

describe("media names", () => {
  it("sanitizes unsafe names", () => {
    expect(sanitizeMediaName("My Photo (1).PNG")).toBe("my-photo-1.png");
  });

  it("deduplicates names", () => {
    const existing = new Set(["photo.png", "photo-1.png"]);
    expect(uniqueMediaName(existing, "photo.png")).toBe("photo-2.png");
    expect(uniqueMediaName(existing, "other.png")).toBe("other.png");
  });
});

describe("media sources", () => {
  it("builds relative sources next to the page", () => {
    expect(relativeMediaSrc("guides/setup.mdx", "guides/photo.png")).toBe(
      "./photo.png",
    );
    expect(relativeMediaSrc("guides/setup.mdx", "photo.png")).toBe(
      "../photo.png",
    );
    expect(relativeMediaSrc("index.mdx", "media/photo.png")).toBe(
      "./media/photo.png",
    );
  });

  it("builds public sources without the public directory name", () => {
    expect(publicMediaSrc(config, "photo.png")).toBe("/photo.png");
    expect(publicMediaSrc(config, "themes/neutral.png")).toBe(
      "/themes/neutral.png",
    );
  });

  it("uploads to the first configured folder unless told otherwise", () => {
    const scoped = resolveMediaConfig({ publicFolders: ["", "docs"] });
    expect(publicMediaPath(scoped, "photo.png")).toBe("photo.png");
    expect(publicMediaPath(scoped, "photo.png", "docs")).toBe("docs/photo.png");
  });

  it("keeps hand-typed destinations inside public", () => {
    expect(publicMediaPath(config, "photo.png", "guides/images")).toBe(
      "guides/images/photo.png",
    );
    expect(publicMediaPath(config, "photo.png", "/guides/")).toBe(
      "guides/photo.png",
    );
    expect(publicMediaPath(config, "photo.png", "../../outside")).toBe(
      "outside/photo.png",
    );
    expect(publicMediaPath(config, "photo.png", "")).toBe("photo.png");
  });

  it("renders insert templates", () => {
    expect(
      renderMediaTemplate(config.insertTemplate, {
        alt: "Photo",
        src: "./photo.png",
        name: "photo.png",
      }),
    ).toBe("![Photo](./photo.png)");
  });

  it("displays public paths with a prefix", () => {
    expect(mediaDisplayPath("public", "photo.png")).toBe("public/photo.png");
    expect(mediaDisplayPath("public", "photo.png", "static")).toBe(
      "static/photo.png",
    );
    expect(mediaDisplayPath("content", "photo.png")).toBe("photo.png");
  });
});

describe("relative media references", () => {
  const source = [
    "# Title",
    "![one](./one.png)",
    `<img src="../shared/two.png" alt="two" />`,
    "![external](https://example.com/three.png)",
    "![absolute](/four.png)",
  ].join("\n");

  it("collects only relative references", () => {
    expect(collectRelativeMedia(source, "guides/page.mdx")).toEqual([
      { raw: "./one.png", path: "guides/one.png" },
      { raw: "../shared/two.png", path: "shared/two.png" },
    ]);
  });

  it("rewrites relative references and keeps the rest", () => {
    const rewritten = rewriteRelativeMedia(
      source,
      "guides/page.mdx",
      (path) => `https://cdn.test/${path}`,
    );
    expect(rewritten).toContain("![one](https://cdn.test/guides/one.png)");
    expect(rewritten).toContain('src="https://cdn.test/shared/two.png"');
    expect(rewritten).toContain("https://example.com/three.png");
    expect(rewritten).toContain("![absolute](/four.png)");
  });
});
