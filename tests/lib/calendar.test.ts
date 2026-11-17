import { describe, expect, it } from "vitest";

import { dayBounds, eachPlainDateInRange, parsePlainDate } from "../../src/lib/calendar.js";
import { DomainError } from "../../src/lib/errors.js";

describe("parsePlainDate", () => {
  it("rejects a date that is not YYYY-MM-DD", () => {
    expect(() => parsePlainDate("2026-13-40")).toThrow(DomainError);
    try {
      parsePlainDate("2026-13-40");
    } catch (error) {
      expect(error).toMatchObject({ code: "VALIDATION_ERROR" });
    }
  });
});

describe("dayBounds", () => {
  it("covers the local calendar day in the given timezone", () => {
    const bounds = dayBounds("2026-11-17", "UTC");

    expect(bounds.start.toISOString()).toBe("2026-11-17T00:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-11-17T23:59:59.999Z");
    expect(bounds.start.getTime()).toBeLessThanOrEqual(Date.parse("2026-11-17T12:00:00.000Z"));
    expect(bounds.end.getTime()).toBeGreaterThanOrEqual(Date.parse("2026-11-17T12:00:00.000Z"));
  });
});

describe("eachPlainDateInRange", () => {
  it("returns each date from the start through the end", () => {
    expect(eachPlainDateInRange("2026-11-15", "2026-11-17")).toEqual([
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
    ]);
  });

  it("returns no dates when from is after to", () => {
    expect(eachPlainDateInRange("2026-11-17", "2026-11-15")).toEqual([]);
  });
});
