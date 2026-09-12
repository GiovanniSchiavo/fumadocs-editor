import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm"],
  dts: true,
  sourcemap: true,
  target: "es2022",
  external: ["react", "react-dom", "prettier"],
};

export default defineConfig([
  {
    ...shared,
    entry: { index: "src/index.ts" },
    clean: true,
    banner: { js: '"use client";' },
  },
  {
    ...shared,
    entry: {
      format: "src/format.ts",
      "server/index": "src/server/index.ts",
      "github/index": "src/github/index.ts",
    },
  },
]);
