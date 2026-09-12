"use client";

import {
  Component,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { collectRelativeMedia, rewriteRelativeMedia } from "../media/paths";
import { useEditorWorkspace } from "../workspace/context";
import { useFumadocsEditor } from "./context";
import { parseSource } from "./frontmatter";

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; node: ReactNode }
  | { status: "error"; message: string }
  | { status: "unavailable" };

function PreviewError({ message }: { message: string }) {
  return (
    <div className="fde-panel-state">
      <p>Preview failed to render.</p>
      <pre>{message}</pre>
      <p>The MDX source is still intact and can be submitted as-is.</p>
    </div>
  );
}

/**
 * A component in the rendered tree can still throw; without a boundary the
 * error would unmount the whole editor instead of the preview pane.
 */
class PreviewErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(caught: unknown) {
    return {
      message: caught instanceof Error ? caught.message : String(caught),
    };
  }

  render() {
    if (this.state.message !== null) {
      return <PreviewError message={this.state.message} />;
    }
    return this.props.children;
  }
}

export function PreviewPanel() {
  const { document, renderPreview } = useFumadocsEditor();
  const workspace = useEditorWorkspace();
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const [source, setSource] = useState("");

  const current = document?.current ?? "";
  const parsed = useMemo(() => parseSource(current), [current]);
  const deferred = useDeferredValue(parsed.body);

  useEffect(() => {
    const pagePath = document?.path ?? "";
    const references = collectRelativeMedia(deferred, pagePath);
    let cancelled = false;

    if (references.length === 0) {
      setSource(deferred);
      return;
    }

    Promise.all(
      references.map(async (reference) => {
        try {
          return [
            reference.path,
            await workspace.readMediaUrl("content", reference.path),
          ] as const;
        } catch {
          return [reference.path, ""] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      const urls = new Map(
        entries.filter(([, url]) => url.length > 0) as Array<[string, string]>,
      );
      setSource(
        rewriteRelativeMedia(deferred, pagePath, (mediaPath) => {
          return urls.get(mediaPath) ?? null;
        }),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [deferred, document?.path, workspace]);

  useEffect(() => {
    if (!renderPreview) {
      setState({ status: "unavailable" });
      return;
    }

    if (parsed.error) {
      setState({
        status: "error",
        message: `Invalid frontmatter: ${parsed.error}`,
      });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    Promise.resolve(renderPreview(source))
      .then((node) => {
        if (!cancelled) setState({ status: "ready", node });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: caught instanceof Error ? caught.message : String(caught),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [source, parsed.error, renderPreview]);

  if (state.status === "unavailable") {
    return (
      <div className="fde-panel-state">
        <p>No preview renderer is configured.</p>
        <p>
          Pass <code>renderPreview</code> to <code>FumadocsEditorProvider</code>{" "}
          to render MDX with your documentation pipeline.
        </p>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="fde-panel-state">
        <span className="fde-spinner" />
        <p>Rendering preview…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return <PreviewError message={state.message} />;
  }

  return (
    <div className="fde-preview">
      <PreviewErrorBoundary key={source}>{state.node}</PreviewErrorBoundary>
    </div>
  );
}
