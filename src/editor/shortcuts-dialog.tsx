"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useFumadocsEditor } from "./context";
import {
  formatShortcutKey,
  getEditorShortcuts,
  isMacPlatform,
  shortcutSearchText,
} from "./shortcuts";

export interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const { canFormat } = useFumadocsEditor();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isMac = useMemo(() => isMacPlatform(), []);
  const shortcuts = useMemo(
    () => getEditorShortcuts({ canFormat }),
    [canFormat],
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return shortcuts;
    return shortcuts.filter((shortcut) =>
      shortcutSearchText(shortcut, isMac).includes(search),
    );
  }, [shortcuts, query, isMac]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fde-palette-backdrop" />
        <Dialog.Popup
          className="fde-palette"
          aria-describedby={undefined}
          initialFocus={() => inputRef.current}
        >
          <Dialog.Title className="fde-palette-title">
            Keyboard shortcuts
          </Dialog.Title>
          <div className="fde-palette-header">
            <Search size={14} />
            <input
              ref={inputRef}
              className="fde-palette-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search shortcuts…"
              aria-label="Search shortcuts"
            />
            <button
              type="button"
              className="fde-button fde-palette-close"
              onClick={() => onOpenChange(false)}
            >
              ESC
            </button>
          </div>
          <div className="fde-palette-list">
            {filtered.map((shortcut) => (
              <div className="fde-palette-item" key={shortcut.id}>
                <span className="fde-palette-label">{shortcut.label}</span>
                <span className="fde-palette-keys">
                  {shortcut.keys.map((key) => (
                    <kbd className="fde-kbd" key={key}>
                      {formatShortcutKey(key, isMac)}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
            {filtered.length === 0 ? (
              <div className="fde-palette-empty">No shortcuts found</div>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
