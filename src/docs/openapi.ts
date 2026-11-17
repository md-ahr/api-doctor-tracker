import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { loginBodySchema } from "../schemas/auth.schema.js";
import { dashboardQuerySchema } from "../schemas/dashboard.schema.js";
import {
  createDoctorBodySchema,
  doctorIdParamsSchema,
  doctorListQuerySchema,
  updateDoctorBodySchema,
} from "../schemas/doctor.schema.js";
import {
  createAssignedPatientBodySchema,
  createPatientBodySchema,
  patientIdParamsSchema,
  patientListQuerySchema,
  updatePatientBodySchema,
} from "../schemas/patient.schema.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

const successEnvelope = registry.register(
  "SuccessEnvelope",
  z
    .object({
      success: z.literal(true),
      message: z.string(),
      data: z.unknown(),
    })
    .meta({ id: "SuccessEnvelope" }),
);

const listEnvelope = registry.register(
  "ListEnvelope",
  z
    .object({
      success: z.literal(true),
      message: z.string(),
      data: z.array(z.unknown()),
      meta: z.object({
        page: z.number().int(),
        limit: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
      }),
    })
    .meta({ id: "ListEnvelope" }),
);

const errorResponse = registry.registerComponent("responses", "ErrorEnvelope", {
  description: "Error envelope",
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["success", "message", "data", "error"],
        properties: {
          success: { type: "boolean", enum: [false] },
          message: { type: "string" },
          data: { type: "null" },
          error: {
            type: "object",
            required: ["code", "details"],
            properties: {
              code: { type: "string" },
              details: {
                type: "array",
                items: {
                  type: "object",
                  required: ["path", "message"],
                  properties: {
                    path: { type: "string" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

const bearer = [{ bearerAuth: [] }];
const doctorPatientQuerySchema = patientListQuerySchema.omit({ doctorId: true });
const refreshCookieSchema = z.object({
  dt_refresh: z.string().meta({ description: "Opaque refresh token" }),
});
const originHeaderSchema = z.object({
  origin: z.string().meta({ description: "Must equal FRONTEND_ORIGIN" }),
});

function json(description: string, schema: z.ZodType) {
  return {
    description,
    content: { "application/json": { schema } },
  };
}

function errors(...statuses: Array<400 | 401 | 403 | 404 | 409 | 429 | 500 | 503>) {
  return Object.fromEntries(statuses.map((status) => [status, errorResponse.ref]));
}

registry.registerPath({
  method: "get",
  path: "/api/v1/health",
  summary: "Health",
  responses: {
    200: json(
      "Service is healthy",
      z.object({
        success: z.literal(true),
        message: z.string(),
        data: z.object({
          status: z.string(),
          database: z.string(),
          datetime: z.string().datetime(),
        }),
      }),
    ),
    503: json(
      "Database unavailable",
      z.object({
        success: z.literal(false),
        message: z.string(),
        data: z.object({
          status: z.string(),
          database: z.string(),
          datetime: z.string().datetime(),
        }),
        error: z.object({ code: z.literal("INTERNAL"), details: z.array(z.unknown()) }),
      }),
    ),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/login",
  summary: "Sign in",
  request: { body: { content: { "application/json": { schema: loginBodySchema } } } },
  responses: {
    200: json("Signed in successfully", successEnvelope),
    ...errors(401, 429),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/refresh",
  summary: "Refresh session",
  request: { cookies: refreshCookieSchema, headers: originHeaderSchema },
  responses: {
    200: json("Session refreshed successfully", successEnvelope),
    ...errors(401, 403),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/logout",
  summary: "Sign out",
  request: { cookies: refreshCookieSchema, headers: originHeaderSchema },
  responses: {
    200: json("Signed out successfully", successEnvelope),
    ...errors(403),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/auth/me",
  summary: "Current admin",
  security: bearer,
  responses: {
    200: json("Admin profile retrieved successfully", successEnvelope),
    ...errors(401, 403),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/doctors",
  summary: "Create a doctor",
  security: bearer,
  request: { body: { content: { "application/json": { schema: createDoctorBodySchema } } } },
  responses: {
    201: json("Doctor created successfully", successEnvelope),
    ...errors(401, 403, 409),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/doctors",
  summary: "List doctors",
  security: bearer,
  request: { query: doctorListQuerySchema },
  responses: {
    200: json("Doctors retrieved successfully", listEnvelope),
    ...errors(401, 403),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/doctors/facets",
  summary: "Doctor filter values",
  security: bearer,
  responses: {
    200: json("Doctor facets retrieved successfully", successEnvelope),
    ...errors(401, 403),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/doctors/{doctorId}",
  summary: "Get a doctor",
  security: bearer,
  request: { params: doctorIdParamsSchema },
  responses: {
    200: json("Doctor retrieved successfully", successEnvelope),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/doctors/{doctorId}",
  summary: "Update a doctor",
  security: bearer,
  request: {
    params: doctorIdParamsSchema,
    body: { content: { "application/json": { schema: updateDoctorBodySchema } } },
  },
  responses: {
    200: json("Doctor updated successfully", successEnvelope),
    ...errors(401, 403, 404, 409),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/doctors/{doctorId}/patients",
  summary: "List a doctor's patients",
  security: bearer,
  request: { params: doctorIdParamsSchema, query: doctorPatientQuerySchema },
  responses: {
    200: json("Patients retrieved successfully", listEnvelope),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/doctors/{doctorId}/patients",
  summary: "Create a patient for a doctor",
  security: bearer,
  request: {
    params: doctorIdParamsSchema,
    body: { content: { "application/json": { schema: createPatientBodySchema } } },
  },
  responses: {
    201: json("Patient created successfully", successEnvelope),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/patients",
  summary: "List patients",
  security: bearer,
  request: { query: patientListQuerySchema },
  responses: {
    200: json("Patients retrieved successfully", listEnvelope),
    ...errors(401, 403),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/patients",
  summary: "Create a patient",
  security: bearer,
  request: {
    body: { content: { "application/json": { schema: createAssignedPatientBodySchema } } },
  },
  responses: {
    201: json("Patient created successfully", successEnvelope),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/patients/{patientId}",
  summary: "Get a patient",
  security: bearer,
  request: { params: patientIdParamsSchema },
  responses: {
    200: json("Patient retrieved successfully", successEnvelope),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/patients/{patientId}",
  summary: "Update a patient",
  security: bearer,
  request: {
    params: patientIdParamsSchema,
    body: { content: { "application/json": { schema: updatePatientBodySchema } } },
  },
  responses: {
    200: json("Patient updated successfully", successEnvelope),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/patients/{patientId}",
  summary: "Delete a patient",
  security: bearer,
  request: { params: patientIdParamsSchema },
  responses: {
    200: json("Patient deleted successfully", successEnvelope),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/dashboard",
  summary: "Dashboard",
  security: bearer,
  request: { query: dashboardQuerySchema },
  responses: {
    200: json("Dashboard retrieved successfully", successEnvelope),
    ...errors(400, 401, 403),
  },
});

export function openApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: "3.0.0",
    info: { title: "Doctor Tracker API", version: "1.0.0" },
  });
}
