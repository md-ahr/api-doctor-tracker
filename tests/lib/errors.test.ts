import { describe, expect, it } from "vitest";

import { DomainError, isDuplicateKeyError, statusForCode } from "../../src/lib/errors.js";
import type { DomainErrorCode } from "../../src/lib/errors.js";

const statusByCode: Record<DomainErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  DOCTOR_NOT_FOUND: 404,
  PATIENT_NOT_FOUND: 404,
  EMAIL_IN_USE: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

describe("statusForCode", () => {
  it("maps every domain code to its HTTP status", () => {
    for (const [code, status] of Object.entries(statusByCode)) {
      expect(statusForCode(code as DomainErrorCode)).toBe(status);
    }
  });
});

describe("isDuplicateKeyError", () => {
  it("accepts a Mongo duplicate key error", () => {
    expect(isDuplicateKeyError({ code: 11000 })).toBe(true);
  });

  it("rejects an arbitrary Error", () => {
    expect(isDuplicateKeyError(new Error("duplicate"))).toBe(false);
  });
});

describe("DomainError", () => {
  it("carries the details array", () => {
    const details = [{ path: "email", message: "Enter a valid email" }];
    const error = new DomainError("VALIDATION_ERROR", "Request validation failed", details);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DomainError");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Request validation failed");
    expect(error.details).toEqual(details);
  });

  it("defaults the message to the code and details to an empty array", () => {
    const error = new DomainError("INTERNAL");

    expect(error.message).toBe("INTERNAL");
    expect(error.details).toEqual([]);
  });
});
