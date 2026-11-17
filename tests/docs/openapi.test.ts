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

  it("reuses the shared envelopes and documents the refresh cookie", () => {
    const refresh = document.paths?.["/api/v1/auth/refresh"]?.post;
    const serialized = JSON.stringify(refresh);

    expect(document.components?.responses).toHaveProperty("ErrorEnvelope");
    expect(document.components?.schemas).toEqual(
      expect.objectContaining({
        SuccessEnvelope: expect.any(Object),
        ListEnvelope: expect.any(Object),
      }),
    );
    expect(serialized).toContain("dt_refresh");
    expect(JSON.stringify(document.components?.schemas?.ListEnvelope)).toContain("totalPages");
    expect(JSON.stringify(document.paths?.["/api/v1/doctors"]?.get?.responses?.["200"])).toContain(
      "ListEnvelope",
    );
  });
});
