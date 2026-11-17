import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { DomainError, statusForCode } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { sendFailure } from "../lib/response.js";

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // Express treats a four-argument function as error middleware.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (error instanceof DomainError) {
    sendFailure(res, statusForCode(error.code), error.message, error.code, error.details);
    return;
  }

  if (error instanceof ZodError) {
    sendFailure(
      res,
      400,
      "Request validation failed",
      "VALIDATION_ERROR",
      error.issues.map((issue) => ({
        path: issue.path.join(".") || "request",
        message: issue.message,
      })),
    );
    return;
  }

  logger.error({ err: error, requestId: req.requestId }, "Unhandled error");
  sendFailure(res, 500, "Something went wrong", "INTERNAL", []);
}
