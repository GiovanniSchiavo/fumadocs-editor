export interface WebMcpTextContent {
  type: "text";
  text: string;
}

export interface WebMcpToolResult {
  content?: WebMcpTextContent[];
  structuredContent?: unknown;
}

export interface WebMcpAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  consequentialHint?: boolean;
}

export type WebMcpToolInput = Record<string, unknown>;

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: WebMcpAnnotations;
  execute: (
    input: WebMcpToolInput,
    options: { signal?: AbortSignal },
  ) => unknown | Promise<unknown>;
}

export interface WebMcpModelContext {
  registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ): Promise<void>;
  getTools?(options?: { fromOrigins?: string[] }): Promise<WebMcpTool[]>;
  executeTool?(
    tool: WebMcpTool,
    args?: WebMcpToolInput,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
  addEventListener?(type: "toolchange", listener: () => void): void;
  removeEventListener?(type: "toolchange", listener: () => void): void;
}

export interface WebMcpConfig {
  /**
   * Register tools when a WebMCP implementation exists.
   *
   * @defaultValue true
   */
  enabled?: boolean;
  /**
   * Prefix added to every tool name (e.g. "fde-").
   */
  prefix?: string;
  /**
   * Allowlist of tool names (without prefix). Omit to register all tools.
   */
  tools?: string[];
}

export function getModelContext(): WebMcpModelContext | null {
  if (typeof document !== "undefined") {
    const context = (document as DocumentWithModelContext).modelContext;
    if (context && typeof context.registerTool === "function") return context;
  }
  if (typeof navigator !== "undefined") {
    const context = (navigator as NavigatorWithModelContext).modelContext;
    if (context && typeof context.registerTool === "function") return context;
  }
  return null;
}

interface DocumentWithModelContext extends Document {
  modelContext?: WebMcpModelContext;
}

interface NavigatorWithModelContext extends Navigator {
  modelContext?: WebMcpModelContext;
}

declare global {
  interface Document {
    modelContext?: WebMcpModelContext;
  }
  interface Navigator {
    modelContext?: WebMcpModelContext;
  }
}
