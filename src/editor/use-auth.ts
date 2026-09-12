"use client";

import { useCallback, useEffect, useState } from "react";

export interface EditorAuthUser {
  login: string;
  name?: string;
  avatarUrl?: string;
}

export interface EditorAuthState {
  configured: boolean;
  user: EditorAuthUser | null;
  canWrite: boolean;
  /** May open a pull request, from a fork when write access is missing. */
  canPropose: boolean;
  loading: boolean;
  signIn: () => void;
  signOut: () => void;
  refresh: () => Promise<void>;
}

export function useEditorAuth(apiBase: string): EditorAuthState {
  const [state, setState] = useState({
    configured: false,
    user: null as EditorAuthUser | null,
    canWrite: false,
    canPropose: false,
    loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}?op=session`, {
        headers: { accept: "application/json" },
      });
      const payload = (await response.json()) as {
        configured?: boolean;
        user?: EditorAuthUser | null;
        canWrite?: boolean;
        canPropose?: boolean;
      };
      setState({
        configured: Boolean(payload.configured),
        user: payload.user ?? null,
        canWrite: Boolean(payload.canWrite),
        canPropose: Boolean(payload.canPropose),
        loading: false,
      });
    } catch {
      setState((current) => ({ ...current, loading: false }));
    }
  }, [apiBase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(() => {
    const returnTo =
      typeof window === "undefined"
        ? "/"
        : window.location.pathname + window.location.search;
    window.location.href = `${apiBase}?op=login&returnTo=${encodeURIComponent(returnTo)}`;
  }, [apiBase]);

  const signOut = useCallback(async () => {
    await fetch(`${apiBase}?op=logout`, { method: "GET" });
    await refresh();
  }, [apiBase, refresh]);

  return { ...state, signIn, signOut, refresh };
}
