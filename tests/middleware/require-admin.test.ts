import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";

import { env } from "../../src/config/env.js";
import { DomainError } from "../../src/lib/errors.js";
import { issueAccessToken } from "../../src/lib/tokens.js";
import { requireAdmin } from "../../src/middleware/require-admin.js";

const admin = {
  id: "admin-1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  role: "admin" as const,
};

function mockReq(authorization?: string): Request {
  return {
    header: vi.fn().mockReturnValue(authorization),
  } as unknown as Request;
}

describe("requireAdmin", () => {
  it("forwards UNAUTHENTICATED when Authorization is missing", () => {
    const req = mockReq(undefined);
    const next = vi.fn();

    requireAdmin(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("sets req.admin from a valid admin token", () => {
    const { token } = issueAccessToken(admin);
    const req = mockReq(`Bearer ${token}`);
    const next = vi.fn();

    requireAdmin(req, {} as Response, next as NextFunction);

    expect(req.admin).toEqual({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: "admin",
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("forwards FORBIDDEN when the token role is not admin", () => {
    const token = jwt.sign(
      { email: admin.email, name: admin.name, role: "doctor" },
      env.JWT_ACCESS_SECRET,
      { subject: admin.id, expiresIn: 900, algorithm: "HS256" },
    );
    const req = mockReq(`Bearer ${token}`);
    const next = vi.fn();

    requireAdmin(req, {} as Response, next as NextFunction);

    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: "FORBIDDEN" });
    expect(req.admin).toBeUndefined();
  });
});
