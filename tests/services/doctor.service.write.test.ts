import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/models/doctor.model.js", () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

import { DomainError } from "../../src/lib/errors.js";
import { create, findByEmail, findById, update } from "../../src/models/doctor.model.js";
import { createDoctor, updateDoctor } from "../../src/services/doctor.service.js";

const input = {
  name: "Amelia Rahman",
  specialization: "Cardiology",
  hospital: "City General",
  phone: "+1 202 555 0148",
  email: "Amelia@CityGeneral.example",
};

const doctor = {
  id: "665f1c0a2b3c4d5e6f708193",
  name: input.name,
  specialization: input.specialization,
  hospital: input.hospital,
  phone: input.phone,
  email: "amelia@citygeneral.example",
  createdAt: new Date("2026-11-01T10:00:00.000Z"),
  updatedAt: new Date("2026-11-01T10:00:00.000Z"),
};

describe("createDoctor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a duplicate email", async () => {
    vi.mocked(findByEmail).mockResolvedValue(doctor);

    await expect(createDoctor(input)).rejects.toEqual(expect.any(DomainError));
    await expect(createDoctor(input)).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
    expect(findByEmail).toHaveBeenCalledWith("amelia@citygeneral.example");
    expect(create).not.toHaveBeenCalled();
  });

  it("maps a duplicate key from the unique index to EMAIL_IN_USE", async () => {
    vi.mocked(findByEmail).mockResolvedValue(null);
    vi.mocked(create).mockRejectedValue({ code: 11000 });

    await expect(createDoctor(input)).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
    expect(create).toHaveBeenCalledWith({ ...input, email: "amelia@citygeneral.example" });
  });
});

describe("updateDoctor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unknown id", async () => {
    vi.mocked(findById).mockResolvedValue(null);

    await expect(updateDoctor(doctor.id, { name: "Updated" })).rejects.toMatchObject({
      code: "DOCTOR_NOT_FOUND",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an email that belongs to another doctor", async () => {
    vi.mocked(findById).mockResolvedValue(doctor);
    vi.mocked(findByEmail).mockResolvedValue({ ...doctor, id: "a".repeat(24) });

    await expect(
      updateDoctor(doctor.id, { email: "taken@citygeneral.example" }),
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
    expect(update).not.toHaveBeenCalled();
  });

  it("maps a duplicate key on save to EMAIL_IN_USE", async () => {
    vi.mocked(findById).mockResolvedValue(doctor);
    vi.mocked(findByEmail).mockResolvedValue(null);
    vi.mocked(update).mockRejectedValue({ code: 11000 });

    await expect(
      updateDoctor(doctor.id, { email: "taken@citygeneral.example" }),
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
  });
});
