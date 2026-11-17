import { describe, expect, it } from "vitest";

import { dashboardQuerySchema } from "../../src/schemas/dashboard.schema.js";

describe("dashboard query schema", () => {
  it("accepts optional from and to calendar dates", () => {
    expect(dashboardQuerySchema.parse({})).toEqual({});
    expect(dashboardQuerySchema.parse({ from: "2026-10-19", to: "2026-11-17" })).toEqual({
      from: "2026-10-19",
      to: "2026-11-17",
    });
  });

  it("rejects a date that is not YYYY-MM-DD", () => {
    expect(dashboardQuerySchema.safeParse({ from: "17-11-2026" }).success).toBe(false);
    expect(dashboardQuerySchema.safeParse({ to: "2026/11/17" }).success).toBe(false);
    expect(dashboardQuerySchema.safeParse({ from: "2026-11-17T00:00:00.000Z" }).success).toBe(
      false,
    );
  });

  it("strips unknown query keys", () => {
    expect(dashboardQuerySchema.parse({ from: "2026-11-01", extra: "nope" })).toEqual({
      from: "2026-11-01",
    });
  });
});
