import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Enter a valid id");

const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^\+?[0-9]+(?:[ -][0-9]+)*$/, "Enter a valid phone");

const sexSchema = z.enum(["female", "male", "other", "undisclosed"]);

export const patientConditionSchema = z.enum([
  "critical",
  "serious",
  "stable",
  "recovering",
  "chronic",
  "observation",
]);

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function isValidDateOfBirth(value: string): boolean {
  const dob = Temporal.PlainDate.from(value);
  const today = Temporal.Now.plainDateISO();
  if (Temporal.PlainDate.compare(dob, today) > 0) return false;
  const oldest = today.subtract({ years: 130 });
  return Temporal.PlainDate.compare(dob, oldest) >= 0;
}

const dateOfBirthSchema = z
  .string()
  .date()
  .refine(isValidDateOfBirth, "Enter a valid date of birth");

const emailSchema = z.string().trim().toLowerCase().email().max(254);

const notesSchema = z.preprocess(blankToUndefined, z.string().max(2000).optional());

export const createPatientBodySchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  dateOfBirth: dateOfBirthSchema.optional(),
  sex: sexSchema.optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  condition: patientConditionSchema,
  notes: notesSchema,
  registeredAt: z.string().date().optional(),
});

export const createAssignedPatientBodySchema = createPatientBodySchema.extend({
  doctorId: objectId,
});

export const updatePatientBodySchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    dateOfBirth: dateOfBirthSchema.nullable().optional(),
    sex: sexSchema.nullable().optional(),
    phone: phoneSchema.nullable().optional(),
    email: emailSchema.nullable().optional(),
    condition: patientConditionSchema.optional(),
    notes: z.preprocess(blankToUndefined, z.string().max(2000).nullable().optional()),
    registeredAt: z.string().date().optional(),
    doctorId: objectId.optional(),
  })
  .refine(
    (body) => Object.values(body).some((value) => value !== undefined),
    "At least one field is required",
  );

export const patientListQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  condition: patientConditionSchema.optional(),
  doctorId: objectId.optional(),
  registeredFrom: z.string().date().optional(),
  registeredTo: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(["registeredAt", "fullName"]).default("registeredAt"),
});

export const doctorPatientListQuerySchema = patientListQuerySchema.extend({
  doctorId: z.never().optional(),
});

export const patientIdParamsSchema = z.object({ patientId: objectId });

export type CreatePatientBody = z.infer<typeof createPatientBodySchema>;
export type CreateAssignedPatientBody = z.infer<typeof createAssignedPatientBodySchema>;
export type UpdatePatientBody = z.infer<typeof updatePatientBodySchema>;
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;
