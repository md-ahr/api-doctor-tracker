import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  PatientModel,
  count,
  countActive,
  countByCondition,
  countByDoctor,
  countRegisteredByDay,
  create,
  softDelete,
  type PatientInput,
} from "../../src/models/patient.model.js";

const window = {
  from: new Date("2026-11-17T00:00:00.000Z"),
  to: new Date("2026-11-18T23:59:59.999Z"),
};

function patient(doctorId: string, overrides: Partial<PatientInput> = {}): PatientInput {
  return {
    doctorId,
    fullName: "Noah Khan",
    condition: "stable",
    registeredAt: new Date("2026-11-17T20:30:00.000Z"),
    ...overrides,
  };
}

describe("patient model aggregates", () => {
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

  it("excludes deleted patients from dashboard counts", async () => {
    const doctorId = new mongoose.Types.ObjectId().toString();
    const otherDoctorId = new mongoose.Types.ObjectId().toString();
    await create(patient(doctorId, { condition: "stable" }));
    await create(patient(doctorId, { condition: "critical", fullName: "Ada" }));
    await create(patient(otherDoctorId, { condition: "stable", fullName: "Bea" }));
    const deleted = await create(
      patient(doctorId, {
        condition: "chronic",
        fullName: "Gone",
        registeredAt: new Date("2026-11-17T12:00:00.000Z"),
      }),
    );
    await softDelete(deleted.id, new Date("2026-11-17T18:00:00.000Z"));
    const outside = await create(
      patient(doctorId, {
        condition: "stable",
        fullName: "Outside",
        registeredAt: new Date("2026-11-16T12:00:00.000Z"),
      }),
    );

    expect(await count()).toBe(4);
    expect(await countActive(doctorId)).toBe(3);
    expect(await countActive()).toBe(4);

    const byDoctor = await countByDoctor();
    expect(byDoctor).toEqual(
      expect.arrayContaining([
        { doctorId, patientCount: 3 },
        { doctorId: otherDoctorId, patientCount: 1 },
      ]),
    );
    expect(byDoctor).toHaveLength(2);

    const byCondition = await countByCondition();
    expect(byCondition).toEqual(
      expect.arrayContaining([
        { condition: "stable", patientCount: 3 },
        { condition: "critical", patientCount: 1 },
      ]),
    );
    expect(byCondition.map((row) => row.condition)).not.toContain("chronic");

    await expect(countRegisteredByDay(window, "UTC")).resolves.toEqual([
      { date: "2026-11-17", count: 3 },
    ]);
    await expect(countRegisteredByDay(window, "Asia/Dhaka")).resolves.toEqual([
      { date: "2026-11-18", count: 3 },
    ]);
    expect(outside.id).toBeTruthy();
  });
});
