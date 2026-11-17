import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { requestId } from "../../src/middleware/request-id.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mockReq(headerValue?: string): Request {
  return {
    header: vi.fn().mockReturnValue(headerValue),
  } as unknown as Request;
}

function mockRes(): Response & { setHeader: ReturnType<typeof vi.fn> } {
  return {
    setHeader: vi.fn(),
  } as unknown as Response & { setHeader: ReturnType<typeof vi.fn> };
}

describe("requestId", () => {
  it("preserves an incoming x-request-id header", () => {
    const req = mockReq("incoming-id");
    const res = mockRes();
    const next = vi.fn();

    requestId(req, res, next as NextFunction);

    expect(req.requestId).toBe("incoming-id");
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "incoming-id");
    expect(next).toHaveBeenCalledOnce();
  });

  it("generates a UUID when the header is missing", () => {
    const req = mockReq(undefined);
    const res = mockRes();
    const next = vi.fn();

    requestId(req, res, next as NextFunction);

    expect(req.requestId).toMatch(UUID);
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", req.requestId);
    expect(next).toHaveBeenCalledOnce();
  });
});
