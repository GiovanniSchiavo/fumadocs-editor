export interface EditorShortcut {
  id: string;
  label: string;
  keys: string[];
}

export function getEditorShortcuts(options: {
  canFormat: boolean;
}): EditorShortcut[] {
  const shortcuts: EditorShortcut[] = [
    { id: "submit", label: "Submit changes", keys: ["Mod", "S"] },
    { id: "undo", label: "Undo", keys: ["Mod", "Z"] },
    { id: "redo", label: "Redo", keys: ["Shift", "Mod", "Z"] },
    { id: "bold", label: "Bold", keys: ["Mod", "B"] },
    { id: "italic", label: "Italic", keys: ["Mod", "I"] },
    { id: "inline-code", label: "Inline code", keys: ["Mod", "E"] },
    { id: "link", label: "Link", keys: ["Mod", "K"] },
    {
      id: "strikethrough",
      label: "Strikethrough",
      keys: ["Shift", "Mod", "X"],
    },
    { id: "code-block", label: "Code block", keys: ["Mod", "Alt", "C"] },
  ];

  if (options.canFormat) {
    shortcuts.push({
      id: "format",
      label: "Format document",
      keys: ["Shift", "Alt", "F"],
    });
  }

  shortcuts.push({
    id: "shortcuts",
    label: "Keyboard shortcuts",
    keys: ["Shift", "Mod", "H"],
  });

  return shortcuts;
}

const MAC_KEYS: Record<string, string> = {
  Mod: "⌘",
  Shift: "⇧",
  Alt: "⌥",
  Ctrl: "⌃",
  Tab: "⇥",
  Enter: "↵",
  Escape: "Esc",
};

const DEFAULT_KEYS: Record<string, string> = {
  Mod: "Ctrl",
  Shift: "Shift",
  Alt: "Alt",
  Ctrl: "Ctrl",
  Tab: "Tab",
  Enter: "Enter",
  Escape: "Esc",
};

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const source = navigator.platform || navigator.userAgent;
  return /Mac|iPhone|iPad|iPod/.test(source);
}

export function formatShortcutKey(key: string, isMac: boolean): string {
  const map = isMac ? MAC_KEYS : DEFAULT_KEYS;
  return map[key] ?? key.toUpperCase();
}

export function shortcutSearchText(
  shortcut: EditorShortcut,
  isMac: boolean,
): string {
  return [
    shortcut.label,
    ...shortcut.keys,
    ...shortcut.keys.map((key) => formatShortcutKey(key, isMac)),
  ]
    .join(" ")
    .toLowerCase();
}
