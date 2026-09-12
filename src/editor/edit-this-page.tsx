"use client";

import { Link } from "fumadocs-core/framework";
import { Pencil } from "lucide-react";
import { useFumadocsEditor } from "./context";

export interface EditThisPageProps {
  path: string;
  title?: string;
  label?: string;
  className?: string;
}

export function EditThisPage({
  path,
  label = "Edit this page",
  className,
}: EditThisPageProps) {
  const { editorHref } = useFumadocsEditor();

  return (
    <Link
      href={editorHref(path)}
      className={className ? `fde-edit-button ${className}` : "fde-edit-button"}
    >
      <Pencil size={14} />
      {label}
    </Link>
  );
}
