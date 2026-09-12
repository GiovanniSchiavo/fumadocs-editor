"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useFumadocsEditor } from "./context";

export interface SubmitDialogProps {
  onClose: () => void;
}

export function SubmitDialog({ onClose }: SubmitDialogProps) {
  const editor = useFumadocsEditor();
  const document = editor.document;
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState(
    document ? `docs: update ${document.path}` : "docs: update page",
  );
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    const result = await editor.submit({
      message,
      description: description || undefined,
    });
    setBusy(false);
    if (result) onClose();
  }

  return (
    <div className="fde-dialog-backdrop">
      <form className="fde-dialog" onSubmit={onSubmit}>
        <h2>Submit changes</h2>
        <label className="fde-field">
          Commit message
          <input
            ref={inputRef}
            className="fde-input"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
          />
        </label>
        <label className="fde-field">
          Pull request description (optional)
          <textarea
            className="fde-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Explain what changed and why."
          />
        </label>
        <div className="fde-dialog-actions">
          <button
            type="button"
            className="fde-button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="fde-button fde-button-primary"
            disabled={busy}
          >
            {busy ? "Submitting…" : "Create pull request"}
          </button>
        </div>
      </form>
    </div>
  );
}
