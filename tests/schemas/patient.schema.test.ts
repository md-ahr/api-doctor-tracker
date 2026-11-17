import { describe, expect, it } from "vitest";

import {
  createPatientBodySchema,
  patientIdParamsSchema,
  patientListQuerySchema,
  updatePatientBodySchema,
} from "../../src/schemas/patient.schema.js";

const patient = {
  fullName: "Noah Khan",
  dateOfBirth: "1984-04-12",
  sex: "male",
  phone: "+1 202 555 0199",
  email: "Noah@Example.com",
  condition: "stable",
  notes: "Registered from the cardiology clinic.",
  registeredAt: "2026-11-16",
};

describe("patient schemas", () => {
  it("accepts a create body and lowercases the email", () => {
    expect(createPatientBodySchema.parse(patient)).toEqual({
      ...patient,
      email: "noah@example.com",
    });
  });

  it("omits blank notes", () => {
    const parsed = createPatientBodySchema.parse({
      fullName: "Noah Khan",
      condition: "stable",
      notes: "   ",
    });

    expect(parsed.notes).toBeUndefined();
  });

  it("rejects a date of birth in the future or more than 130 years ago", () => {
    const today = Temporal.Now.plainDateISO();

    expect(
      createPatientBodySchema.safeParse({
        ...patient,
        dateOfBirth: today.add({ days: 1 }).toString(),
      }).success,
    ).toBe(false);
    expect(
      createPatientBodySchema.safeParse({
        ...patient,
        dateOfBirth: today.subtract({ years: 130, days: 1 }).toString(),
      }).success,
    ).toBe(false);
    expect(
      createPatientBodySchema.safeParse({
        ...patient,
        dateOfBirth: today.subtract({ years: 130 }).toString(),
      }).success,
    ).toBe(true);
  });

  it("rejects a phone outside the shared pattern", () => {
    expect(createPatientBodySchema.safeParse({ ...patient, phone: "12345" }).success).toBe(false);
    expect(createPatientBodySchema.safeParse({ ...patient, phone: "call-me-now" }).success).toBe(
      false,
    );
    expect(
      createPatientBodySchema.safeParse({ ...patient, phone: "+1 202 555 0199" }).success,
    ).toBe(true);
  });

  it("rejects a condition outside the catalog", () => {
    expect(createPatientBodySchema.safeParse({ ...patient, condition: "unknown" }).success).toBe(
      false,
    );
    expect(patientListQuerySchema.safeParse({ condition: "serious" }).success).toBe(true);
  });

  it("rejects an invalid patient id", () => {
    expect(patientIdParamsSchema.safeParse({ patientId: "not-an-object-id" }).success).toBe(false);
    expect(patientIdParamsSchema.safeParse({ patientId: "665f1c0a2b3c4d5e6f708194" }).success).toBe(
      true,
    );
  });

  it("defaults list paging and rejects an unknown sort", () => {
    expect(patientListQuerySchema.parse({}).sort).toBe("registeredAt");
    expect(patientListQuerySchema.parse({}).limit).toBe(20);
    expect(patientListQuerySchema.safeParse({ sort: "email" }).success).toBe(false);
    expect(patientListQuerySchema.safeParse({ limit: "51" }).success).toBe(false);
  });

  it("requires at least one field on patch and allows null to clear optionals", () => {
    expect(updatePatientBodySchema.safeParse({}).success).toBe(false);
    expect(updatePatientBodySchema.parse({ dateOfBirth: null, notes: null })).toEqual({
      dateOfBirth: null,
      notes: null,
    });
  });
});
