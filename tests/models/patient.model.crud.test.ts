import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  PatientModel,
  create,
  findById,
  softDelete,
  update,
  type PatientInput,
} from "../../src/models/patient.model.js";

function patient(doctorId: string, overrides: Partial<PatientInput> = {}): PatientInput {
  return {
    doctorId,
    fullName: "Noah Khan",
    dateOfBirth: "1984-04-12",
    sex: "male",
    phone: "+1 202 555 0199",
    email: "Noah@Example.com",
    condition: "stable",
    notes: "Registered from the cardiology clinic.",
    registeredAt: new Date("2026-11-16T00:00:00.000Z"),
    ...overrides,
  };
}

describe("patient model CRUD", () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { autoIndex: false });
    await PatientModel.createIndexes();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await PatientModel.deleteMany({});
  });

  it("stores a patient and hides a soft-deleted row from findById", async () => {
    const doctorId = new mongoose.Types.ObjectId().toString();
    const created = await create(patient(doctorId));

    expect(created.email).toBe("noah@example.com");
    expect(created.deletedAt).toBeNull();
    expect(await findById(created.id)).toMatchObject({ id: created.id, fullName: "Noah Khan" });

    const deletedAt = new Date("2026-11-17T08:00:00.000Z");
    expect(await softDelete(created.id, deletedAt)).toBe(true);
    expect(await findById(created.id)).toBeNull();
    expect(await softDelete(created.id, deletedAt)).toBe(false);
    expect(await findById("not-an-id")).toBeNull();
  });

  it("updates an active patient and returns null when the id is missing", async () => {
    const doctorId = new mongoose.Types.ObjectId().toString();
    const created = await create(patient(doctorId));
    const updated = await update(created.id, { notes: null, email: "Noah@Clinic.example" });

    expect(updated).toMatchObject({
      id: created.id,
      notes: null,
      email: "noah@clinic.example",
      fullName: "Noah Khan",
    });
    expect(await update("665f1c0a2b3c4d5e6f708194", { fullName: "Missing" })).toBeNull();
  });

  it("declares partial indexes for active patients", async () => {
    const indexes = await PatientModel.listIndexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: { doctorId: 1, registeredAt: -1, _id: -1 },
          partialFilterExpression: { deletedAt: null },
        }),
        expect.objectContaining({
          key: { registeredAt: -1, _id: -1 },
          partialFilterExpression: { deletedAt: null },
        }),
        expect.objectContaining({
          key: { condition: 1, registeredAt: -1 },
          partialFilterExpression: { deletedAt: null },
        }),
      ]),
    );
  });
});
