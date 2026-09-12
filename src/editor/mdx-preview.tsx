"use client";

import { evaluate } from "@mdx-js/mdx";
import {
  type MDXRuntimePresetOptions,
  mdxPreset,
} from "fumadocs-core/content/mdx/preset-runtime";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { ComponentType, ImgHTMLAttributes, ReactNode } from "react";
import * as runtime from "react/jsx-runtime";

export type EditorPreviewComponents = Record<string, unknown>;
export type EditorRenderPreview = (source: string) => Promise<ReactNode>;

export interface MdxPreviewRendererOptions {
  /**
   * Extra Fumadocs MDX preset options merged over the preview defaults.
   * `remarkPlugins` and `outputFormat` are managed by the renderer.
   */
  preset?: Omit<MDXRuntimePresetOptions, "remarkPlugins" | "outputFormat">;
}

interface MdxEsmStatement {
  type?: string;
  source?: unknown;
  start?: number;
  end?: number;
}

interface MdxTree {
  children?: Array<{
    type?: string;
    value?: string;
    data?: { estree?: { body?: MdxEsmStatement[] } };
  }>;
}

function isExecutableEsm(statement: MdxEsmStatement): boolean {
  return (
    statement.type === "ImportDeclaration" ||
    statement.type === "ExportAllDeclaration" ||
    (statement.type === "ExportNamedDeclaration" && statement.source != null)
  );
}

/**
 * The preview evaluates MDX in the browser, where `import` and `export … from`
 * cannot resolve to modules on disk. The names they bind still resolve through
 * the components map passed to the renderer, so the statements are dropped
 * while local declarations are kept.
 */
export function remarkStripMdxImports() {
  return (tree: MdxTree) => {
    if (!Array.isArray(tree.children)) return;

    tree.children = tree.children.flatMap((node) => {
      if (node.type !== "mdxjsEsm") return [node];

      const statements = node.data?.estree?.body;
      if (!statements?.length) return [node];

      const kept = statements.filter(
        (statement) => !isExecutableEsm(statement),
      );
      if (kept.length === statements.length) return [node];
      if (kept.length === 0) return [];

      const value = node.value ?? "";
      node.value = kept
        .map(({ start = 0, end = value.length }) => value.slice(start, end))
        .join("\n");
      if (node.data?.estree) node.data.estree.body = kept;
      return [node];
    });
  };
}

function PreviewImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <img {...props} alt={props.alt ?? ""} />;
}

interface UnresolvedProps {
  children?: ReactNode;
}

function unresolvedComponent(name: string): ComponentType<UnresolvedProps> {
  function UnresolvedPreviewComponent({ children }: UnresolvedProps) {
    return (
      <span className="fde-preview-unresolved" data-fde-component={name}>
        {children}
      </span>
    );
  }

  // Member expressions (<Foo.Bar />) pass through to another placeholder.
  return new Proxy(UnresolvedPreviewComponent, {
    get(target, property, receiver) {
      if (typeof property === "string" && /^[A-Z]/.test(property)) {
        return unresolvedComponent(`${name}.${property}`);
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

function collectComponentNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/<\/?([A-Z][\w$]*)/g)) {
    const name = match[1];
    if (name) names.add(name);
  }
  return names;
}

/**
 * A document can reference components that the host has not registered, or
 * that only exist after the build resolves an import. Rendering those as a
 * visible placeholder keeps the rest of the preview alive. Names are read from
 * the source because MDX copies the components map before resolving them,
 * which hides keys that only a proxy would provide.
 */
function withUnresolvedComponents(
  components: EditorPreviewComponents,
  source: string,
): EditorPreviewComponents {
  const resolved = { ...components };

  for (const name of collectComponentNames(source)) {
    if (!(name in resolved)) resolved[name] = unresolvedComponent(name);
  }

  return resolved;
}

export function createMdxPreviewRenderer(
  extraComponents?: EditorPreviewComponents,
  options?: MdxPreviewRendererOptions,
): EditorRenderPreview {
  const baseComponents: EditorPreviewComponents = {
    ...defaultMdxComponents,
    ...extraComponents,
    img: PreviewImage,
  };
  const preset = options?.preset;

  return async function renderPreview(source) {
    const components = withUnresolvedComponents(baseComponents, source);
    const module = await evaluate(source, {
      ...(await mdxPreset({
        // The image plugin reads from disk (node:path/fs) and cannot run in
        // the browser; the preview panel already rewrites relative media.
        remarkImageOptions: false,
        ...preset,
        remarkPlugins: [remarkStripMdxImports],
      })),
      ...runtime,
    });

    const MDXContent = module.default as ComponentType<{
      components?: EditorPreviewComponents;
    }>;

    return <MDXContent components={components} />;
  };
}
