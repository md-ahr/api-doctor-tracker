import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/dashboard.service.js", () => ({
  getDashboard: vi.fn(),
}));

import { createApp } from "../../src/app.js";
import { issueAccessToken } from "../../src/lib/tokens.js";
import { getDashboard } from "../../src/services/dashboard.service.js";

const dashboard = {
  range: { from: "2026-10-19", to: "2026-11-17", timezone: "UTC" },
  totals: { doctors: 12, patients: 148 },
  patientsPerDoctor: [
    {
      doctorId: "665f1c0a2b3c4d5e6f708193",
      name: "Amelia Rahman",
      specialization: "Cardiology",
      patientCount: 20,
    },
  ],
  patientsByCondition: [
    { condition: "critical" as const, patientCount: 0 },
    { condition: "serious" as const, patientCount: 0 },
    { condition: "stable" as const, patientCount: 80 },
    { condition: "recovering" as const, patientCount: 0 },
    { condition: "chronic" as const, patientCount: 0 },
    { condition: "observation" as const, patientCount: 0 },
  ],
  patientsRegisteredByDay: [
    { date: "2026-11-16", count: 4 },
    { date: "2026-11-17", count: 0 },
  ],
  doctorsCreatedByDay: [
    { date: "2026-11-16", count: 1 },
    { date: "2026-11-17", count: 0 },
  ],
};

function adminAuthorization(): string {
  const { token } = issueAccessToken({
    id: "665f1c0a2b3c4d5e6f708192",
    email: "admin@example.com",
    name: "Avery Admin",
    role: "admin",
  });
  return `Bearer ${token}`;
}

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

describe("GET /api/v1/dashboard", () => {
  let server: Server;
  let url: string;

  beforeEach(async () => {
    vi.mocked(getDashboard).mockResolvedValue(dashboard);
    ({ server, url } = await listen());
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("requires a bearer token", async () => {
    const response = await fetch(`${url}/api/v1/dashboard`);
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(getDashboard).not.toHaveBeenCalled();
  });

  it("returns the dashboard resource envelope", async () => {
    const response = await fetch(`${url}/api/v1/dashboard?from=2026-10-19&to=2026-11-17`, {
      headers: { authorization: adminAuthorization() },
    });
    const body = (await response.json()) as {
      success: boolean;
      message: string;
      data: typeof dashboard;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: "Dashboard retrieved successfully",
      data: dashboard,
    });
    expect(getDashboard).toHaveBeenCalledWith({ from: "2026-10-19", to: "2026-11-17" });
  });
});
