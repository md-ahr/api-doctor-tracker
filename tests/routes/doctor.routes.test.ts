import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/doctor.service.js", () => ({
  createDoctor: vi.fn(),
  listDoctors: vi.fn(),
  getDoctor: vi.fn(),
  updateDoctor: vi.fn(),
  getDoctorFacets: vi.fn(),
}));

import { createApp } from "../../src/app.js";
import { DomainError } from "../../src/lib/errors.js";
import { issueAccessToken } from "../../src/lib/tokens.js";
import {
  createDoctor,
  getDoctor,
  getDoctorFacets,
  listDoctors,
  updateDoctor,
} from "../../src/services/doctor.service.js";

const doctorId = "665f1c0a2b3c4d5e6f708193";
const createdAt = new Date("2026-11-01T10:00:00.000Z");
const updatedAt = new Date("2026-11-01T10:00:00.000Z");

const doctor = {
  id: doctorId,
  name: "Amelia Rahman",
  specialization: "Cardiology",
  hospital: "City General",
  phone: "+1 202 555 0148",
  email: "amelia@citygeneral.example",
  createdAt,
  updatedAt,
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

describe("doctor routes", () => {
  let server: Server;
  let url: string;

  beforeEach(async () => {
    vi.mocked(createDoctor).mockResolvedValue(doctor);
    vi.mocked(listDoctors).mockResolvedValue({
      items: [doctor],
      page: 1,
      limit: 20,
      total: 21,
    });
    vi.mocked(getDoctor).mockResolvedValue({ ...doctor, activePatientCount: 2 });
    vi.mocked(getDoctorFacets).mockResolvedValue({
      specializations: ["Cardiology"],
      hospitals: ["City General"],
    });
    vi.mocked(updateDoctor).mockResolvedValue({
      ...doctor,
      name: "Amelia R.",
      updatedAt: new Date("2026-11-02T10:00:00.000Z"),
    });
    ({ server, url } = await listen());
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("creates a doctor with a 201 envelope", async () => {
    const response = await fetch(`${url}/api/v1/doctors`, {
      method: "POST",
      headers: {
        authorization: adminAuthorization(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: doctor.name,
        specialization: doctor.specialization,
        hospital: doctor.hospital,
        phone: doctor.phone,
        email: doctor.email,
      }),
    });
    const body = (await response.json()) as {
      success: boolean;
      message: string;
      data: { id: string; createdAt: string; updatedAt: string };
    };

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.message).toBe("Doctor created successfully");
    expect(body.data).toMatchObject({
      id: doctorId,
      email: doctor.email,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("returns page metadata on the doctor list", async () => {
    const response = await fetch(`${url}/api/v1/doctors`, {
      headers: { authorization: adminAuthorization() },
    });
    const body = (await response.json()) as {
      success: boolean;
      message: string;
      data: unknown[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    };

    expect(response.status).toBe(200);
    expect(body.message).toBe("Doctors retrieved successfully");
    expect(body.data).toHaveLength(1);
    expect(body.meta.page).toBe(1);
    expect(body.meta.totalPages).toBe(2);
  });

  it("returns 404 DOCTOR_NOT_FOUND for an unknown id", async () => {
    vi.mocked(getDoctor).mockRejectedValue(new DomainError("DOCTOR_NOT_FOUND"));

    const response = await fetch(`${url}/api/v1/doctors/${doctorId}`, {
      headers: { authorization: adminAuthorization() },
    });
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("DOCTOR_NOT_FOUND");
  });

  it("returns facets from the literal path", async () => {
    const response = await fetch(`${url}/api/v1/doctors/facets`, {
      headers: { authorization: adminAuthorization() },
    });
    const body = (await response.json()) as {
      message: string;
      data: { specializations: string[]; hospitals: string[] };
    };

    expect(response.status).toBe(200);
    expect(body.message).toBe("Doctor facets retrieved successfully");
    expect(body.data.specializations).toEqual(["Cardiology"]);
  });

  it("updates a doctor", async () => {
    const response = await fetch(`${url}/api/v1/doctors/${doctorId}`, {
      method: "PATCH",
      headers: {
        authorization: adminAuthorization(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Amelia R." }),
    });
    const body = (await response.json()) as { message: string; data: { name: string } };

    expect(response.status).toBe(200);
    expect(body.message).toBe("Doctor updated successfully");
    expect(body.data.name).toBe("Amelia R.");
    expect(updateDoctor).toHaveBeenCalledWith(doctorId, { name: "Amelia R." });
  });
});
