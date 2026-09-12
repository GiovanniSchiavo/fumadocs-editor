"use client";

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import { Search, Smile } from "lucide-react";
import { DynamicIcon, type IconName, iconNames } from "lucide-react/dynamic";
import {
  type ComponentType,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";

/** Icons offered before the user searches — the usual documentation suspects. */
const COMMON = [
  "book-open",
  "rocket",
  "file-text",
  "folder",
  "settings",
  "zap",
  "shield",
  "terminal",
  "code",
  "database",
  "cloud",
  "key",
  "users",
  "puzzle",
  "globe",
  "package",
  "wrench",
  "lightbulb",
  "flag",
  "layers",
  "play",
  "git-branch",
  "plug",
  "circle-help",
  "triangle-alert",
  "sparkles",
  "download",
  "link",
  "lock",
  "star",
  "tag",
  "bug",
] as IconName[];

/** `FileText` (the Fumadocs meta convention) -> `file-text` (the Lucide name). */
export function iconSlug(name: string | undefined): IconName | undefined {
  if (!name) return undefined;
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Za-z])(\d)/g, "$1-$2")
    .toLowerCase() as IconName;
}

/** `file-text` -> `FileText`, the form Fumadocs looks up in `lucide-react`. */
export function iconComponentName(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function NodeIcon({
  name,
  fallback: Fallback,
  size = 14,
}: {
  name?: string;
  fallback?: ComponentType<{ size?: number }>;
  size?: number;
}) {
  const slug = iconSlug(name);
  if (!slug) return Fallback ? <Fallback size={size} /> : null;
  return (
    <DynamicIcon
      name={slug}
      size={size}
      fallback={() => (Fallback ? <Fallback size={size} /> : null)}
    />
  );
}

export function IconPicker({
  value,
  onChange,
  className = "fde-tree-menu-trigger",
  label = "Choose icon",
  align = "end",
  children,
}: {
  value?: string;
  onChange: (icon: string | undefined) => void;
  className?: string;
  label?: string;
  align?: "start" | "end";
  children?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase().replace(/\s+/g, "-");
    if (!normalized) return COMMON;
    return iconNames.filter((name) => name.includes(normalized)).slice(0, 60);
  }, [query]);

  return (
    <Popover
      onOpenChange={(open) =>
        open && requestAnimationFrame(() => inputRef.current?.focus())
      }
    >
      <PopoverTrigger className={className} title={label} aria-label={label}>
        <NodeIcon name={value} fallback={Smile} />
        {children}
      </PopoverTrigger>
      <PopoverContent className="fde-icon-popover" align={align}>
        <label className="fde-sidebar-search">
          <Search size={14} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search icons"
            aria-label="Search icons"
          />
        </label>
        <div className="fde-icon-grid">
          {matches.map((name) => (
            <PopoverClose
              key={name}
              className="fde-icon-option"
              title={name}
              aria-label={name}
              data-active={iconSlug(value) === name}
              onClick={() => onChange(iconComponentName(name))}
            >
              <DynamicIcon name={name} size={16} />
            </PopoverClose>
          ))}
          {matches.length === 0 ? (
            <p className="fde-icon-empty">No icons match “{query}”.</p>
          ) : null}
        </div>
        <PopoverClose
          className="fde-button"
          disabled={!value}
          onClick={() => onChange(undefined)}
        >
          Remove icon
        </PopoverClose>
      </PopoverContent>
    </Popover>
  );
}
