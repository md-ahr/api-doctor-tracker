import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/models/doctor.model.js", () => ({
  findById: vi.fn(),
}));

vi.mock("../../src/models/patient.model.js", () => ({
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));

import { env } from "../../src/config/env.js";
import { dayBounds } from "../../src/lib/calendar.js";
import { findById as findDoctorById } from "../../src/models/doctor.model.js";
import { create, findById, softDelete } from "../../src/models/patient.model.js";
import { createPatient, deletePatient } from "../../src/services/patient.service.js";

const doctorId = "665f1c0a2b3c4d5e6f708193";
const patientId = "665f1c0a2b3c4d5e6f708194";
const now = new Date("2026-11-17T15:04:00.000Z");

const doctor = {
  id: doctorId,
  name: "Amelia Rahman",
  specialization: "Cardiology",
  hospital: "City General",
  phone: "+1 202 555 0148",
  email: "amelia@citygeneral.example",
  createdAt: now,
  updatedAt: now,
};

const input = {
  fullName: "Noah Khan",
  condition: "stable" as const,
};

function storedPatient(registeredAt: Date) {
  return {
    id: patientId,
    doctorId,
    fullName: input.fullName,
    dateOfBirth: null,
    sex: null,
    phone: null,
    email: null,
    condition: input.condition,
    notes: null,
    registeredAt,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

describe("createPatient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("rejects a missing doctor", async () => {
    vi.mocked(findDoctorById).mockResolvedValue(null);

    await expect(createPatient(doctorId, input)).rejects.toMatchObject({
      code: "DOCTOR_NOT_FOUND",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("uses the current time when registeredAt is omitted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.mocked(findDoctorById).mockResolvedValue(doctor);
    vi.mocked(create).mockResolvedValue(storedPatient(now));

    await createPatient(doctorId, input);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        doctorId,
        fullName: input.fullName,
        condition: "stable",
        registeredAt: now,
      }),
    );
  });

  it("stores the start of a provided registration date", async () => {
    const registeredAt = dayBounds("2026-11-16", env.APP_TIMEZONE).start;
    vi.mocked(findDoctorById).mockResolvedValue(doctor);
    vi.mocked(create).mockResolvedValue(storedPatient(registeredAt));

    await createPatient(doctorId, { ...input, registeredAt: "2026-11-16" });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ doctorId, registeredAt }));
  });
});

describe("deletePatient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a missing active patient", async () => {
    vi.mocked(softDelete).mockResolvedValue(false);

    await expect(deletePatient(patientId)).rejects.toMatchObject({ code: "PATIENT_NOT_FOUND" });
    expect(findById).not.toHaveBeenCalled();
  });
});
