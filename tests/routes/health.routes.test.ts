import type { Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/db/mongoose.js", () => ({
  pingDatabase: vi.fn(),
}));

import { pingDatabase } from "../../src/db/mongoose.js";
import { healthRouter } from "../../src/routes/health.routes.js";

const isoDatetime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

async function listen(app: express.Express): Promise<{ server: Server; url: string }> {
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP address");
  }
  return { server, url: `http://127.0.0.1:${address.port}` };
}

describe("GET / health", () => {
  let server: Server;
  let url: string;

  beforeEach(async () => {
    const app = express();
    app.use(healthRouter);
    ({ server, url } = await listen(app));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns 200 with database up and an ISO datetime when the ping succeeds", async () => {
    vi.mocked(pingDatabase).mockResolvedValue(true);

    const response = await fetch(url);
    const body = (await response.json()) as {
      success: boolean;
      message: string;
      data: { status: string; database: string; datetime: string };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe("Service is healthy");
    expect(body.data.status).toBe("ok");
    expect(body.data.database).toBe("up");
    expect(body.data.datetime).toMatch(isoDatetime);
  });

  it("returns 503 with database down and INTERNAL when the ping fails", async () => {
    vi.mocked(pingDatabase).mockResolvedValue(false);

    const response = await fetch(url);
    const body = (await response.json()) as {
      success: boolean;
      message: string;
      data: { status: string; database: string; datetime: string };
      error: { code: string; details: unknown[] };
    };

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Database unavailable");
    expect(body.data.status).toBe("degraded");
    expect(body.data.database).toBe("down");
    expect(body.data.datetime).toMatch(isoDatetime);
    expect(body.error).toEqual({ code: "INTERNAL", details: [] });
  });
});
