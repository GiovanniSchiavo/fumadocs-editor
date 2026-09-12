import { describe, expect, it } from "vitest";
import { createGitHubAuth, SESSION_COOKIE } from "./auth";

const auth = createGitHubAuth({
  clientId: "client-id",
  clientSecret: "client-secret",
  sessionSecret: "session-secret",
  repository: { owner: "acme", repo: "docs" },
  scope: "public_repo",
});

function loginRequest(returnTo?: string): Request {
  const url = new URL("https://docs.example.com/api/editor");
  url.searchParams.set("op", "login");
  if (returnTo) url.searchParams.set("returnTo", returnTo);
  return new Request(url);
}

describe("GitHub auth redirects", () => {
  it("sends the browser to GitHub and keeps the state cookie", async () => {
    const response = await auth.login(loginRequest("/docs/intro"));

    expect(response.status).toBe(302);

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(location.searchParams.get("client_id")).toBe("client-id");
    expect(location.searchParams.get("scope")).toBe("public_repo");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://docs.example.com/api/editor?op=callback",
    );

    // Response.redirect() would have made these headers immutable, dropping
    // the cookie and leaving the callback with no state to verify.
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("fde_state=");
    expect(cookie).toContain("HttpOnly");
  });

  it("keeps a relative returnTo, which Response.redirect rejects", async () => {
    const response = await auth.login(loginRequest("/docs/intro"));
    const state = response.headers.get("set-cookie") ?? "";
    const value = decodeURIComponent(
      /fde_state=([^;]*)/.exec(state)?.[1] ?? "",
    );

    expect(JSON.parse(value).returnTo).toBe("/docs/intro");
  });

  it("refuses a returnTo pointing at another origin", async () => {
    const response = await auth.login(loginRequest("https://evil.test/steal"));
    const state = response.headers.get("set-cookie") ?? "";
    const value = decodeURIComponent(
      /fde_state=([^;]*)/.exec(state)?.[1] ?? "",
    );

    expect(JSON.parse(value).returnTo).toBe("/");
  });

  it("clears the session cookie on logout", () => {
    const cookie = auth.logout().headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=;`);
    expect(cookie).toContain("Max-Age=0");
  });
});
