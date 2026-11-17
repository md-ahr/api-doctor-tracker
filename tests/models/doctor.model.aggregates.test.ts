import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DoctorModel, countCreatedByDay, create } from "../../src/models/doctor.model.js";

const window = {
  from: new Date("2026-11-17T00:00:00.000Z"),
  to: new Date("2026-11-18T23:59:59.999Z"),
};

describe("doctor model aggregates", () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { autoIndex: false });
    await DoctorModel.createIndexes();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await DoctorModel.deleteMany({});
  });

  it("counts creations by calendar day in the requested timezone", async () => {
    const inside = await create({
      name: "Amelia Rahman",
      specialization: "Cardiology",
      hospital: "City General",
      phone: "+1 202 555 0148",
      email: "amelia@example.com",
    });
    const outside = await create({
      name: "Noah Khan",
      specialization: "Pediatrics",
      hospital: "City General",
      phone: "+1 202 555 0199",
      email: "noah@example.com",
    });
    await DoctorModel.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(inside.id) },
      { $set: { createdAt: new Date("2026-11-17T20:30:00.000Z") } },
    );
    await DoctorModel.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(outside.id) },
      { $set: { createdAt: new Date("2026-11-16T12:00:00.000Z") } },
    );

    await expect(countCreatedByDay(window, "UTC")).resolves.toEqual([
      { date: "2026-11-17", count: 1 },
    ]);
    await expect(countCreatedByDay(window, "Asia/Dhaka")).resolves.toEqual([
      { date: "2026-11-18", count: 1 },
    ]);
  });
});
