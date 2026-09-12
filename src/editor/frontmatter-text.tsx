"use client";

import { type ReactNode, useMemo } from "react";
import { useFumadocsEditor } from "./context";
import { parseSource } from "./frontmatter";

export function useFrontmatter(): Record<string, unknown> {
  const { document } = useFumadocsEditor();
  const source = document?.current ?? "";
  return useMemo(() => parseSource(source).frontmatter, [source]);
}

export interface FrontmatterTextProps {
  name: string;
  children?: ReactNode;
}

export function FrontmatterText({ name, children }: FrontmatterTextProps) {
  const { document } = useFumadocsEditor();
  const frontmatter = useFrontmatter();

  if (!document) return <>{children}</>;

  const value = frontmatter[name];
  if (typeof value === "string" || typeof value === "number") {
    return <>{String(value)}</>;
  }

  return <>{children}</>;
}
