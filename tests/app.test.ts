import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/db/mongoose.js", () => ({
  pingDatabase: vi.fn(),
}));

import { pingDatabase } from "../src/db/mongoose.js";
import { createApp } from "../src/app.js";

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

describe("createApp", () => {
  let server: Server;
  let url: string;

  beforeEach(async () => {
    vi.mocked(pingDatabase).mockResolvedValue(true);
    ({ server, url } = await listen());
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns 404 VALIDATION_ERROR for an unknown path", async () => {
    const response = await fetch(`${url}/api/v1/missing`);
    const body = (await response.json()) as {
      success: boolean;
      message: string;
      error: { code: string; details: unknown[] };
    };

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Route not found");
    expect(body.error).toEqual({ code: "VALIDATION_ERROR", details: [] });
  });

  it("mounts health at /api/v1/health", async () => {
    const response = await fetch(`${url}/api/v1/health`, {
      headers: { Origin: "http://localhost:3000" },
    });
    const body = (await response.json()) as { data: { database: string } };

    expect(response.status).toBe(200);
    expect(body.data.database).toBe("up");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });
});
