import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/models/doctor.model.js", () => ({
  count: vi.fn(),
  countCreatedByDay: vi.fn(),
  listSummaries: vi.fn(),
}));

vi.mock("../../src/models/patient.model.js", () => ({
  countActive: vi.fn(),
  countByDoctor: vi.fn(),
  countByCondition: vi.fn(),
  countRegisteredByDay: vi.fn(),
}));

import { env } from "../../src/config/env.js";
import { dayBounds, eachPlainDateInRange } from "../../src/lib/calendar.js";
import { count, countCreatedByDay, listSummaries } from "../../src/models/doctor.model.js";
import {
  countActive,
  countByCondition,
  countByDoctor,
  countRegisteredByDay,
} from "../../src/models/patient.model.js";
import { getDashboard } from "../../src/services/dashboard.service.js";

const amelia = {
  id: "665f1c0a2b3c4d5e6f708193",
  name: "Amelia Rahman",
  specialization: "Cardiology",
};
const priya = {
  id: "665f1c0a2b3c4d5e6f708195",
  name: "Priya Shah",
  specialization: "Pediatrics",
};

describe("getDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(count).mockResolvedValue(2);
    vi.mocked(countActive).mockResolvedValue(1);
    vi.mocked(countByDoctor).mockResolvedValue([{ doctorId: amelia.id, patientCount: 1 }]);
    vi.mocked(countByCondition).mockResolvedValue([{ condition: "stable", patientCount: 1 }]);
    vi.mocked(countRegisteredByDay).mockResolvedValue([{ date: "2026-11-16", count: 4 }]);
    vi.mocked(countCreatedByDay).mockResolvedValue([]);
    vi.mocked(listSummaries).mockResolvedValue([priya, amelia]);
  });

  it("rejects a reversed window and a window longer than 366 days", async () => {
    await expect(getDashboard({ from: "2026-11-17", to: "2026-11-01" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(getDashboard({ from: "2025-01-01", to: "2026-01-02" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(countRegisteredByDay).not.toHaveBeenCalled();
  });

  it("accepts a 366-day inclusive window", async () => {
    await getDashboard({ from: "2025-01-01", to: "2026-01-01" });
    expect(countRegisteredByDay).toHaveBeenCalledOnce();
  });

  it("defaults to the last 30 days through today and passes day bounds", async () => {
    vi.spyOn(Temporal.Now, "plainDateISO").mockReturnValue(Temporal.PlainDate.from("2026-11-17"));

    const dashboard = await getDashboard();
    const from = "2026-10-19";
    const to = "2026-11-17";

    expect(dashboard.range).toEqual({ from, to, timezone: env.APP_TIMEZONE });
    expect(countRegisteredByDay).toHaveBeenCalledWith(
      { from: dayBounds(from, env.APP_TIMEZONE).start, to: dayBounds(to, env.APP_TIMEZONE).end },
      env.APP_TIMEZONE,
    );
    expect(countCreatedByDay).toHaveBeenCalledWith(
      { from: dayBounds(from, env.APP_TIMEZONE).start, to: dayBounds(to, env.APP_TIMEZONE).end },
      env.APP_TIMEZONE,
    );
  });

  it("zero-fills every condition and every day in the range", async () => {
    const dashboard = await getDashboard({ from: "2026-11-16", to: "2026-11-17" });

    expect(dashboard.patientsByCondition).toEqual([
      { condition: "critical", patientCount: 0 },
      { condition: "serious", patientCount: 0 },
      { condition: "stable", patientCount: 1 },
      { condition: "recovering", patientCount: 0 },
      { condition: "chronic", patientCount: 0 },
      { condition: "observation", patientCount: 0 },
    ]);
    expect(dashboard.patientsRegisteredByDay).toEqual(
      eachPlainDateInRange("2026-11-16", "2026-11-17").map((date) => ({
        date,
        count: date === "2026-11-16" ? 4 : 0,
      })),
    );
    expect(dashboard.doctorsCreatedByDay).toEqual([
      { date: "2026-11-16", count: 0 },
      { date: "2026-11-17", count: 0 },
    ]);
  });

  it("includes doctors with zero patients and sorts by count then name", async () => {
    const dashboard = await getDashboard({ from: "2026-11-16", to: "2026-11-17" });

    expect(dashboard.totals).toEqual({ doctors: 2, patients: 1 });
    expect(dashboard.patientsPerDoctor).toEqual([
      {
        doctorId: amelia.id,
        name: amelia.name,
        specialization: amelia.specialization,
        patientCount: 1,
      },
      {
        doctorId: priya.id,
        name: priya.name,
        specialization: priya.specialization,
        patientCount: 0,
      },
    ]);
  });
});
