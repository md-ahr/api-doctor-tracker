import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Enter a valid id");

const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^\+?[0-9]+(?:[ -][0-9]+)*$/, "Enter a valid phone");

export const createDoctorBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  specialization: z.string().trim().min(1).max(80),
  hospital: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email().max(254),
});

export const updateDoctorBodySchema = createDoctorBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, "At least one field is required");

export const doctorListQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  specialization: z.string().trim().min(1).max(80).optional(),
  hospital: z.string().trim().min(1).max(120).optional(),
  createdFrom: z.string().date().optional(),
  createdTo: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(["createdAt", "name"]).default("createdAt"),
});

export const doctorIdParamsSchema = z.object({ doctorId: objectId });

export type CreateDoctorBody = z.infer<typeof createDoctorBodySchema>;
export type UpdateDoctorBody = z.infer<typeof updateDoctorBodySchema>;
export type DoctorListQuery = z.infer<typeof doctorListQuerySchema>;
