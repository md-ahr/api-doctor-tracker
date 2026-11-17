import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { pageMeta, sendData, sendFailure, sendList } from "../../src/lib/response.js";

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

describe("pageMeta", () => {
  it("returns zero pages when the total is zero", () => {
    expect(pageMeta(1, 20, 0)).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it("rounds partial pages up", () => {
    expect(pageMeta(1, 20, 21).totalPages).toBe(2);
  });
});

describe("sendList", () => {
  it("places meta beside data in the success envelope", () => {
    const res = mockResponse();
    const data = [{ id: "doc" }];
    const meta = pageMeta(1, 20, 21);

    sendList(res, "Doctors loaded", data, meta);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Doctors loaded",
      data,
      meta,
    });
  });
});

describe("sendData", () => {
  it("writes a success envelope", () => {
    const res = mockResponse();
    const data = { id: "doc" };

    sendData(res, 201, "Doctor created", data);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Doctor created",
      data,
    });
  });
});

describe("sendFailure", () => {
  it("writes an error envelope", () => {
    const res = mockResponse();
    const details = [{ path: "email", message: "Enter a valid email" }];

    sendFailure(res, 400, "Request validation failed", "VALIDATION_ERROR", details);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Request validation failed",
      data: null,
      error: { code: "VALIDATION_ERROR", details },
    });
  });
});
