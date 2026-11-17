import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/models/doctor.model.js", () => ({
  findById: vi.fn(),
  findByIds: vi.fn(),
}));

vi.mock("../../src/models/patient.model.js", () => ({
  search: vi.fn(),
  findById: vi.fn(),
}));

import { findById as findDoctorById, findByIds } from "../../src/models/doctor.model.js";
import { findById, search } from "../../src/models/patient.model.js";
import { listDoctorPatients, listPatients } from "../../src/services/patient.service.js";

const doctorA = "665f1c0a2b3c4d5e6f708193";
const doctorB = "665f1c0a2b3c4d5e6f708195";
const registeredAt = new Date("2026-11-16T00:00:00.000Z");
const createdAt = new Date("2026-11-16T08:00:00.000Z");

const listQuery = {
  page: 1,
  limit: 20,
  sort: "registeredAt" as const,
};

function patient(id: string, doctorId: string) {
  return {
    id,
    doctorId,
    fullName: id === "665f1c0a2b3c4d5e6f708194" ? "Noah Khan" : "Ada Rahman",
    dateOfBirth: "1984-04-12",
    sex: "male" as const,
    phone: "+1 202 555 0199",
    email: "noah@example.com",
    condition: "stable" as const,
    notes: null,
    registeredAt,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };
}

describe("listPatients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a registration window whose start is after its end", async () => {
    await expect(
      listPatients({ ...listQuery, registeredFrom: "2026-11-03", registeredTo: "2026-11-01" }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Start date is after end date",
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("maps registeredAt to an ISO string and loads doctor names once", async () => {
    const first = patient("665f1c0a2b3c4d5e6f708194", doctorA);
    const second = patient("665f1c0a2b3c4d5e6f708196", doctorB);
    vi.mocked(search).mockResolvedValue({
      items: [first, second],
      page: 1,
      limit: 20,
      total: 2,
    });
    vi.mocked(findByIds).mockResolvedValue([
      { id: doctorA, name: "Amelia Rahman", specialization: "Cardiology" },
      { id: doctorB, name: "Noah Ali", specialization: "Pediatrics" },
    ]);

    const page = await listPatients(listQuery);

    expect(findByIds).toHaveBeenCalledTimes(1);
    expect(findByIds).toHaveBeenCalledWith([doctorA, doctorB]);
    expect(page.items.map((item) => item.registeredAt)).toEqual([
      registeredAt.toISOString(),
      registeredAt.toISOString(),
    ]);
    expect(page.items.map((item) => item.doctorName)).toEqual(["Amelia Rahman", "Noah Ali"]);
    expect(findById).not.toHaveBeenCalled();
  });
});

describe("listDoctorPatients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unknown doctor before searching", async () => {
    vi.mocked(findDoctorById).mockResolvedValue(null);

    await expect(listDoctorPatients(doctorA, listQuery)).rejects.toMatchObject({
      code: "DOCTOR_NOT_FOUND",
    });
    expect(search).not.toHaveBeenCalled();
  });
});
