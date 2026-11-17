import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/auth.service.js", () => ({
  login: vi.fn(),
  refreshSession: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
}));

import { env } from "../../src/config/env.js";
import { createApp } from "../../src/app.js";
import { loginRateLimit } from "../../src/routes/auth.routes.js";
import { login, refreshSession } from "../../src/services/auth.service.js";

const signedIn = {
  accessToken: "access-token",
  expiresIn: 900,
  refreshToken: "a".repeat(64),
  admin: {
    id: "665f1c0a2b3c4d5e6f708192",
    name: "Avery Admin",
    email: "admin@example.com",
  },
};

async function listen(): Promise<{ server: Server; url: string }> {
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP address");
  }
  return { server, url: `http://127.0.0.1:${address.port}` };
}

describe("auth routes", () => {
  let server: Server;
  let url: string;

  beforeEach(async () => {
    vi.mocked(login).mockResolvedValue(signedIn);
    vi.mocked(refreshSession).mockResolvedValue({
      ...signedIn,
      refreshToken: "b".repeat(64),
    });
    await loginRateLimit.resetKey("127.0.0.1");
    ({ server, url } = await listen());
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("sets an HttpOnly Secure SameSite=None refresh cookie on login", async () => {
    const response = await fetch(`${url}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "correct horse" }),
    });
    const setCookie = response.headers.getSetCookie().join(";");

    expect(response.status).toBe(200);
    expect(setCookie).toContain("dt_refresh=");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=None/i);
    expect(setCookie).toMatch(/Path=\/api\/v1\/auth/i);
  });

  it("rejects refresh when Origin is not the frontend origin", async () => {
    const response = await fetch(`${url}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { cookie: "dt_refresh=old-token" },
    });

    expect(response.status).toBe(403);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("refreshes when Origin matches FRONTEND_ORIGIN", async () => {
    const response = await fetch(`${url}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { origin: env.FRONTEND_ORIGIN, cookie: "dt_refresh=old-token" },
    });

    expect(response.status).toBe(200);
    expect(refreshSession).toHaveBeenCalledWith("old-token");
  });

  it("returns 401 from GET me without a bearer token", async () => {
    const response = await fetch(`${url}/api/v1/auth/me`);
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rate limits login after 10 requests and still allows refresh", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch(`${url}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@example.com", password: "correct horse" }),
      });
      expect(response.status).toBe(200);
    }

    const limited = await fetch(`${url}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "correct horse" }),
    });
    const limitedBody = (await limited.json()) as { error: { code: string } };
    expect(limited.status).toBe(429);
    expect(limitedBody.error.code).toBe("RATE_LIMITED");

    const refresh = await fetch(`${url}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { origin: env.FRONTEND_ORIGIN, cookie: "dt_refresh=old-token" },
    });
    expect(refresh.status).toBe(200);
  });
});
