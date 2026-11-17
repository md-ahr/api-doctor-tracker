import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { asyncHandler } from "../../src/middleware/async-handler.js";

describe("asyncHandler", () => {
  it("does not forward an error when the handler resolves", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const next = vi.fn();

    asyncHandler(handler)({} as Request, {} as Response, next as NextFunction);
    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledOnce();
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("forwards a rejected promise to next", async () => {
    const error = new Error("handler failed");
    const handler = vi.fn().mockRejectedValue(error);
    const next = vi.fn();

    asyncHandler(handler)({} as Request, {} as Response, next as NextFunction);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
