export const editorStyles = `
:root {
  --fde-bg: var(--color-fd-background, #ffffff);
  --fde-fg: var(--color-fd-foreground, #0a0a0a);
  --fde-card: var(--color-fd-card, #ffffff);
  --fde-muted: var(--color-fd-muted, #f4f4f5);
  --fde-muted-fg: var(--color-fd-muted-foreground, #71717a);
  --fde-border: var(--color-fd-border, #e4e4e7);
  --fde-accent: var(--color-fd-accent, #f4f4f5);
  --fde-accent-fg: var(--color-fd-accent-foreground, #18181b);
  --fde-secondary: var(--color-fd-secondary, #f4f4f5);
  --fde-secondary-fg: var(--color-fd-secondary-foreground, #18181b);
  --fde-popover: var(--color-fd-popover, #ffffff);
  --fde-popover-fg: var(--color-fd-popover-foreground, #0a0a0a);
  --fde-overlay: var(--color-fd-overlay, rgba(0, 0, 0, 0.45));
  --fde-ring: var(--color-fd-ring, #a1a1aa);
  --fde-primary: var(--color-fd-primary, #18181b);
  --fde-primary-fg: var(--color-fd-primary-foreground, #fafafa);
  --fde-success: var(--color-fd-success, #16a34a);
  --fde-warning: var(--color-fd-warning, #d97706);
  --fde-error: var(--color-fd-error, #dc2626);
  --fde-diff-add: var(--color-fd-diff-add, rgba(22, 163, 74, 0.14));
  --fde-diff-remove: var(--color-fd-diff-remove, rgba(220, 38, 38, 0.12));
  --fde-radius: 6px;
  --fde-syn-heading: var(--color-fd-primary, #18181b);
  --fde-syn-link: var(--color-fd-info, #2563eb);
  --fde-syn-code: var(--color-fd-warning, #d97706);
  --fde-syn-quote: var(--color-fd-muted-foreground, #71717a);
  --fde-syn-list: var(--color-fd-error, #dc2626);
  --fde-syn-meta: var(--color-fd-muted-foreground, #71717a);
  --fde-syn-keyword: var(--color-fd-error, #dc2626);
  --fde-syn-string: var(--color-fd-success, #16a34a);
  --fde-syn-number: var(--color-fd-info, #2563eb);
  --fde-syn-comment: var(--color-fd-muted-foreground, #71717a);
  --fde-syn-func: var(--color-fd-warning, #d97706);
  --fde-syn-type: var(--color-fd-info, #2563eb);
  --fde-syn-attr: var(--color-fd-info, #2563eb);
  --fde-syn-var: var(--color-fd-warning, #d97706);
  --fde-syn-tag: var(--color-fd-success, #16a34a);
  --fde-syn-punct: var(--color-fd-muted-foreground, #71717a);
  --fde-selection: color-mix(
    in srgb,
    var(--color-fd-info, #2563eb) 35%,
    var(--color-fd-background, #ffffff)
  );
  --fde-selection-match: color-mix(
    in srgb,
    var(--color-fd-warning, #d97706) 40%,
    var(--color-fd-background, #ffffff)
  );
}

[class^='fde-'],
[class*=' fde-'] {
  box-sizing: border-box;
}

.fde-button,
.fde-edit-button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--fde-border);
  border-radius: var(--fde-radius);
  background: var(--fde-secondary);
  color: var(--fde-secondary-fg);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  padding: 6px 8px;
  cursor: pointer;
  transition:
    background-color 100ms,
    color 100ms;
}

.fde-button:hover,
.fde-edit-button:hover {
  background: var(--fde-accent);
  color: var(--fde-accent-fg);
}

.fde-button:focus-visible,
.fde-edit-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--fde-ring);
}

.fde-button:disabled,
.fde-edit-button:disabled {
  opacity: 0.5;
  pointer-events: none;
}

.fde-edit-button:disabled {
  cursor: progress;
}

.fde-button-primary {
  background: var(--fde-primary);
  border-color: var(--fde-primary);
  color: var(--fde-primary-fg);
}

.fde-button-primary:hover {
  background: color-mix(in srgb, var(--fde-primary) 80%, transparent);
  color: var(--fde-primary-fg);
}

.fde-mode-button {
  min-width: 96px;
}

.fde-format-button {
  min-width: 92px;
}

.fde-icon-button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--fde-border);
  background: var(--fde-secondary);
  color: var(--fde-secondary-fg);
  padding: 0;
  border-radius: var(--fde-radius);
  cursor: pointer;
  transition:
    background-color 100ms,
    color 100ms;
}

.fde-icon-button:hover {
  background: var(--fde-accent);
  color: var(--fde-accent-fg);
}

.fde-icon-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--fde-ring);
}

.fde-icon-button:disabled {
  opacity: 0.5;
  pointer-events: none;
}

.fde-toolbar {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-inline-start: auto;
}

.fde-dirty {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--fde-muted-fg);
  display: inline-block;
}

.fde-dirty[data-dirty='true'] {
  background: var(--fde-primary);
}

.fde-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  max-width: 420px;
}

.fde-status[data-kind='error'] {
  color: var(--fde-error);
}

.fde-status[data-kind='success'] {
  color: var(--fde-success);
}

.fde-status a {
  color: inherit;
  text-decoration: underline;
}

.fde-status-dismiss {
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  line-height: 1;
  padding: 2px;
}

.fde-editor {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  border: 1px solid var(--fde-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--fde-muted) 25%, transparent);
  overflow: hidden;
}

.fde-editor:focus-within {
  border-color: color-mix(
    in srgb,
    var(--fde-primary) 30%,
    var(--fde-border)
  );
}

.fde-editor .cm-editor {
  height: 100%;
}

.fde-preview {
  height: 100%;
  min-height: 320px;
  overflow: auto;
}

.fde-preview-unresolved {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  max-width: 100%;
  padding: 4px 8px;
  border: 1px dashed var(--fde-border);
  border-radius: 8px;
  vertical-align: top;
}

.fde-preview-unresolved::before {
  content: attr(data-fde-component);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  letter-spacing: 0.02em;
  color: var(--fde-muted-fg);
}

.fde-diff {
  border: 1px solid var(--fde-border);
  border-radius: 12px;
  height: 100%;
  min-height: 320px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.6;
  padding: 12px 0;
}

.fde-diff-line {
  display: flex;
  white-space: pre-wrap;
  word-break: break-word;
}

.fde-diff-gutter {
  flex: none;
  width: 44px;
  padding: 0 10px 0 0;
  text-align: right;
  color: var(--fde-muted-fg);
  user-select: none;
}

.fde-diff-value {
  flex: 1;
  padding: 0 16px;
}

.fde-diff-line[data-type='add'] {
  background: var(--fde-diff-add);
}

.fde-diff-line[data-type='remove'] {
  background: var(--fde-diff-remove);
}

.fde-diff-empty {
  padding: 24px;
  color: var(--fde-muted-fg);
}

.fde-split {
  display: flex;
  align-items: stretch;
  height: 100%;
  min-height: 320px;
}

#nd-page:has(.fde-split) {
  max-width: var(--fde-split-max-width, 1400px);
}

/* Only the table of contents gives up its room; widening the layout itself
   would shift the sidebar between views. */
#nd-docs-layout:has(#nd-page .fde-split) {
  --fd-toc-width: 0px;
}

#nd-docs-layout:has(#nd-page .fde-split) #nd-toc,
#nd-docs-layout:has(#nd-page .fde-split) #nd-toc-placeholder {
  display: none;
}

.fde-split[data-dragging='true'] {
  cursor: col-resize;
}

.fde-split-pane {
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.fde-split-pane-last {
  flex: 1;
}

.fde-split-handle {
  flex: none;
  width: 12px;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  touch-action: none;
  outline: none;
}

.fde-split-handle::after {
  content: '';
  width: 4px;
  height: 44px;
  border-radius: 999px;
  background: var(--fde-border);
  transition: background 120ms ease;
}

.fde-split-handle:hover::after,
.fde-split-handle:focus-visible::after,
.fde-split[data-dragging='true'] .fde-split-handle::after {
  background: var(--fde-primary);
}

.fde-panel-state {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
  padding: 24px 0;
  color: var(--fde-muted-fg);
}

.fde-panel-state pre {
  max-width: 100%;
  overflow: auto;
  white-space: pre-wrap;
  color: var(--fde-error);
}

.fde-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  padding: 20px;
}

.fde-dialog {
  width: min(520px, 100%);
  background: var(--fde-card);
  color: var(--fde-fg);
  border: 1px solid var(--fde-border);
  border-radius: 14px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
}

.fde-dialog h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.fde-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12.5px;
  color: var(--fde-muted-fg);
}

.fde-input,
.fde-textarea {
  width: 100%;
  border: 1px solid var(--fde-border);
  border-radius: 8px;
  background: var(--fde-bg);
  color: var(--fde-fg);
  font: inherit;
  font-size: 13px;
  padding: 8px 10px;
  outline: none;
}

.fde-input:focus,
.fde-textarea:focus {
  border-color: var(--fde-primary);
}

.fde-textarea {
  min-height: 84px;
  resize: vertical;
}

.fde-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.fde-palette-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: var(--fde-overlay);
  backdrop-filter: blur(2px);
  animation: fde-fade-in 120ms ease-out;
}

.fde-palette {
  position: fixed;
  left: 50%;
  top: 16px;
  z-index: 121;
  transform: translateX(-50%);
  width: calc(100% - 16px);
  max-width: 640px;
  max-height: min(70dvh, 560px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--fde-border);
  border-radius: 12px;
  background: var(--fde-popover);
  color: var(--fde-popover-fg);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  outline: none;
  animation: fde-fade-in 120ms ease-out;
}

@media (min-width: 768px) {
  .fde-palette {
    top: calc(50% - 250px);
  }
}

.fde-palette-title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.fde-palette-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--fde-border);
}

.fde-palette-header svg {
  flex: none;
  color: var(--fde-muted-fg);
}

.fde-palette-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 16px;
  outline: none;
}

.fde-palette-input::placeholder {
  color: var(--fde-muted-fg);
}

.fde-palette-close {
  flex: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--fde-muted-fg);
}

.fde-palette-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.fde-palette-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  font-size: 13px;
  border-bottom: 1px solid var(--fde-border);
}

.fde-palette-item:last-child {
  border-bottom: 0;
}

.fde-palette-label {
  font-weight: 500;
}

.fde-palette-keys {
  display: inline-flex;
  flex: none;
  gap: 4px;
}

.fde-kbd {
  min-width: 20px;
  padding: 2px 6px;
  border: 1px solid var(--fde-border);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: var(--fde-muted);
  color: var(--fde-muted-fg);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Consolas, monospace, "Apple Symbols",
    "Segoe UI Symbol", sans-serif;
  font-variant-emoji: text;
  font-size: 11px;
  line-height: 1.4;
  text-align: center;
}

.fde-palette-empty {
  padding: 48px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--fde-muted-fg);
}

@keyframes fde-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.fde-spinner {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: fde-spin 0.7s linear infinite;
}

@keyframes fde-spin {
  to {
    transform: rotate(360deg);
  }
}

.fde-spin {
  animation: fde-spin 0.7s linear infinite;
}

.fde-sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--fde-fg);
  font-size: 13px;
}

.fde-sidebar-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--fde-border);
}

.fde-sidebar-tabs {
  display: flex;
  gap: 2px;
}

.fde-sidebar-tabs button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--fde-muted-fg);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
}

.fde-sidebar-tabs button:hover {
  background: var(--fde-accent);
  color: var(--fde-accent-fg);
}

.fde-sidebar-tabs button[data-active='true'] {
  background: var(--fde-secondary);
  color: var(--fde-secondary-fg);
}

.fde-auth-button {
  width: 100%;
  justify-content: center;
}

.fde-auth-user {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--fde-muted-fg);
  min-height: 24px;
}

.fde-auth-signout {
  flex: none;
  width: 24px;
  height: 24px;
  margin-inline-start: auto;
  border-radius: 6px;
  color: var(--fde-muted-fg);
}

.fde-auth-signout:hover {
  color: var(--fde-accent-fg);
}

.fde-avatar {
  width: 20px;
  height: 20px;
  flex: none;
  border-radius: 999px;
  /* Sits on the pill, and backs an avatar that has not loaded yet. */
  background: var(--fde-secondary);
  box-shadow: 0 0 0 1px var(--fde-border);
  object-fit: cover;
}

.fde-username {
  overflow: hidden;
  min-width: 0;
  color: var(--fde-fg);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fde-sidebar-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fde-sidebar-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 10px;
  color: var(--fde-muted-fg);
}

.fde-tree {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.fde-tree-separator:hover {
  background: var(--fde-accent);
}

.fde-danger:hover {
  color: var(--fde-error);
}

.fde-tree-separator {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-block: 6px;
  padding-inline-end: 6px;
  margin-top: 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fde-muted-fg);
  border-radius: 5px;
}

.fde-tree-add-button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px dashed var(--fde-border);
  background: transparent;
  color: var(--fde-muted-fg);
  font: inherit;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 5px;
  cursor: pointer;
}

.fde-tree-add-button:hover {
  color: var(--fde-fg);
  border-color: var(--fde-muted-fg);
}

.fde-tree-props {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 6px 0 8px;
  padding: 10px;
  border: 1px solid var(--fde-border);
  border-radius: 8px;
  background: var(--fde-card);
}

.fde-tree-props label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11.5px;
  color: var(--fde-muted-fg);
}

.fde-tree-props .fde-check {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  color: var(--fde-fg);
}

.fde-tree-add-kinds {
  display: flex;
  gap: 4px;
}

.fde-tree-add-kinds button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--fde-border);
  background: transparent;
  color: var(--fde-muted-fg);
  font: inherit;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 5px;
  cursor: pointer;
}

.fde-tree-add-kinds button[data-active='true'] {
  background: var(--fde-secondary);
  color: var(--fde-secondary-fg);
}

.fde-tree-add-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.fde-tree-rename {
  padding: 3px 6px;
  font-size: 12.5px;
}

.fde-git {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 4px 16px;
}

.fde-git-status {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fde-git-branch {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px;
  color: var(--fde-muted-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fde-git-warning {
  font-size: 11.5px;
  color: var(--fde-error);
}

.fde-git-note {
  font-size: 11.5px;
  color: var(--fde-muted-fg);
}

.fde-git-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fde-git-title {
  margin: 0 0 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fde-muted-fg);
}

.fde-git-count {
  font-weight: 400;
  color: var(--fde-muted-fg);
}

.fde-git-empty {
  margin: 0;
  font-size: 12px;
  color: var(--fde-muted-fg);
}

.fde-git-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  border-radius: 4px;
}

.fde-git-row:hover {
  background: var(--fde-accent);
}

.fde-git-badge {
  flex: none;
  width: 16px;
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
}

.fde-git-badge[data-status='new'] {
  color: #22c55e;
}

.fde-git-badge[data-status='modified'] {
  color: #eab308;
}

.fde-git-badge[data-status='deleted'] {
  color: #ef4444;
}

.fde-git-badge[data-status='renamed'] {
  color: #3b82f6;
}

.fde-git-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px;
}

.fde-git-open {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px;
  text-align: start;
  cursor: pointer;
}
.fde-git-open:hover { color: var(--fde-primary); text-decoration: underline; }

.fde-diff-counts {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0;
}
.fde-git-title .fde-diff-counts { margin-inline-start: auto; }
.fde-diff-summary {
  display: flex;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--fde-border);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
}
.fde-diff-added { color: var(--fde-success); }
.fde-diff-removed { color: var(--fde-error); }

.fde-git-action {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 0;
  background: transparent;
  color: var(--fde-muted-fg);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0;
  opacity: 0;
}

.fde-git-row:hover .fde-git-action {
  opacity: 1;
}

.fde-git-action:hover {
  background: var(--fde-card);
  color: var(--fde-fg);
}

.fde-git-commit {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fde-git-message {
  font-size: 12px;
  font-family: inherit;
  resize: vertical;
}

.fde-git-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.fde-git-result {
  font-size: 12px;
  color: var(--fde-success);
  overflow-wrap: anywhere;
}

.fde-media {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
/* The shared search styles grow in a row, but here it is a column child. */
.fde-media > .fde-sidebar-search { flex: none; width: 100%; }

.fde-media-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 12px;
  color: var(--fde-muted-fg);
}

.fde-media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
}

.fde-media-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--fde-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--fde-card);
}

.fde-media-card[data-status='new'] {
  border-color: var(--fde-success);
}

.fde-media-card[data-status='modified'] {
  border-color: var(--fde-warning);
}

.fde-media-card[data-status='deleted'] {
  border-color: var(--fde-error);
}

.fde-media-card[data-status='renamed'] {
  border-color: var(--color-fd-info, #2563eb);
}

.fde-media-preview {
  position: relative;
  aspect-ratio: 4 / 3;
  background: color-mix(in srgb, var(--fde-muted) 50%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.fde-media-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fde-media-placeholder {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: var(--fde-border);
}

.fde-media-badge {
  position: absolute;
  top: 4px;
  inset-inline-start: 4px;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--fde-card);
  color: var(--fde-muted-fg);
  border: 1px solid var(--fde-border);
}

.fde-media-name {
  padding: 0 6px;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fde-media-rename {
  margin: 0 4px;
  padding: 2px 5px;
  font-size: 11px;
}

.fde-media-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  padding: 0 4px 4px;
  opacity: 0;
}

.fde-media-card:hover .fde-media-actions {
  opacity: 1;
}

/* Editing navigator: composed with Fumadocs sidebar, tabs, and popover primitives. */
.fde-sidebar {
  min-height: calc(100dvh - 168px);
  gap: 0;
}

.fde-sidebar-head {
  border: 0;
  padding: 0;
}

.fde-sidebar-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--fde-border);
  border-radius: 9px;
  background: color-mix(in srgb, var(--fde-muted) 35%, transparent);
}

.fde-sidebar-tabs button {
  justify-content: center;
  min-height: 31px;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12.5px;
}

.fde-sidebar-tabs button[data-active] {
  background: var(--fde-card);
  color: var(--fde-fg);
  box-shadow: 0 1px 4px color-mix(in srgb, black 12%, transparent);
}

.fde-sidebar-tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fde-tree-add-icon {
  appearance: none;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--fde-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--fde-card) 65%, transparent);
  color: var(--fde-muted-fg);
  cursor: pointer;
  transition: border-color 120ms ease, background-color 120ms ease, color 120ms ease;
}

.fde-tree-add-icon:hover {
  border-color: color-mix(in srgb, var(--fde-primary) 45%, var(--fde-border));
  background: var(--fde-accent);
  color: var(--fde-fg);
}

.fde-sidebar-body,
.fde-sidebar-panel {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.fde-pages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
}

.fde-sidebar-search {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--fde-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--fde-card) 65%, transparent);
  color: var(--fde-muted-fg);
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.fde-sidebar-search:focus-within {
  border-color: color-mix(in srgb, var(--fde-primary) 45%, var(--fde-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--fde-primary) 10%, transparent);
}

.fde-sidebar-search input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fde-fg);
  font: inherit;
  font-size: 12.5px;
}

.fde-tree-menu-trigger,
.fde-tree-grip {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--fde-muted-fg);
  cursor: pointer;
}

.fde-tree-menu-trigger:hover,
.fde-tree-grip:hover {
  background: var(--fde-accent);
  color: var(--fde-fg);
}

.fde-tree {
  gap: 2px;
}

.fde-tree-node {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 32px;
  border-radius: 7px;
  transition: background 100ms ease, opacity 100ms ease;
}

.fde-tree-node:hover,
.fde-tree-node:focus-within {
  background: var(--fde-accent);
}

.fde-tree-node[data-dragging='true'] {
  opacity: 0.45;
}

.fde-tree-node[data-drop='before']::before,
.fde-tree-node[data-drop='after']::after {
  content: '';
  position: absolute;
  z-index: 2;
  inset-inline: 5px;
  height: 2px;
  border-radius: 999px;
  background: var(--fde-primary);
  box-shadow: 0 0 0 1px var(--fde-bg);
}

.fde-tree-node[data-drop='before']::before { top: -2px; }
.fde-tree-node[data-drop='after']::after { bottom: -2px; }
.fde-tree-node[data-drop='inside'] {
  background: color-mix(in srgb, var(--fde-primary) 12%, var(--fde-accent));
  outline: 1px solid color-mix(in srgb, var(--fde-primary) 55%, transparent);
}

.fde-tree-item {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 6px 7px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--fde-muted-fg);
  text-decoration: none;
  font: inherit;
  font-size: 12.75px;
  text-align: start;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.fde-tree-item > svg { flex: none; }
.fde-tree-item[data-active='true'] {
  background: color-mix(in srgb, var(--fde-primary) 14%, var(--fde-card));
  color: var(--fde-fg);
  font-weight: 600;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fde-primary) 30%, transparent);
}

.fde-tree-folder-trigger > svg:last-child { margin-inline-start: auto; }
/* One indent step per folder level, with a guide line down the branch. */
.fde-tree-children {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-inline-start: 15px;
  padding-inline-start: 7px;
  border-inline-start: 1px solid color-mix(in srgb, var(--fde-border) 80%, transparent);
}

.fde-tree-controls {
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 100ms ease;
}

.fde-tree-node:hover > .fde-tree-controls,
.fde-tree-node:focus-within > .fde-tree-controls,
.fde-tree-node[data-dragging='true'] > .fde-tree-controls { opacity: 1; }

.fde-tree-grip { width: 24px; height: 26px; cursor: grab; }
.fde-tree-grip:active { cursor: grabbing; }
.fde-tree-menu-trigger { width: 26px; height: 26px; }
.fde-review-count > span {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--fde-success);
}

.fde-tree-status {
  flex: none;
  margin-inline-start: auto;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  color: var(--fde-success);
}
.fde-tree-status[data-status='modified'] { color: var(--fde-warning); }
.fde-tree-status[data-status='deleted'] { color: var(--fde-error); }
.fde-tree-status[data-status='renamed'] { color: var(--color-fd-info, #2563eb); }

.fde-tree-node[data-status='new'] > .fde-tree-item { color: var(--fde-success); }
.fde-tree-node[data-status='modified'] > .fde-tree-item { color: var(--fde-warning); }
.fde-tree-node[data-status='deleted'] > .fde-tree-item {
  color: var(--fde-error);
  text-decoration: line-through;
}
.fde-tree-node[data-status='renamed'] > .fde-tree-item { color: var(--color-fd-info, #2563eb); }

.fde-tree-separator {
  flex: 1;
  justify-content: flex-start;
  margin: 12px 0 2px;
  padding: 5px 7px;
  font-size: 10.5px;
}
.fde-tree-separator > svg { flex: none; }

.fde-icon-popover {
  display: flex;
  width: 268px;
  min-width: 268px;
  flex-direction: column;
  gap: 8px;
}
.fde-icon-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  max-height: 216px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.fde-icon-option {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--fde-muted-fg);
  cursor: pointer;
}
.fde-icon-option:hover { background: var(--fde-accent); color: var(--fde-fg); }
.fde-icon-option[data-active='true'] {
  border-color: color-mix(in srgb, var(--fde-primary) 45%, var(--fde-border));
  background: color-mix(in srgb, var(--fde-primary) 12%, transparent);
  color: var(--fde-fg);
}
.fde-icon-empty {
  grid-column: 1 / -1;
  margin: 6px 2px;
  color: var(--fde-muted-fg);
  font-size: 11.5px;
}

.fde-tree-props-icon {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
  color: var(--fde-muted-fg);
}
.fde-tree-props-icon .fde-button { padding: 6px; }

.fde-tree-add-button {
  width: 100%;
  justify-content: flex-start;
  min-height: 31px;
  border-style: solid;
  border-color: transparent;
}
.fde-tree-add-button:hover { border-color: var(--fde-border); background: var(--fde-accent); }

.fde-tree-menu {
  display: flex;
  width: 220px;
  min-width: 220px;
  flex-direction: column;
  gap: 4px;
}

.fde-add-popover {
  display: flex;
  width: 258px;
  min-width: 258px;
  flex-direction: column;
  gap: 10px;
}
.fde-add-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.fde-add-field > span {
  color: var(--fde-muted-fg);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.fde-add-name {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fde-add-name .fde-input { flex: 1; min-width: 0; }
.fde-add-icon {
  appearance: none;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--fde-border);
  border-radius: 7px;
  background: var(--fde-card);
  color: var(--fde-muted-fg);
  cursor: pointer;
}
.fde-add-icon:hover { background: var(--fde-accent); color: var(--fde-fg); }
.fde-add-popover .fde-tree-add-kinds button { flex: 1; justify-content: center; }

.fde-menu-item {
  appearance: none;
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  text-align: start;
  cursor: pointer;
}
.fde-menu-item:hover { background: var(--fde-accent); }
.fde-popover-title { margin: 1px 2px 5px; font-size: 11.5px; font-weight: 600; }
.fde-add-popover .fde-button-primary { align-self: stretch; margin-top: 3px; }

.fde-tree-props {
  margin: 4px 4px 8px 15px;
  background: color-mix(in srgb, var(--fde-card) 86%, transparent);
}

/*
 * One container for the whole footer, like the Fumadocs original: the layout
 * div becomes the bordered pill, and display:contents on the icon row lets its
 * links and theme switch share it with the review controls. Order puts the
 * theme switch last, flush to the trailing edge the way Fumadocs pads it.
 * The sidebar is wider than its content on large screens (the layout adds
 * outer gutters), so the pill sizes from --fd-sidebar-width and subtracts its
 * own margins to stay the same width as the read footer.
 */
div:has(> .fde-sidebar-review) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  width: calc(var(--fd-sidebar-width, 100%) - 32px);
  margin: 0 16px 16px;
  padding: 0;
  border: 1px solid var(--fde-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--fde-secondary) 50%, transparent);
}
:not(:empty):has(+ .fde-sidebar-review) {
  display: contents;
}
/* The pill carries edit controls now; the read links crowd out the branch. */
:not(:empty):has(+ .fde-sidebar-review) > a {
  display: none;
}
/*
 * The theme switch shares the account row rather than taking a line of its
 * own: its leading border becomes the divider between the account and the
 * two chrome controls, and it stretches so that divider spans the row.
 */
:not(:empty):has(+ .fde-sidebar-review) > [data-theme-toggle] {
  grid-area: 2 / 2 / 3 / 3;
  border-top: 1px solid var(--fde-border);
  border-end-end-radius: 9px;
}

.fde-sidebar-review {
  grid-area: 1 / 1 / 2 / 3;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 2px 6px;
}

/* Account row: a second line inside the same pill. */
.fde-sidebar-review ~ .fde-auth-button,
.fde-sidebar-review ~ .fde-auth-user {
  grid-area: 2 / 1 / 3 / 2;
  margin: 0;
  padding: 7px 9px;
  border-top: 1px solid var(--fde-border);
  border-radius: 0 0 9px 9px;
}
/* With a theme switch beside it, the account row gives up the trailing corner. */
div:has([data-theme-toggle]) > .fde-sidebar-review ~ .fde-auth-button,
div:has([data-theme-toggle]) > .fde-sidebar-review ~ .fde-auth-user {
  border-end-end-radius: 0;
}
.fde-sidebar-review ~ .fde-auth-button {
  justify-content: flex-start;
  border-inline: 0;
  border-bottom: 0;
  background: transparent;
}

.fde-review-branch,
.fde-review-count {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  white-space: nowrap;
}
.fde-review-branch {
  overflow: hidden;
  color: var(--fde-fg);
  font-weight: 500;
  text-overflow: ellipsis;
}
.fde-review-branch > svg { flex: none; color: var(--fde-muted-fg); }
.fde-review-count { flex: none; color: var(--fde-muted-fg); font-size: 11px; }
.fde-review-count[data-visible='false'] > span { background: var(--fde-border); }
.fde-review-button {
  appearance: none;
  flex: none;
  margin-inline-start: auto;
  min-height: 28px;
  padding: 0 11px;
  border: 1px solid var(--fde-primary);
  border-radius: 6px;
  background: var(--fde-primary);
  color: var(--fde-primary-fg);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 100ms, color 100ms, border-color 100ms;
}
.fde-review-button:hover {
  background: color-mix(in srgb, var(--fde-primary) 88%, black);
}
.fde-review-button[data-active='true'] {
  border-color: var(--fde-border);
  background: var(--fde-secondary);
  color: var(--fde-fg);
}
.fde-review-button[data-active='true']:hover { background: var(--fde-accent); }
.fde-review-button:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--fde-ring); }
.fde-review-panel { display: flex; flex-direction: column; gap: 12px; }
.fde-panel-title { display: flex; align-items: center; gap: 8px; }
.fde-panel-title button { margin-inline-start: auto; border: 0; background: transparent; color: var(--fde-muted-fg); font: inherit; font-size: 11px; cursor: pointer; }

.fde-media {
  min-height: 0;
  flex: 1;
  gap: 12px;
}
.fde-media-intro { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.fde-media-intro > div { display: flex; flex-direction: column; gap: 2px; }
.fde-media-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px;
  border: 1px solid var(--fde-border);
  border-radius: 11px;
  background: color-mix(in srgb, var(--fde-card) 55%, transparent);
  transition: border-color 120ms ease, background 120ms ease;
}
.fde-media-section[data-dragging='true'] {
  border-color: var(--fde-primary);
  background: color-mix(in srgb, var(--fde-primary) 7%, transparent);
}
.fde-media-section-title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: var(--fde-fg);
  font-size: 11.5px;
  font-weight: 600;
}
.fde-media-folder {
  margin: 5px 2px 0;
  color: var(--fde-muted-fg);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.02em;
}
.fde-media-upload { display: flex; flex-direction: column; gap: 5px; }
.fde-media-upload-target {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fde-muted-fg);
  font-size: 10.5px;
}
.fde-media-upload-path {
  flex: 1;
  min-width: 0;
  min-height: 26px;
  padding: 4px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
}
.fde-media-scope {
  appearance: none;
  min-width: 0;
  overflow: hidden;
  margin-inline-start: auto;
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--fde-muted);
  color: var(--fde-muted-fg);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
select.fde-media-scope {
  border: 1px solid var(--fde-border);
  color: var(--fde-fg);
  cursor: pointer;
}
select.fde-media-scope:hover { background: var(--fde-accent); }

.fde-media-dropzone {
  appearance: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 72px;
  padding: 10px;
  border: 1px dashed color-mix(in srgb, var(--fde-muted-fg) 65%, var(--fde-border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--fde-muted) 25%, transparent);
  color: var(--fde-muted-fg);
  font: inherit;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;
}
.fde-media-dropzone strong { color: var(--fde-fg); font-size: 11.5px; }
.fde-media-dropzone span { max-width: 230px; font-size: 9.5px; line-height: 1.4; }
.fde-media-dropzone:hover,
.fde-media-dropzone[data-dragging='true'] {
  border-color: var(--fde-primary);
  background: color-mix(in srgb, var(--fde-primary) 8%, transparent);
  transform: translateY(-1px);
}
.fde-media-list { display: flex; flex-direction: column; gap: 3px; }
.fde-media-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
}
.fde-media-row:hover { background: var(--fde-accent); }

.fde-media-thumb,
.fde-media-placeholder { width: 48px; height: 38px; flex: none; border-radius: 6px; border: 1px solid var(--fde-border); background: var(--fde-muted); object-fit: cover; }
.fde-media-placeholder { display: flex; align-items: center; justify-content: center; color: var(--fde-muted-fg); }
.fde-media-meta { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.fde-media-meta strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; }
.fde-media-meta > span { color: var(--fde-muted-fg); font-size: 10px; }

.fde-media-row .fde-tree-menu-trigger { opacity: 0; }
.fde-media-row:hover .fde-tree-menu-trigger,
.fde-media-row:focus-within .fde-tree-menu-trigger { opacity: 1; }
.fde-gallery-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.45);
}
.fde-gallery {
  display: flex;
  width: min(72vw, 1280px);
  height: min(72vh, 860px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--fde-border);
  border-radius: 14px;
  background: var(--fde-card);
  color: var(--fde-fg);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}
.fde-gallery-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--fde-border);
}
.fde-gallery-title {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: baseline;
  gap: 8px;
}
.fde-gallery-title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.fde-gallery-title > span { flex: none; color: var(--fde-muted-fg); font-size: 11px; }
.fde-gallery-title .fde-input { max-width: 320px; font-size: 12px; }
.fde-gallery-count { flex: none; color: var(--fde-muted-fg); font-size: 11px; font-variant-numeric: tabular-nums; }
.fde-gallery-stage {
  display: flex;
  min-height: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px;
  background: color-mix(in srgb, black 18%, transparent);
}
.fde-gallery-image {
  display: flex;
  min-width: 0;
  height: 100%;
  flex: 1;
  align-items: center;
  justify-content: center;
}
.fde-gallery-image img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  object-fit: contain;
}
.fde-gallery-nav {
  appearance: none;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--fde-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--fde-card) 80%, transparent);
  color: var(--fde-fg);
  cursor: pointer;
  transition: background-color 100ms ease;
}
.fde-gallery-nav:disabled { opacity: 0.35; cursor: default; }
.fde-gallery-nav:not(:disabled):hover { background: var(--fde-accent); }
.fde-gallery-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--fde-border);
}
.fde-gallery-delete { color: var(--fde-error); }
.fde-gallery-delete:hover {
  border-color: color-mix(in srgb, var(--fde-error) 40%, var(--fde-border));
  background: color-mix(in srgb, var(--fde-error) 12%, transparent);
}

/* The /editor route renders inside DocsPage, so it inherits the docs column. */
.fde-editor-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--fde-border);
}
.fde-editor-header .fde-toolbar {
  margin-inline-start: auto;
}

/*
 * The editor owns the viewport: the page itself does not scroll, each pane
 * scrolls on its own, and split panes keep separate scroll areas.
 */
#nd-docs-layout:has(.fde-editor-route) {
  height: 100dvh;
  min-height: 100dvh;
  overflow: hidden;
}
#nd-docs-layout:has(.fde-editor-route) main {
  min-height: 0;
  overflow: hidden;
}
#nd-docs-layout:has(.fde-editor-route) #nd-page {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.fde-editor-route {
  min-height: 0;
  overflow: hidden;
}
.fde-editor-route .fde-editor,
.fde-editor-route .fde-preview,
.fde-editor-route .fde-diff,
.fde-editor-route .fde-split {
  height: 100%;
  min-height: 0;
}
.fde-split-pane {
  overflow: auto;
}
.fde-split-pane .fde-editor,
.fde-split-pane .fde-preview,
.fde-split-pane .fde-diff {
  height: 100%;
  min-height: 0;
}

.fde-readonly-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 9px;
  border: 1px solid var(--fde-border);
  border-radius: 999px;
  color: var(--fde-muted-fg);
  font-size: 11px;
}

.fde-editor-route {
  display: flex;
  min-height: min(640px, 70dvh);
  flex-direction: column;
}
.fde-editor-route > * {
  min-height: 0;
  flex: 1;
}
.fde-editor-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  border: 1px dashed var(--fde-border);
  border-radius: 12px;
  color: var(--fde-muted-fg);
  font-size: 13px;
}

.fde-editor-shell { position: relative; width: 100%; height: 100%; min-height: 320px; }
.fde-editor-shell .fde-editor { height: 100%; }
.fde-editor-drop-overlay {
  position: absolute;
  z-index: 8;
  inset: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 2px dashed color-mix(in srgb, var(--fde-primary) 70%, var(--fde-border));
  border-radius: 11px;
  background: color-mix(in srgb, var(--fde-bg) 88%, transparent);
  color: var(--fde-fg);
  box-shadow: 0 16px 48px color-mix(in srgb, black 18%, transparent);
  backdrop-filter: blur(10px);
  pointer-events: none;
  animation: fde-fade-in 120ms ease-out;
}
.fde-editor-drop-overlay > span:last-child { color: var(--fde-muted-fg); font-size: 12px; }
.fde-editor-drop-icon { position: relative; display: inline-flex; padding: 12px; border-radius: 12px; background: var(--fde-accent); color: var(--fde-primary); }
.fde-editor-drop-icon svg:last-child { position: absolute; inset-inline-end: 5px; bottom: 4px; }
.fde-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
`;
