import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

describe("mongoose bootstrap", () => {
  let stop: () => Promise<void>;
  let connectDatabase: () => Promise<void>;
  let pingDatabase: () => Promise<boolean>;
  let createIndexes: () => Promise<void>;

  beforeAll(async () => {
    const mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    vi.resetModules();
    const db = await import("../../src/db/mongoose.js");
    const mongoose = (await import("mongoose")).default;
    connectDatabase = db.connectDatabase;
    pingDatabase = db.pingDatabase;
    createIndexes = db.createIndexes;
    await connectDatabase();
    stop = async () => {
      await mongoose.disconnect();
      await mongo.stop();
    };
  }, 60_000);

  afterAll(async () => {
    await stop();
  });

  it("connects and pingDatabase returns true", async () => {
    expect(await pingDatabase()).toBe(true);
  });

  it("createIndexes resolves without error", async () => {
    await expect(createIndexes()).resolves.toBeUndefined();

    const { DoctorModel } = await import("../../src/models/doctor.model.js");
    const { PatientModel } = await import("../../src/models/patient.model.js");
    const indexes = await DoctorModel.listIndexes();
    const patientIndexes = await PatientModel.listIndexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { email: 1 }, unique: true }),
        expect.objectContaining({ key: { createdAt: -1, _id: -1 } }),
        expect.objectContaining({
          key: { specialization: 1, createdAt: -1 },
          collation: expect.objectContaining({ locale: "en", strength: 2 }),
        }),
        expect.objectContaining({
          key: { hospital: 1, createdAt: -1 },
          collation: expect.objectContaining({ locale: "en", strength: 2 }),
        }),
      ]),
    );
    expect(patientIndexes).toEqual(
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
