import type { EditorFormatter } from "./types";

interface PrettierModule {
  format: (source: string, options: Record<string, unknown>) => Promise<string>;
}

type PluginModule = { default?: unknown } | unknown;

function unwrapPlugin(module: PluginModule): unknown {
  return (module as { default?: unknown }).default ?? module;
}

export const prettierFormatter: EditorFormatter = async ({ source }) => {
  const [prettier, markdown, yaml, babel, estree, typescript] =
    await Promise.all([
      import("prettier/standalone"),
      import("prettier/plugins/markdown"),
      import("prettier/plugins/yaml"),
      import("prettier/plugins/babel"),
      import("prettier/plugins/estree"),
      import("prettier/plugins/typescript"),
    ]);

  const { format } = prettier as unknown as PrettierModule;

  return format(source, {
    parser: "mdx",
    plugins: [markdown, yaml, babel, estree, typescript].map(unwrapPlugin),
    proseWrap: "preserve",
    tabWidth: 2,
  });
};
