import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PatientModel,
  create,
  search,
  softDelete,
  type PatientInput,
} from "../../src/models/patient.model.js";

function patient(doctorId: string, overrides: Partial<PatientInput> = {}): PatientInput {
  return {
    doctorId,
    fullName: "Noah Khan",
    condition: "stable",
    email: "noah@example.com",
    phone: "+1 202 555 0199",
    registeredAt: new Date("2026-11-16T00:00:00.000Z"),
    ...overrides,
  };
}

function indexNames(plan: unknown): string[] {
  if (!plan || typeof plan !== "object") return [];
  const node = plan as {
    indexName?: string;
    inputStage?: unknown;
    inputStages?: unknown[];
  };
  const names = node.indexName ? [node.indexName] : [];
  names.push(...indexNames(node.inputStage));
  for (const stage of node.inputStages ?? []) names.push(...indexNames(stage));
  return names;
}

describe("patient model search", () => {
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

  it("excludes soft-deleted rows and keeps doctor plus condition on the doctor index", async () => {
    const doctorId = new mongoose.Types.ObjectId().toString();
    const otherDoctorId = new mongoose.Types.ObjectId().toString();
    await create(patient(doctorId, { fullName: "Active Stable", email: "active@example.com" }));
    const deleted = await create(
      patient(doctorId, { fullName: "Deleted Stable", email: "deleted@example.com" }),
    );
    await softDelete(deleted.id, new Date("2026-11-17T00:00:00.000Z"));
    await create(
      patient(doctorId, {
        fullName: "Active Critical",
        condition: "critical",
        email: "critical@example.com",
      }),
    );
    await create(patient(otherDoctorId, { fullName: "Other Stable", email: "other@example.com" }));

    const filters: unknown[] = [];
    const find = PatientModel.find.bind(PatientModel);
    const spy = vi.spyOn(PatientModel, "find").mockImplementation(((filter: unknown) => {
      filters.push(filter);
      return find(filter as never);
    }) as typeof PatientModel.find);

    const page = await search({
      doctorId,
      condition: "stable",
      page: 1,
      limit: 20,
      sort: "registeredAt",
    });
    spy.mockRestore();

    expect(page.total).toBe(1);
    expect(page.items.map((item) => item.fullName)).toEqual(["Active Stable"]);
    expect(filters[0]).toEqual({
      deletedAt: null,
      doctorId: new mongoose.Types.ObjectId(doctorId),
      condition: "stable",
    });

    const explained = JSON.parse(
      JSON.stringify(
        await PatientModel.find(filters[0] as mongoose.QueryFilter<unknown>)
          .sort({ registeredAt: -1, _id: -1 })
          .explain(),
      ),
    ) as { queryPlanner: { winningPlan: unknown } };

    expect(indexNames(explained.queryPlanner.winningPlan)).toEqual([
      "doctorId_1_registeredAt_-1__id_-1",
    ]);
  });

  it("treats a dot in q as a literal character", async () => {
    const doctorId = new mongoose.Types.ObjectId().toString();
    await create(patient(doctorId, { fullName: "A.B. Khan", email: "dotted@example.com" }));
    await create(patient(doctorId, { fullName: "AXB Khan", email: "plain@example.com" }));

    const page = await search({ page: 1, limit: 20, sort: "fullName", q: "A.B" });

    expect(page.items.map((item) => item.email)).toEqual(["dotted@example.com"]);
  });

  it("sorts by full name and pages the result", async () => {
    const doctorId = new mongoose.Types.ObjectId().toString();
    await create(patient(doctorId, { fullName: "Cara", email: "c@example.com" }));
    await create(patient(doctorId, { fullName: "Amelia", email: "a@example.com" }));
    await create(patient(doctorId, { fullName: "Noah", email: "n@example.com" }));

    const page = await search({ page: 1, limit: 2, sort: "fullName" });

    expect(page.total).toBe(3);
    expect(page.items.map((item) => item.fullName)).toEqual(["Amelia", "Cara"]);
    expect(page.page).toBe(1);
    expect(page.limit).toBe(2);
  });
});
