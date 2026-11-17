import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/models/doctor.model.js", () => ({
  findById: vi.fn(),
  findByIds: vi.fn(),
  findByEmail: vi.fn(),
  search: vi.fn(),
  facets: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../src/models/patient.model.js", () => ({
  search: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  countActive: vi.fn(),
}));

import { createApp } from "../../src/app.js";
import { issueAccessToken } from "../../src/lib/tokens.js";
import { findById as findDoctorById } from "../../src/models/doctor.model.js";
import { search } from "../../src/models/patient.model.js";

const doctorId = "665f1c0a2b3c4d5e6f708193";

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

describe("doctor patient routes", () => {
  let server: Server;
  let url: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ server, url } = await listen());
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns 404 before listing when the doctor does not exist", async () => {
    vi.mocked(findDoctorById).mockResolvedValue(null);

    const response = await fetch(`${url}/api/v1/doctors/${doctorId}/patients`, {
      headers: { authorization: adminAuthorization() },
    });
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("DOCTOR_NOT_FOUND");
    expect(search).not.toHaveBeenCalled();
  });

  it("rejects a query doctorId", async () => {
    const response = await fetch(
      `${url}/api/v1/doctors/${doctorId}/patients?doctorId=${doctorId}`,
      { headers: { authorization: adminAuthorization() } },
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(findDoctorById).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });
});
