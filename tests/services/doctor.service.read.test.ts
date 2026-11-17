import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/models/doctor.model.js", () => ({
  findById: vi.fn(),
  search: vi.fn(),
  facets: vi.fn(),
}));

vi.mock("../../src/models/patient.model.js", () => ({
  countActive: vi.fn(),
}));

import { env } from "../../src/config/env.js";
import { dayBounds } from "../../src/lib/calendar.js";
import { findById, facets, search } from "../../src/models/doctor.model.js";
import { countActive } from "../../src/models/patient.model.js";
import { getDoctor, getDoctorFacets, listDoctors } from "../../src/services/doctor.service.js";

const doctor = {
  id: "665f1c0a2b3c4d5e6f708193",
  name: "Amelia Rahman",
  specialization: "Cardiology",
  hospital: "City General",
  phone: "+1 202 555 0148",
  email: "amelia@citygeneral.example",
  createdAt: new Date("2026-11-01T10:00:00.000Z"),
  updatedAt: new Date("2026-11-01T10:00:00.000Z"),
};

const listQuery = {
  page: 1,
  limit: 20,
  sort: "createdAt" as const,
};

describe("listDoctors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a window whose start is after its end", async () => {
    await expect(
      listDoctors({ ...listQuery, createdFrom: "2026-11-03", createdTo: "2026-11-01" }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Start date is after end date",
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("applies day bounds before calling search", async () => {
    vi.mocked(search).mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });

    await listDoctors({ ...listQuery, createdFrom: "2026-11-01", createdTo: "2026-11-02" });

    expect(search).toHaveBeenCalledWith({
      ...listQuery,
      createdFrom: dayBounds("2026-11-01", env.APP_TIMEZONE).start,
      createdTo: dayBounds("2026-11-02", env.APP_TIMEZONE).end,
    });
  });
});

describe("getDoctor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds activePatientCount from the patient model", async () => {
    vi.mocked(findById).mockResolvedValue(doctor);
    vi.mocked(countActive).mockResolvedValue(3);

    await expect(getDoctor(doctor.id)).resolves.toEqual({ ...doctor, activePatientCount: 3 });
    expect(countActive).toHaveBeenCalledWith(doctor.id);
  });
});

describe("getDoctorFacets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the model's specialization and hospital lists", async () => {
    const facetsResult = {
      specializations: ["Cardiology", "Pediatrics"],
      hospitals: ["City General"],
    };
    vi.mocked(facets).mockResolvedValue(facetsResult);

    await expect(getDoctorFacets()).resolves.toEqual(facetsResult);
  });
});
