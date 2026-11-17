import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { DomainError } from "../../src/lib/errors.js";
import { errorHandler } from "../../src/middleware/error-handler.js";

function mockResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

const req = { requestId: "req-1" } as Request;
const next = vi.fn() as unknown as NextFunction;

describe("errorHandler", () => {
  it("maps EMAIL_IN_USE to 409 with that code", () => {
    const res = mockResponse();

    errorHandler(new DomainError("EMAIL_IN_USE"), req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "EMAIL_IN_USE",
      data: null,
      error: { code: "EMAIL_IN_USE", details: [] },
    });
  });

  it("maps ZodError to 400 VALIDATION_ERROR with details paths", () => {
    const parsed = z.object({ email: z.string().email() }).safeParse({ email: "not-an-email" });
    if (parsed.success) {
      throw new Error("Expected validation to fail");
    }
    const res = mockResponse();

    errorHandler(parsed.error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Request validation failed",
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        details: [{ path: "email", message: expect.any(String) }],
      },
    });
  });

  it("maps an unknown Error to 500 INTERNAL with empty details", () => {
    const res = mockResponse();

    errorHandler(new Error("database down"), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Something went wrong",
      data: null,
      error: { code: "INTERNAL", details: [] },
    });
  });
});
