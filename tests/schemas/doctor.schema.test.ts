import { describe, expect, it } from "vitest";

import {
  createDoctorBodySchema,
  doctorIdParamsSchema,
  doctorListQuerySchema,
  updateDoctorBodySchema,
} from "../../src/schemas/doctor.schema.js";

const doctor = {
  name: "Amelia Rahman",
  specialization: "Cardiology",
  hospital: "City General",
  phone: "+1 202 555 0148",
  email: "Amelia@CityGeneral.example",
};

describe("doctor schemas", () => {
  it("accepts a create body and lowercases the email", () => {
    expect(createDoctorBodySchema.parse(doctor)).toEqual({
      ...doctor,
      email: "amelia@citygeneral.example",
    });
  });

  it("rejects an invalid doctor id", () => {
    expect(doctorIdParamsSchema.safeParse({ doctorId: "not-an-object-id" }).success).toBe(false);
    expect(doctorIdParamsSchema.safeParse({ doctorId: "665f1c0a2b3c4d5e6f708193" }).success).toBe(
      true,
    );
  });

  it("rejects a sort outside createdAt and name", () => {
    expect(doctorListQuerySchema.safeParse({ sort: "email" }).success).toBe(false);
    expect(doctorListQuerySchema.parse({}).sort).toBe("createdAt");
  });

  it("rejects a limit above 50", () => {
    expect(doctorListQuerySchema.safeParse({ limit: "51" }).success).toBe(false);
    expect(doctorListQuerySchema.parse({ limit: "50" }).limit).toBe(50);
  });

  it("requires at least one field on patch", () => {
    expect(updateDoctorBodySchema.safeParse({}).success).toBe(false);
    expect(updateDoctorBodySchema.parse({ hospital: " City General " })).toEqual({
      hospital: "City General",
    });
  });
});
