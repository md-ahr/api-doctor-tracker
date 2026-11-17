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
  });
});
