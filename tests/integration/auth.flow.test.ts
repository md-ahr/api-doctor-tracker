import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createIndexes } from "../../src/db/mongoose.js";
import { env } from "../../src/config/env.js";
import { hashPassword } from "../../src/lib/password.js";
import { create as createAdmin } from "../../src/models/user.model.js";

const password = "correct horse";

function refreshCookie(response: Response): string {
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith("dt_refresh="));
  if (!cookie) throw new Error("Expected a dt_refresh cookie");
  return cookie.split(";")[0] ?? cookie;
}

async function listen(): Promise<{ server: Server; url: string }> {
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP address");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

describe("auth integration", () => {
  let mongo: MongoMemoryServer;
  let server: Server;
  let url: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { autoIndex: false });
    await createIndexes();
    await createAdmin({
      name: "Avery Admin",
      email: "admin@example.com",
      passwordHash: await hashPassword(password),
      role: "admin",
    });
    ({ server, url } = await listen());
  }, 60_000);

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("logs in, rotates the refresh cookie, and logs out", async () => {
    const login = await fetch(`${url}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password }),
    });
    const loginBody = (await login.json()) as {
      success: boolean;
      message: string;
      data: { accessToken: string; expiresIn: number; admin: { email: string } };
    };
    const firstCookie = refreshCookie(login);

    expect(login.status).toBe(200);
    expect(loginBody.success).toBe(true);
    expect(loginBody.message).toBe("Signed in successfully");
    expect(loginBody.data.admin.email).toBe("admin@example.com");
    expect(loginBody.data.expiresIn).toBe(900);
    expect(loginBody.data.accessToken.length).toBeGreaterThan(20);

    const refresh = await fetch(`${url}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { origin: env.FRONTEND_ORIGIN, cookie: firstCookie },
    });
    const refreshBody = (await refresh.json()) as {
      message: string;
      data: { accessToken: string };
    };
    const rotatedCookie = refreshCookie(refresh);

    expect(refresh.status).toBe(200);
    expect(refreshBody.message).toBe("Session refreshed successfully");
    expect(rotatedCookie).not.toBe(firstCookie);

    const me = await fetch(`${url}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${refreshBody.data.accessToken}` },
    });
    expect(me.status).toBe(200);

    const logout = await fetch(`${url}/api/v1/auth/logout`, {
      method: "POST",
      headers: { origin: env.FRONTEND_ORIGIN, cookie: rotatedCookie },
    });
    const logoutBody = (await logout.json()) as { success: boolean; data: unknown };

    expect(logout.status).toBe(200);
    expect(logoutBody).toMatchObject({
      success: true,
      message: "Signed out successfully",
      data: null,
    });

    const reused = await fetch(`${url}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { origin: env.FRONTEND_ORIGIN, cookie: rotatedCookie },
    });
    const reusedBody = (await reused.json()) as { error: { code: string } };

    expect(reused.status).toBe(401);
    expect(reusedBody.error.code).toBe("UNAUTHENTICATED");
    expect(reused.headers.getSetCookie().some((value) => value.startsWith("dt_refresh="))).toBe(
      false,
    );
  });

  it("lets exactly one of two concurrent refreshes rotate a cookie", async () => {
    const login = await fetch(`${url}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password }),
    });
    const cookie = refreshCookie(login);

    const refresh = () =>
      fetch(`${url}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { origin: env.FRONTEND_ORIGIN, cookie },
      });
    const [first, second] = await Promise.all([refresh(), refresh()]);

    expect([first.status, second.status].sort()).toEqual([200, 401]);

    const loser = first.status === 401 ? first : second;
    expect(loser.headers.getSetCookie().some((value) => value.startsWith("dt_refresh="))).toBe(
      false,
    );
  });
});
