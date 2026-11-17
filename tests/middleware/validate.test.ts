import type { NextFunction, Request, Response } from "express";
import { ZodError, z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { validate } from "../../src/middleware/validate.js";

const bodySchema = z.object({
  name: z.string(),
});

function mockRes() {
  return { locals: {} } as Response;
}

describe("validate", () => {
  it("stores a valid body on res.locals.body", () => {
    const req = { body: { name: "Ada" } } as Request;
    const res = mockRes();
    const next = vi.fn();

    validate({ body: bodySchema })(req, res, next as NextFunction);

    expect(res.locals.body).toEqual({ name: "Ada" });
    expect(next).toHaveBeenCalledOnce();
  });

  it("throws ZodError when the body is invalid", () => {
    const req = { body: { name: 1 } } as Request;
    const res = mockRes();
    const next = vi.fn();

    expect(() => validate({ body: bodySchema })(req, res, next as NextFunction)).toThrow(ZodError);
    expect(next).not.toHaveBeenCalled();
  });
});
