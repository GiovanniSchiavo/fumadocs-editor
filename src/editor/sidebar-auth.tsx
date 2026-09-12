"use client";

import { LogIn, LogOut } from "lucide-react";
import { useFumadocsEditor } from "./context";
import { useEditorAuth } from "./use-auth";

export function EditorSidebarAuth() {
  const editor = useFumadocsEditor();
  const auth = useEditorAuth(editor.apiBase);

  if (auth.loading || !auth.configured) return null;

  if (!auth.user) {
    return (
      <button
        type="button"
        className="fde-button fde-auth-button"
        onClick={auth.signIn}
      >
        <LogIn size={14} />
        Sign in with GitHub
      </button>
    );
  }

  return (
    <div className="fde-auth-user">
      {auth.user.avatarUrl ? (
        <img src={auth.user.avatarUrl} alt="" className="fde-avatar" />
      ) : null}
      <span className="fde-username" title={auth.user.login}>
        {auth.user.login}
      </span>
      <button
        type="button"
        className="fde-icon-button fde-auth-signout"
        onClick={() => void auth.signOut()}
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
