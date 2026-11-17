import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";

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

describe("swagger routes", () => {
  let server: Server;
  let url: string;

  beforeEach(async () => {
    ({ server, url } = await listen());
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns the OpenAPI document without a bearer token", async () => {
    const response = await fetch(`${url}/api/docs/openapi.json`);
    const body = (await response.json()) as { openapi: string; paths: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.openapi).toBe("3.0.0");
    expect(body.paths["/api/v1/dashboard"]).toBeDefined();
  });

  it("returns the Swagger UI HTML without a bearer token", async () => {
    const response = await fetch(`${url}/api/docs/`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("swagger");
  });
});
