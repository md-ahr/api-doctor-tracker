import { describe, expect, it } from "vitest";

import { openApiDocument } from "../../src/docs/openapi.js";

const document = openApiDocument();

describe("openapi document", () => {
  it("includes health, auth, doctors, patients, and dashboard", () => {
    expect(Object.keys(document.paths ?? {})).toEqual(
      expect.arrayContaining([
        "/api/v1/health",
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
        "/api/v1/auth/me",
        "/api/v1/doctors",
        "/api/v1/doctors/facets",
        "/api/v1/doctors/{doctorId}",
        "/api/v1/doctors/{doctorId}/patients",
        "/api/v1/patients",
        "/api/v1/patients/{patientId}",
        "/api/v1/dashboard",
      ]),
    );
  });

  it("declares bearer auth on private routes only", () => {
    const paths = document.paths ?? {};
    const privateOperations = [
      paths["/api/v1/auth/me"]?.get,
      paths["/api/v1/doctors"]?.get,
      paths["/api/v1/doctors"]?.post,
      paths["/api/v1/doctors/facets"]?.get,
      paths["/api/v1/doctors/{doctorId}"]?.get,
      paths["/api/v1/doctors/{doctorId}"]?.patch,
      paths["/api/v1/doctors/{doctorId}/patients"]?.get,
      paths["/api/v1/doctors/{doctorId}/patients"]?.post,
      paths["/api/v1/patients"]?.get,
      paths["/api/v1/patients"]?.post,
      paths["/api/v1/patients/{patientId}"]?.get,
      paths["/api/v1/patients/{patientId}"]?.patch,
      paths["/api/v1/patients/{patientId}"]?.delete,
      paths["/api/v1/dashboard"]?.get,
    ];

    for (const operation of privateOperations) {
      expect(operation?.security).toEqual([{ bearerAuth: [] }]);
    }

    expect(paths["/api/v1/health"]?.get?.security).toBeUndefined();
    expect(paths["/api/v1/auth/login"]?.post?.security).toBeUndefined();
    expect(paths["/api/v1/auth/refresh"]?.post?.security).toBeUndefined();
    expect(paths["/api/v1/auth/logout"]?.post?.security).toBeUndefined();
    expect(document.components?.securitySchemes?.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
  });

  it("groups operations into health, auth, doctors, patients, and dashboard", () => {
    const paths = document.paths ?? {};

    expect(document.tags?.map((tag) => tag.name)).toEqual([
      "Health",
      "Auth",
      "Doctors",
      "Patients",
      "Dashboard",
    ]);
    expect(paths["/api/v1/health"]?.get?.tags).toEqual(["Health"]);
    expect(paths["/api/v1/auth/login"]?.post?.tags).toEqual(["Auth"]);
    expect(paths["/api/v1/auth/refresh"]?.post?.tags).toEqual(["Auth"]);
    expect(paths["/api/v1/auth/logout"]?.post?.tags).toEqual(["Auth"]);
    expect(paths["/api/v1/auth/me"]?.get?.tags).toEqual(["Auth"]);
    expect(paths["/api/v1/doctors"]?.get?.tags).toEqual(["Doctors"]);
    expect(paths["/api/v1/doctors"]?.post?.tags).toEqual(["Doctors"]);
    expect(paths["/api/v1/doctors/facets"]?.get?.tags).toEqual(["Doctors"]);
    expect(paths["/api/v1/doctors/{doctorId}"]?.get?.tags).toEqual(["Doctors"]);
    expect(paths["/api/v1/doctors/{doctorId}"]?.patch?.tags).toEqual(["Doctors"]);
    expect(paths["/api/v1/doctors/{doctorId}/patients"]?.get?.tags).toEqual(["Patients"]);
    expect(paths["/api/v1/doctors/{doctorId}/patients"]?.post?.tags).toEqual(["Patients"]);
    expect(paths["/api/v1/patients"]?.get?.tags).toEqual(["Patients"]);
    expect(paths["/api/v1/patients"]?.post?.tags).toEqual(["Patients"]);
    expect(paths["/api/v1/patients/{patientId}"]?.get?.tags).toEqual(["Patients"]);
    expect(paths["/api/v1/patients/{patientId}"]?.patch?.tags).toEqual(["Patients"]);
    expect(paths["/api/v1/patients/{patientId}"]?.delete?.tags).toEqual(["Patients"]);
    expect(paths["/api/v1/dashboard"]?.get?.tags).toEqual(["Dashboard"]);
  });

  it("reuses the shared envelopes and documents the refresh cookie", () => {
    const refresh = document.paths?.["/api/v1/auth/refresh"]?.post;
    const serialized = JSON.stringify(refresh);
    const schemas = document.components?.schemas ?? {};

    expect(schemas).toEqual(
      expect.objectContaining({
        Admin: expect.any(Object),
        AuthSession: expect.any(Object),
        Doctor: expect.any(Object),
        DoctorDetail: expect.any(Object),
        DoctorFacets: expect.any(Object),
        Patient: expect.any(Object),
        Dashboard: expect.any(Object),
        HealthStatus: expect.any(Object),
        PageMeta: expect.any(Object),
        ErrorEnvelope: expect.any(Object),
        LoginRequest: expect.any(Object),
        CreateDoctorRequest: expect.any(Object),
        CreatePatientRequest: expect.any(Object),
        UpdatePatientRequest: expect.any(Object),
      }),
    );
    expect(serialized).toContain("dt_refresh");
    expect(JSON.stringify(schemas.PageMeta)).toContain("totalPages");
    expect(JSON.stringify(schemas.DoctorDetail)).toContain("activePatientCount");
    expect(JSON.stringify(schemas.Patient)).toContain("doctorName");
    expect(JSON.stringify(schemas.ErrorEnvelope)).toContain("VALIDATION_ERROR");
    expect(JSON.stringify(document.paths?.["/api/v1/doctors"]?.get?.responses?.["200"])).toContain(
      "DoctorListResponse",
    );
    expect(
      JSON.stringify(document.paths?.["/api/v1/auth/login"]?.post?.responses?.["200"]),
    ).toContain("AuthSessionResponse");
    expect(
      JSON.stringify(document.paths?.["/api/v1/auth/login"]?.post?.responses?.["401"]),
    ).toContain("ErrorEnvelope");
  });
});
