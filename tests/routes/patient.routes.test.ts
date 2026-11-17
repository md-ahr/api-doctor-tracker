import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/patient.service.js", () => ({
  createPatient: vi.fn(),
  listPatients: vi.fn(),
  getPatient: vi.fn(),
  updatePatient: vi.fn(),
  deletePatient: vi.fn(),
  listDoctorPatients: vi.fn(),
}));

import { createApp } from "../../src/app.js";
import { issueAccessToken } from "../../src/lib/tokens.js";
import { deletePatient, updatePatient } from "../../src/services/patient.service.js";

const patientId = "665f1c0a2b3c4d5e6f708194";
const doctorId = "665f1c0a2b3c4d5e6f708193";

const patient = {
  id: patientId,
  doctorId,
  doctorName: "Amelia Rahman",
  fullName: "Noah Khan",
  dateOfBirth: null as string | null,
  sex: "male" as const,
  phone: "+1 202 555 0199",
  email: "noah@example.com",
  condition: "stable" as const,
  notes: null as string | null,
  registeredAt: "2026-11-16T00:00:00.000Z",
  createdAt: "2026-11-16T08:00:00.000Z",
  updatedAt: "2026-11-16T08:00:00.000Z",
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

describe("patient routes", () => {
  let server: Server;
  let url: string;

  beforeEach(async () => {
    vi.mocked(updatePatient).mockResolvedValue({ ...patient, dateOfBirth: null, notes: null });
    vi.mocked(deletePatient).mockResolvedValue(undefined);
    ({ server, url } = await listen());
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("deletes a patient with a null data envelope", async () => {
    const response = await fetch(`${url}/api/v1/patients/${patientId}`, {
      method: "DELETE",
      headers: { authorization: adminAuthorization() },
    });
    const body = (await response.json()) as { success: boolean; message: string; data: unknown };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: "Patient deleted successfully",
      data: null,
    });
    expect(deletePatient).toHaveBeenCalledWith(patientId);
  });

  it("passes null when a patch clears optional fields", async () => {
    const response = await fetch(`${url}/api/v1/patients/${patientId}`, {
      method: "PATCH",
      headers: {
        authorization: adminAuthorization(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ dateOfBirth: null, notes: null }),
    });
    const body = (await response.json()) as {
      message: string;
      data: { dateOfBirth: string | null; notes: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.message).toBe("Patient updated successfully");
    expect(body.data.dateOfBirth).toBeNull();
    expect(body.data.notes).toBeNull();
    expect(updatePatient).toHaveBeenCalledWith(patientId, { dateOfBirth: null, notes: null });
  });
});
