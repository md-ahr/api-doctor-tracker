import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DoctorModel, create, search, facets } from "../../src/models/doctor.model.js";

function doctor(email: string, overrides: Partial<Parameters<typeof create>[0]> = {}) {
  return {
    name: "Amelia Rahman",
    specialization: "Cardiology",
    hospital: "City General",
    phone: "+1 202 555 0148",
    email,
    ...overrides,
  };
}

describe("doctor model search", () => {
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

  it("returns total and a page no larger than the limit", async () => {
    await create(doctor("one@example.com", { name: "One" }));
    await create(doctor("two@example.com", { name: "Two" }));
    await create(doctor("three@example.com", { name: "Three" }));

    const page = await search({ page: 1, limit: 2, sort: "createdAt" });

    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(2);
    expect(page.page).toBe(1);
    expect(page.limit).toBe(2);
  });

  it("matches specialization without regard to case", async () => {
    await create(doctor("amelia@example.com", { specialization: "Cardiology" }));
    await create(doctor("noah@example.com", { specialization: "Pediatrics" }));

    const page = await search({
      page: 1,
      limit: 20,
      sort: "name",
      specialization: "cardiology",
    });

    expect(page.total).toBe(1);
    expect(page.items.map((item) => item.email)).toEqual(["amelia@example.com"]);
  });

  it("treats a dot in q as a literal character", async () => {
    await create(doctor("dotted@example.com", { name: "A.B. Khan" }));
    await create(doctor("plain@example.com", { name: "AXB Khan" }));

    const page = await search({ page: 1, limit: 20, sort: "name", q: "A.B" });

    expect(page.items.map((item) => item.email)).toEqual(["dotted@example.com"]);
  });

  it("returns stored facet values in case-insensitive order", async () => {
    await create(
      doctor("a@example.com", { specialization: "pediatrics", hospital: "city general" }),
    );
    await create(doctor("b@example.com", { specialization: "Cardiology", hospital: "River" }));

    await expect(facets()).resolves.toEqual({
      specializations: ["Cardiology", "pediatrics"],
      hospitals: ["city general", "River"],
    });
  });
});
