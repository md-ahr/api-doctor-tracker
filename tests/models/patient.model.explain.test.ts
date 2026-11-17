import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PatientModel } from "../../src/models/patient.model.js";

const conditions = [
  "critical",
  "serious",
  "stable",
  "recovering",
  "chronic",
  "observation",
] as const;

const sort = { registeredAt: -1, _id: -1 } as const;

function walk(plan: unknown, stages: string[], indexes: string[]): void {
  if (!plan || typeof plan !== "object") return;
  if (Array.isArray(plan)) {
    for (const item of plan) walk(item, stages, indexes);
    return;
  }

  const node = plan as Record<string, unknown>;
  if (typeof node.stage === "string") stages.push(node.stage);
  if (typeof node.indexName === "string") indexes.push(node.indexName);
  for (const key of ["inputStage", "inputStages", "queryPlan", "shards", "innerStage"]) {
    if (node[key]) walk(node[key], stages, indexes);
  }
}

async function planFor(filter: Record<string, unknown>) {
  const explained = (await PatientModel.find(filter).sort(sort).explain("queryPlanner")) as {
    queryPlanner?: { winningPlan?: unknown };
  };
  const stages: string[] = [];
  const indexes: string[] = [];
  walk(explained.queryPlanner?.winningPlan, stages, indexes);
  return { stages, indexes };
}

describe("patient index explain", () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { autoIndex: false });
    await PatientModel.createIndexes();

    const doctors = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()];
    const patients = Array.from({ length: 360 }, (_, index) => ({
      doctorId: doctors[index % doctors.length],
      fullName: `Patient ${index}`,
      condition: conditions[index % conditions.length],
      registeredAt: new Date(Date.UTC(2026, 0, 1 + (index % 90))),
      deletedAt: null,
    }));
    await PatientModel.insertMany(patients);
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("uses an index scan for a doctor's patients", async () => {
    const sample = await PatientModel.findOne().lean<{ doctorId: Types.ObjectId }>();
    const plan = await planFor({ deletedAt: null, doctorId: sample?.doctorId });

    expect(plan.stages).toContain("IXSCAN");
    expect(plan.stages).not.toContain("COLLSCAN");
    expect(plan.indexes.some((name) => name.startsWith("doctorId"))).toBe(true);
  });

  it("uses an index scan for a condition filter", async () => {
    const plan = await planFor({ deletedAt: null, condition: "stable" });

    expect(plan.stages).toContain("IXSCAN");
    expect(plan.stages).not.toContain("COLLSCAN");
    expect(plan.indexes.some((name) => name.startsWith("condition"))).toBe(true);
  });

  it("uses an index scan for a registration window", async () => {
    const plan = await planFor({
      deletedAt: null,
      registeredAt: {
        $gte: new Date(Date.UTC(2026, 0, 1)),
        $lte: new Date(Date.UTC(2026, 2, 1)),
      },
    });

    expect(plan.stages).toContain("IXSCAN");
    expect(plan.stages).not.toContain("COLLSCAN");
    expect(plan.indexes.some((name) => name.startsWith("registeredAt"))).toBe(true);
  });
});
