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
  patientConditionSchema,
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

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/);
const isoDateTime = z.string().datetime();

function registerSchema<T extends z.ZodType>(name: string, schema: T) {
  return registry.register(name, schema.meta({ id: name }));
}

const pageMetaSchema = registerSchema(
  "PageMeta",
  z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
);

const errorEnvelopeSchema = registerSchema(
  "ErrorEnvelope",
  z.object({
    success: z.literal(false),
    message: z.string(),
    data: z.null(),
    error: z.object({
      code: z.enum([
        "VALIDATION_ERROR",
        "INVALID_CREDENTIALS",
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "DOCTOR_NOT_FOUND",
        "PATIENT_NOT_FOUND",
        "EMAIL_IN_USE",
        "RATE_LIMITED",
        "INTERNAL",
      ]),
      details: z.array(z.object({ path: z.string(), message: z.string() })),
    }),
  }),
);

const adminSchema = registerSchema(
  "Admin",
  z.object({
    id: objectId,
    name: z.string(),
    email: z.string().email(),
  }),
);

const authSessionSchema = registerSchema(
  "AuthSession",
  z.object({
    accessToken: z.string(),
    expiresIn: z.number().int(),
    admin: adminSchema,
  }),
);

const doctorFields = {
  id: objectId,
  name: z.string(),
  specialization: z.string(),
  hospital: z.string(),
  phone: z.string(),
  email: z.string().email(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
};

const doctorSchema = registerSchema("Doctor", z.object(doctorFields));

const doctorDetailSchema = registerSchema(
  "DoctorDetail",
  z.object({ ...doctorFields, activePatientCount: z.number().int().nonnegative() }),
);

const doctorFacetsSchema = registerSchema(
  "DoctorFacets",
  z.object({
    specializations: z.array(z.string()),
    hospitals: z.array(z.string()),
  }),
);

const patientSchema = registerSchema(
  "Patient",
  z.object({
    id: objectId,
    doctorId: objectId,
    doctorName: z.string(),
    fullName: z.string(),
    dateOfBirth: z.string().date().nullable(),
    sex: z.enum(["female", "male", "other", "undisclosed"]).nullable(),
    phone: z.string().nullable(),
    email: z.string().email().nullable(),
    condition: patientConditionSchema,
    notes: z.string().nullable(),
    registeredAt: isoDateTime,
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  }),
);

const healthStatusSchema = registerSchema(
  "HealthStatus",
  z.object({
    status: z.enum(["ok", "degraded"]),
    database: z.enum(["up", "down"]),
    datetime: isoDateTime,
  }),
);

const dashboardSchema = registerSchema(
  "Dashboard",
  z.object({
    range: z.object({
      from: z.string().date(),
      to: z.string().date(),
      timezone: z.string(),
    }),
    totals: z.object({
      doctors: z.number().int().nonnegative(),
      patients: z.number().int().nonnegative(),
    }),
    patientsPerDoctor: z.array(
      z.object({
        doctorId: objectId,
        name: z.string(),
        specialization: z.string(),
        patientCount: z.number().int().nonnegative(),
      }),
    ),
    patientsByCondition: z.array(
      z.object({
        condition: patientConditionSchema,
        patientCount: z.number().int().nonnegative(),
      }),
    ),
    patientsRegisteredByDay: z.array(
      z.object({ date: z.string().date(), count: z.number().int().nonnegative() }),
    ),
    doctorsCreatedByDay: z.array(
      z.object({ date: z.string().date(), count: z.number().int().nonnegative() }),
    ),
  }),
);

const loginRequestSchema = registerSchema("LoginRequest", loginBodySchema);
const createDoctorRequestSchema = registerSchema("CreateDoctorRequest", createDoctorBodySchema);
const updateDoctorRequestSchema = registerSchema("UpdateDoctorRequest", updateDoctorBodySchema);
const createPatientRequestSchema = registerSchema("CreatePatientRequest", createPatientBodySchema);
const createAssignedPatientRequestSchema = registerSchema(
  "CreateAssignedPatientRequest",
  createAssignedPatientBodySchema,
);
const updatePatientRequestSchema = registerSchema("UpdatePatientRequest", updatePatientBodySchema);

function successResponse<T extends z.ZodType>(name: string, data: T) {
  return registerSchema(name, z.object({ success: z.literal(true), message: z.string(), data }));
}

function listResponse<T extends z.ZodType>(name: string, item: T) {
  return registerSchema(
    name,
    z.object({
      success: z.literal(true),
      message: z.string(),
      data: z.array(item),
      meta: pageMetaSchema,
    }),
  );
}

const authSessionResponse = successResponse("AuthSessionResponse", authSessionSchema);
const adminResponse = successResponse("AdminResponse", adminSchema);
const emptySuccessResponse = successResponse("EmptySuccessResponse", z.null());
const doctorResponse = successResponse("DoctorResponse", doctorSchema);
const doctorListResponse = listResponse("DoctorListResponse", doctorSchema);
const doctorDetailResponse = successResponse("DoctorDetailResponse", doctorDetailSchema);
const doctorFacetsResponse = successResponse("DoctorFacetsResponse", doctorFacetsSchema);
const patientResponse = successResponse("PatientResponse", patientSchema);
const patientListResponse = listResponse("PatientListResponse", patientSchema);
const dashboardResponse = successResponse("DashboardResponse", dashboardSchema);
const healthResponse = successResponse("HealthResponse", healthStatusSchema);
const healthFailureResponse = registerSchema(
  "HealthFailureResponse",
  z.object({
    success: z.literal(false),
    message: z.string(),
    data: healthStatusSchema,
    error: z.object({
      code: z.literal("INTERNAL"),
      details: z.array(z.object({ path: z.string(), message: z.string() })),
    }),
  }),
);

const bearer = [{ bearerAuth: [] }];

const apiTags = {
  health: "Health",
  auth: "Auth",
  doctors: "Doctors",
  patients: "Patients",
  dashboard: "Dashboard",
} as const;
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
  return Object.fromEntries(
    statuses.map((status) => [status, json("Request failed", errorEnvelopeSchema)]),
  );
}

registry.registerPath({
  method: "get",
  path: "/api/v1/health",
  tags: [apiTags.health],
  summary: "Health",
  responses: {
    200: json("Service is healthy", healthResponse),
    503: json("Database unavailable", healthFailureResponse),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/login",
  tags: [apiTags.auth],
  summary: "Sign in",
  request: { body: { content: { "application/json": { schema: loginRequestSchema } } } },
  responses: {
    200: json("Signed in successfully", authSessionResponse),
    ...errors(401, 429),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/refresh",
  tags: [apiTags.auth],
  summary: "Refresh session",
  request: { cookies: refreshCookieSchema, headers: originHeaderSchema },
  responses: {
    200: json("Session refreshed successfully", authSessionResponse),
    ...errors(401, 403),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/logout",
  tags: [apiTags.auth],
  summary: "Sign out",
  request: { cookies: refreshCookieSchema, headers: originHeaderSchema },
  responses: {
    200: json("Signed out successfully", emptySuccessResponse),
    ...errors(403),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/auth/me",
  tags: [apiTags.auth],
  summary: "Current admin",
  security: bearer,
  responses: {
    200: json("Admin profile retrieved successfully", adminResponse),
    ...errors(401, 403),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/doctors",
  tags: [apiTags.doctors],
  summary: "Create a doctor",
  security: bearer,
  request: { body: { content: { "application/json": { schema: createDoctorRequestSchema } } } },
  responses: {
    201: json("Doctor created successfully", doctorResponse),
    ...errors(401, 403, 409),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/doctors",
  tags: [apiTags.doctors],
  summary: "List doctors",
  security: bearer,
  request: { query: doctorListQuerySchema },
  responses: {
    200: json("Doctors retrieved successfully", doctorListResponse),
    ...errors(401, 403),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/doctors/facets",
  tags: [apiTags.doctors],
  summary: "Doctor filter values",
  security: bearer,
  responses: {
    200: json("Doctor facets retrieved successfully", doctorFacetsResponse),
    ...errors(401, 403),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/doctors/{doctorId}",
  tags: [apiTags.doctors],
  summary: "Get a doctor",
  security: bearer,
  request: { params: doctorIdParamsSchema },
  responses: {
    200: json("Doctor retrieved successfully", doctorDetailResponse),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/doctors/{doctorId}",
  tags: [apiTags.doctors],
  summary: "Update a doctor",
  security: bearer,
  request: {
    params: doctorIdParamsSchema,
    body: { content: { "application/json": { schema: updateDoctorRequestSchema } } },
  },
  responses: {
    200: json("Doctor updated successfully", doctorResponse),
    ...errors(401, 403, 404, 409),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/doctors/{doctorId}/patients",
  tags: [apiTags.patients],
  summary: "List a doctor's patients",
  security: bearer,
  request: { params: doctorIdParamsSchema, query: doctorPatientQuerySchema },
  responses: {
    200: json("Patients retrieved successfully", patientListResponse),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/doctors/{doctorId}/patients",
  tags: [apiTags.patients],
  summary: "Create a patient for a doctor",
  security: bearer,
  request: {
    params: doctorIdParamsSchema,
    body: { content: { "application/json": { schema: createPatientRequestSchema } } },
  },
  responses: {
    201: json("Patient created successfully", patientResponse),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/patients",
  tags: [apiTags.patients],
  summary: "List patients",
  security: bearer,
  request: { query: patientListQuerySchema },
  responses: {
    200: json("Patients retrieved successfully", patientListResponse),
    ...errors(401, 403),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/patients",
  tags: [apiTags.patients],
  summary: "Create a patient",
  security: bearer,
  request: {
    body: { content: { "application/json": { schema: createAssignedPatientRequestSchema } } },
  },
  responses: {
    201: json("Patient created successfully", patientResponse),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/patients/{patientId}",
  tags: [apiTags.patients],
  summary: "Get a patient",
  security: bearer,
  request: { params: patientIdParamsSchema },
  responses: {
    200: json("Patient retrieved successfully", patientResponse),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/patients/{patientId}",
  tags: [apiTags.patients],
  summary: "Update a patient",
  security: bearer,
  request: {
    params: patientIdParamsSchema,
    body: { content: { "application/json": { schema: updatePatientRequestSchema } } },
  },
  responses: {
    200: json("Patient updated successfully", patientResponse),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/patients/{patientId}",
  tags: [apiTags.patients],
  summary: "Delete a patient",
  security: bearer,
  request: { params: patientIdParamsSchema },
  responses: {
    200: json("Patient deleted successfully", emptySuccessResponse),
    ...errors(401, 403, 404),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/dashboard",
  tags: [apiTags.dashboard],
  summary: "Dashboard",
  security: bearer,
  request: { query: dashboardQuerySchema },
  responses: {
    200: json("Dashboard retrieved successfully", dashboardResponse),
    ...errors(400, 401, 403),
  },
});

export function openApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: "3.0.0",
    info: { title: "Doctor Tracker API", version: "1.0.0" },
    tags: [
      { name: apiTags.health, description: "Service and database status" },
      { name: apiTags.auth, description: "Admin sign-in, session, and profile" },
      { name: apiTags.doctors, description: "Doctor records and filter values" },
      { name: apiTags.patients, description: "Patient records, including a doctor's patient list" },
      { name: apiTags.dashboard, description: "Registration and condition summaries" },
    ],
  });
}
