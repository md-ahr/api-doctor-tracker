import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  DoctorModel,
  create,
  findByEmail,
  findById,
  findByIds,
  update,
} from "../../src/models/doctor.model.js";

const input = {
  name: "Amelia Rahman",
  specialization: "Cardiology",
  hospital: "City General",
  phone: "+1 202 555 0148",
  email: "Amelia@CityGeneral.example",
};

describe("doctor model CRUD", () => {
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

  it("stores the email in lowercase", async () => {
    const created = await create(input);

    expect(created.email).toBe("amelia@citygeneral.example");
    expect(created).toMatchObject({
      name: input.name,
      specialization: input.specialization,
      hospital: input.hospital,
      phone: input.phone,
    });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    const found = await findByEmail("AMELIA@citygeneral.example");
    expect(found?.id).toBe(created.id);
    expect(found?.email).toBe("amelia@citygeneral.example");
  });

  it("returns null from findById when the doctor is missing", async () => {
    expect(await findById("665f1c0a2b3c4d5e6f708193")).toBeNull();
    expect(await findById("not-an-id")).toBeNull();
  });

  it("returns name and specialization for the requested ids", async () => {
    const created = await create(input);
    const found = await findByIds([created.id, "665f1c0a2b3c4d5e6f708193"]);

    expect(found).toEqual([
      { id: created.id, name: input.name, specialization: input.specialization },
    ]);
  });

  it("updates provided fields and returns null for an unknown id", async () => {
    const created = await create(input);
    const updated = await update(created.id, {
      hospital: "River Hospital",
      email: "Amelia@River.example",
    });

    expect(updated).toMatchObject({
      id: created.id,
      hospital: "River Hospital",
      email: "amelia@river.example",
      name: input.name,
    });
    expect(await update("665f1c0a2b3c4d5e6f708193", { name: "Missing" })).toBeNull();
  });
});
