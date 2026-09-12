import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import type { RepositorySession } from "../types";

export interface GitHubAuthOptions {
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
  repository: Pick<RepositorySession, "owner" | "repo">;
  scope?: string;
}

export interface AuthSession {
  login: string;
  name?: string;
  avatarUrl?: string;
  accessToken: string;
}

export interface AuthStatusPayload {
  configured: boolean;
  user: {
    login: string;
    name?: string;
    avatarUrl?: string;
  } | null;
  canWrite: boolean;
  /**
   * The user may open a pull request from their own fork despite lacking
   * write access. False when the handler disallows forks.
   */
  canPropose: boolean;
}

export const SESSION_COOKIE = "fde_session";
const STATE_COOKIE = "fde_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function keyFor(secret: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(secret).digest());
}

export async function encodeSession(
  session: AuthSession,
  secret: string,
): Promise<string> {
  return new EncryptJWT({ ...session })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .encrypt(keyFor(secret));
}

export async function decodeSession(
  value: string,
  secret: string,
): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtDecrypt(value, keyFor(secret));
    const session = payload as unknown as AuthSession;
    if (!session.login || !session.accessToken) return null;
    return session;
  } catch {
    return null;
  }
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

export function serializeCookie(
  name: string,
  value: string,
  options: { maxAge?: number; secure?: boolean } = {},
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export interface GitHubAuth {
  configured: true;
  readSession(request: Request): Promise<AuthSession | null>;
  canWrite(session: AuthSession): Promise<boolean>;
  status(
    request: Request,
    options?: { allowForks?: boolean },
  ): Promise<Response>;
  login(request: Request): Promise<Response>;
  callback(request: Request): Promise<Response>;
  logout(): Response;
}

export function createGitHubAuth(options: GitHubAuthOptions): GitHubAuth {
  async function readSession(request: Request): Promise<AuthSession | null> {
    const cookies = parseCookies(request.headers.get("cookie"));
    const value = cookies[SESSION_COOKIE];
    if (!value) return null;
    return decodeSession(value, options.sessionSecret);
  }

  async function canWrite(session: AuthSession): Promise<boolean> {
    const response = await fetch(
      `https://api.github.com/repos/${options.repository.owner}/${options.repository.repo}`,
      {
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
        },
      },
    );
    if (!response.ok) return false;
    const repository = (await response.json()) as {
      permissions?: { push?: boolean };
    };
    return repository.permissions?.push ?? false;
  }

  async function status(
    request: Request,
    statusOptions: { allowForks?: boolean } = {},
  ): Promise<Response> {
    const session = await readSession(request);
    if (!session) {
      const payload: AuthStatusPayload = {
        configured: true,
        user: null,
        canWrite: false,
        canPropose: false,
      };
      return Response.json(payload);
    }

    const writable = await canWrite(session);
    const payload: AuthStatusPayload = {
      configured: true,
      user: {
        login: session.login,
        name: session.name,
        avatarUrl: session.avatarUrl,
      },
      canWrite: writable,
      canPropose: writable || Boolean(statusOptions.allowForks),
    };
    return Response.json(payload);
  }

  async function login(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const redirectUri = `${url.origin}/api/editor?op=callback`;
    const state = crypto.randomUUID();
    const returnTo = sanitizeReturnTo(
      url.searchParams.get("returnTo"),
      url.origin,
    );

    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.searchParams.set("client_id", options.clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("state", state);
    if (options.scope) authorize.searchParams.set("scope", options.scope);

    return redirect(authorize.toString(), [
      serializeCookie(
        STATE_COOKIE,
        JSON.stringify({ state, redirectUri, returnTo }),
        { maxAge: 600, secure: url.protocol === "https:" },
      ),
    ]);
  }

  async function callback(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const cookies = parseCookies(request.headers.get("cookie"));
    const rawState = cookies[STATE_COOKIE];

    let returnTo = "/";
    try {
      const stored = rawState
        ? (JSON.parse(rawState) as {
            state: string;
            redirectUri: string;
            returnTo: string;
          })
        : null;
      if (!stored || stored.state !== url.searchParams.get("state")) {
        return Response.json(
          { error: "Invalid OAuth state." },
          { status: 400 },
        );
      }
      returnTo = stored.returnTo;

      if (!code) {
        return Response.json({ error: "Missing OAuth code." }, { status: 400 });
      }

      const tokenResponse = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            client_id: options.clientId,
            client_secret: options.clientSecret,
            code,
            redirect_uri: stored.redirectUri,
          }),
        },
      );

      const tokenPayload = (await tokenResponse.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (!tokenPayload.access_token) {
        return Response.json(
          {
            error:
              tokenPayload.error_description ??
              tokenPayload.error ??
              "GitHub token exchange failed.",
          },
          { status: 400 },
        );
      }

      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          authorization: `Bearer ${tokenPayload.access_token}`,
          accept: "application/vnd.github+json",
        },
      });
      const user = (await userResponse.json()) as {
        login?: string;
        name?: string;
        avatar_url?: string;
      };

      if (!user.login) {
        return Response.json(
          { error: "Unable to read the GitHub user." },
          { status: 400 },
        );
      }

      const session: AuthSession = {
        login: user.login,
        name: user.name,
        avatarUrl: user.avatar_url,
        accessToken: tokenPayload.access_token,
      };

      return redirect(returnTo, [
        serializeCookie(
          SESSION_COOKIE,
          await encodeSession(session, options.sessionSecret),
          { maxAge: SESSION_MAX_AGE, secure: url.protocol === "https:" },
        ),
        serializeCookie(STATE_COOKIE, "", {
          maxAge: 0,
          secure: url.protocol === "https:",
        }),
      ]);
    } catch (caught) {
      return Response.json(
        {
          error:
            caught instanceof Error
              ? caught.message
              : "GitHub authentication failed.",
        },
        { status: 500 },
      );
    }
  }

  function logout(): Response {
    const response = Response.json({ ok: true });
    response.headers.append(
      "set-cookie",
      serializeCookie(SESSION_COOKIE, "", { maxAge: 0 }),
    );
    return response;
  }

  return {
    configured: true,
    readSession,
    canWrite,
    status,
    login,
    callback,
    logout,
  };
}

/**
 * A 302 carrying cookies. `Response.redirect()` cannot be used: its headers
 * are immutable, so the cookie can never be attached, and it rejects the
 * relative locations {@link sanitizeReturnTo} produces.
 */
function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ location });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

function sanitizeReturnTo(value: string | null, origin: string): string {
  if (!value) return "/";
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return "/";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}
