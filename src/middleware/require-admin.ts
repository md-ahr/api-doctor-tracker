import type { NextFunction, Request, Response } from "express";

import { DomainError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    next(new DomainError("UNAUTHENTICATED"));
    return;
  }

  const payload = verifyAccessToken(token);
  if (payload.role !== "admin" || typeof payload.sub !== "string") {
    next(new DomainError("FORBIDDEN"));
    return;
  }

  req.admin = {
    id: payload.sub,
    email: String(payload.email),
    name: String(payload.name),
    role: "admin",
  };
  next();
}
