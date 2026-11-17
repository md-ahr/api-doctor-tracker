import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { isDuplicateKeyError } from "../../src/lib/errors.js";
import { AdminModel, create, findByEmail, findById } from "../../src/models/admin.model.js";

const admin = {
  name: "Ada Lovelace",
  email: "Ada@Example.com",
  passwordHash: "hash",
  role: "admin" as const,
};

describe("admin model", () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { autoIndex: false });
    await AdminModel.createIndexes();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await AdminModel.deleteMany({});
  });

  it("stores the email in lowercase", async () => {
    const created = await create(admin);

    expect(created.email).toBe("ada@example.com");
    expect(created).toEqual({
      id: created.id,
      name: admin.name,
      email: "ada@example.com",
      role: "admin",
    });

    const found = await findByEmail("ADA@example.com");
    expect(found).toMatchObject({
      id: created.id,
      email: "ada@example.com",
      passwordHash: admin.passwordHash,
    });
  });

  it("rejects a duplicate email with the unique index", async () => {
    await create(admin);

    await expect(create({ ...admin, name: "Augusta" })).rejects.toSatisfy(isDuplicateKeyError);
  });

  it("returns the admin by id and null when the id is missing", async () => {
    const created = await create(admin);

    expect(await findById(created.id)).toMatchObject({
      id: created.id,
      email: "ada@example.com",
      passwordHash: admin.passwordHash,
    });
    expect(await findById("665f1c0a2b3c4d5e6f708192")).toBeNull();
    expect(await findById("not-an-id")).toBeNull();
  });

  it("returns null from findByEmail when the admin is missing", async () => {
    expect(await findByEmail("missing@example.com")).toBeNull();
  });
});
