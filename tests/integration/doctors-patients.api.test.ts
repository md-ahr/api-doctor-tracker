import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createIndexes } from "../../src/db/mongoose.js";
import { hashPassword } from "../../src/lib/password.js";
import { create as createAdmin } from "../../src/models/user.model.js";

const password = "correct horse";

async function listen(): Promise<{ server: Server; url: string }> {
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP address");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

describe("doctor and patient API", () => {
  let mongo: MongoMemoryServer;
  let server: Server;
  let url: string;
  let authorization: string;

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

    const login = await fetch(`${url}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password }),
    });
    const body = (await login.json()) as { data: { accessToken: string } };
    authorization = `Bearer ${body.data.accessToken}`;
  }, 60_000);

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("creates doctors and paginates the list envelope", async () => {
    for (const email of ["amelia@citygeneral.example", "priya@citygeneral.example"]) {
      const created = await fetch(`${url}/api/v1/doctors`, {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: JSON.stringify({
          name: email.startsWith("amelia") ? "Amelia Rahman" : "Priya Shah",
          specialization: "Cardiology",
          hospital: "City General",
          phone: "+1 202 555 0148",
          email,
        }),
      });
      const body = (await created.json()) as { success: boolean; message: string };
      expect(created.status).toBe(201);
      expect(body).toMatchObject({ success: true, message: "Doctor created successfully" });
    }

    const page = await fetch(`${url}/api/v1/doctors?limit=1`, { headers: { authorization } });
    const pageBody = (await page.json()) as {
      success: boolean;
      data: unknown[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    };

    expect(page.status).toBe(200);
    expect(pageBody.success).toBe(true);
    expect(pageBody.data).toHaveLength(1);
    expect(pageBody.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });

    const tooLarge = await fetch(`${url}/api/v1/doctors?limit=51`, { headers: { authorization } });
    const tooLargeBody = (await tooLarge.json()) as { error: { code: string } };
    expect(tooLarge.status).toBe(400);
    expect(tooLargeBody.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates, updates, and soft-deletes a patient", async () => {
    const missing = await fetch(`${url}/api/v1/doctors/${"f".repeat(24)}`, {
      headers: { authorization },
    });
    const missingBody = (await missing.json()) as { error: { code: string } };
    expect(missing.status).toBe(404);
    expect(missingBody.error.code).toBe("DOCTOR_NOT_FOUND");

    const doctor = await fetch(`${url}/api/v1/doctors`, {
      method: "POST",
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Helena Ortiz",
        specialization: "Neurology",
        hospital: "City General",
        phone: "+1 202 555 0177",
        email: "helena@citygeneral.example",
      }),
    });
    const doctorBody = (await doctor.json()) as { data: { id: string } };

    const created = await fetch(`${url}/api/v1/patients`, {
      method: "POST",
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify({
        doctorId: doctorBody.data.id,
        fullName: "Noah Khan",
        condition: "stable",
        notes: "Follow up",
      }),
    });
    const createdBody = (await created.json()) as {
      message: string;
      data: { id: string; doctorName: string; notes: string };
    };
    expect(created.status).toBe(201);
    expect(createdBody.message).toBe("Patient created successfully");
    expect(createdBody.data.doctorName).toBe("Helena Ortiz");

    const patched = await fetch(`${url}/api/v1/patients/${createdBody.data.id}`, {
      method: "PATCH",
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify({ notes: null, condition: "recovering" }),
    });
    const patchedBody = (await patched.json()) as {
      message: string;
      data: { notes: string | null; condition: string };
    };
    expect(patched.status).toBe(200);
    expect(patchedBody.message).toBe("Patient updated successfully");
    expect(patchedBody.data.notes).toBeNull();
    expect(patchedBody.data.condition).toBe("recovering");

    const removed = await fetch(`${url}/api/v1/patients/${createdBody.data.id}`, {
      method: "DELETE",
      headers: { authorization },
    });
    const removedBody = (await removed.json()) as { data: unknown };
    expect(removed.status).toBe(200);
    expect(removedBody.data).toBeNull();

    const again = await fetch(`${url}/api/v1/patients/${createdBody.data.id}`, {
      method: "DELETE",
      headers: { authorization },
    });
    const againBody = (await again.json()) as { error: { code: string } };
    expect(again.status).toBe(404);
    expect(againBody.error.code).toBe("PATIENT_NOT_FOUND");
  });
});
