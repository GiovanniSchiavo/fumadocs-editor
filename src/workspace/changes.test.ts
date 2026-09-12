import { describe, expect, it } from "vitest";
import type { ContentModel } from "../content/model";
import {
  applyChanges,
  collapseChanges,
  retargetChanges,
  statusesFromChanges,
} from "./changes";

const BASE: ContentModel = {
  files: ["index.mdx"],
  metas: { "meta.json": { pages: ["index"] } },
  media: [],
};

describe("binary changes", () => {
  it("adds media without touching the page tree", () => {
    const model = applyChanges(BASE, [
      {
        type: "create",
        path: "photo.png",
        content: "aGVsbG8=",
        encoding: "base64",
      },
    ]);

    expect(model.media).toEqual(["photo.png"]);
    expect(model.files).toEqual(["index.mdx"]);
  });

  it("moves and deletes media", () => {
    const created = applyChanges(BASE, [
      {
        type: "create",
        path: "photo.png",
        content: "aGVsbG8=",
        encoding: "base64",
      },
    ]);

    const moved = applyChanges(created, [
      { type: "move", from: "photo.png", to: "guides/photo.png" },
    ]);
    expect(moved.media).toEqual(["guides/photo.png"]);

    const deleted = applyChanges(moved, [
      { type: "delete", path: "guides/photo.png" },
    ]);
    expect(deleted.media).toEqual([]);
  });

  it("ignores public changes for the content model", () => {
    const changes: Parameters<typeof applyChanges>[1] = [
      {
        type: "create",
        path: "media/photo.png",
        content: "aGVsbG8=",
        encoding: "base64",
        base: "public",
      },
    ];
    const model = applyChanges(BASE, changes);

    expect(model.media).toEqual([]);
    expect(statusesFromChanges(changes)).toEqual({
      "media/photo.png": "new",
    });
  });
});

describe("statuses", () => {
  it("maps changes to statuses", () => {
    expect(
      statusesFromChanges([
        { type: "create", path: "a.mdx", content: "" },
        { type: "update", path: "b.mdx", content: "" },
        { type: "delete", path: "c.mdx" },
        { type: "move", from: "d.mdx", to: "e.mdx" },
      ]),
    ).toEqual({
      "a.mdx": "new",
      "b.mdx": "modified",
      "c.mdx": "deleted",
      "e.mdx": "renamed",
    });
  });
});

describe("retargetChanges", () => {
  it("moves draft changes to the new path", () => {
    const changes = retargetChanges(
      [
        { type: "update", path: "basic.mdx", content: "x" },
        {
          type: "create",
          path: "photo.png",
          content: "aGk=",
          encoding: "base64",
        },
      ],
      [
        { from: "basic.mdx", to: "guides/basic.mdx" },
        { from: "photo.png", to: "guides/photo.png" },
      ],
    );

    expect(changes).toEqual([
      { type: "update", path: "guides/basic.mdx", content: "x" },
      {
        type: "create",
        path: "guides/photo.png",
        content: "aGk=",
        encoding: "base64",
      },
    ]);
  });

  it("follows chained moves without looping", () => {
    const changes = retargetChanges(
      [{ type: "update", path: "a.mdx", content: "x" }],
      [
        { from: "a.mdx", to: "b.mdx" },
        { from: "b.mdx", to: "c.mdx" },
        { from: "c.mdx", to: "a.mdx" },
      ],
    );

    const first = changes[0];
    expect(first?.type === "update" ? first.path : first?.type).toBe("a.mdx");
  });
});

describe("collapseChanges", () => {
  it("drops a create cancelled by a delete", () => {
    expect(
      collapseChanges([
        { type: "create", path: "guides/new.mdx", content: "a" },
        { type: "update", path: "guides/new.mdx", content: "b" },
        { type: "delete", path: "guides/new.mdx" },
      ]),
    ).toEqual([]);
  });

  it("follows moves back to the created name", () => {
    expect(
      collapseChanges([
        { type: "create", path: "a.mdx", content: "a" },
        { type: "move", from: "a.mdx", to: "b.mdx" },
        { type: "delete", path: "b.mdx" },
      ]),
    ).toEqual([]);
  });

  it("keeps deletes of files that exist in the repository", () => {
    expect(
      collapseChanges([
        { type: "update", path: "index.mdx", content: "a" },
        { type: "delete", path: "index.mdx" },
      ]),
    ).toEqual([{ type: "delete", path: "index.mdx" }]);
  });

  it("deletes a moved repository file under its original name", () => {
    expect(
      collapseChanges([
        { type: "move", from: "index.mdx", to: "home.mdx" },
        { type: "delete", path: "home.mdx" },
      ]),
    ).toEqual([{ type: "delete", path: "index.mdx" }]);
  });

  it("leaves unrelated changes alone", () => {
    const changes: Parameters<typeof collapseChanges>[0] = [
      { type: "create", path: "one.mdx", content: "a" },
      { type: "create", path: "two.mdx", content: "b" },
      { type: "delete", path: "two.mdx" },
    ];
    expect(collapseChanges(changes)).toEqual([
      { type: "create", path: "one.mdx", content: "a" },
    ]);
  });
});
