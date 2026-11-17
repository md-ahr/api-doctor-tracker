import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { SessionModel, create, findLiveByHash, revoke } from "../../src/models/session.model.js";

const adminId = new mongoose.Types.ObjectId().toString();

describe("session model", () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { autoIndex: false });
    await SessionModel.createIndexes();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await SessionModel.deleteMany({});
  });

  it("ignores revoked sessions in findLiveByHash", async () => {
    const now = new Date();
    const later = new Date(now.getTime() + 60_000);
    await create({ adminId, tokenHash: "live", expiresAt: later });
    await create({ adminId, tokenHash: "revoked", expiresAt: later });
    const revoked = await SessionModel.findOne({ tokenHash: "revoked" }).lean();
    if (!revoked) throw new Error("Expected the revoked session to be stored");

    await revoke(revoked._id.toString(), now);

    expect(await findLiveByHash("revoked", now)).toBeNull();
    expect(await findLiveByHash("live", now)).toEqual({
      id: expect.any(String),
      adminId,
    });
  });

  it("sets revokedAt when revoke is called", async () => {
    const revokedAt = new Date("2026-11-17T12:00:00.000Z");
    await create({
      adminId,
      tokenHash: "to-revoke",
      expiresAt: new Date(revokedAt.getTime() + 60_000),
    });

    const stored = await SessionModel.findOne({ tokenHash: "to-revoke" }).lean();
    if (!stored) throw new Error("Expected the session to be stored");
    await revoke(stored._id.toString(), revokedAt);

    const after = await SessionModel.findById(stored._id).lean();
    expect(after?.revokedAt).toEqual(revokedAt);
  });

  it("does not return an expired session as live", async () => {
    const now = new Date();
    await create({
      adminId,
      tokenHash: "expired",
      expiresAt: new Date(now.getTime() - 1_000),
    });

    expect(await findLiveByHash("expired", now)).toBeNull();
  });
});
