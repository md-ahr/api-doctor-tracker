import type { CookieOptions, Request, Response } from "express";
import { Router } from "express";
import rateLimit from "express-rate-limit";

import { env } from "../config/env.js";
import { DomainError } from "../lib/errors.js";
import { sendData } from "../lib/response.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { validate } from "../middleware/validate.js";
import { loginBodySchema } from "../schemas/auth.schema.js";
import * as authService from "../services/auth.service.js";

const REFRESH_COOKIE = "dt_refresh";

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new DomainError("RATE_LIMITED"));
  },
});

export const authRouter = Router();

authRouter.post(
  "/login",
  loginRateLimit,
  validate({ body: loginBodySchema }),
  asyncHandler(async (_req, res) => {
    const body = res.locals.body as { email: string; password: string };
    const result = await authService.login(body);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
    sendData(res, 200, "Signed in successfully", {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      admin: result.admin,
    });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    assertFrontendOrigin(req);
    const refreshToken = readCookie(req.header("cookie"), REFRESH_COOKIE);
    try {
      if (!refreshToken) {
        throw new DomainError("UNAUTHENTICATED");
      }
      const result = await authService.refreshSession(refreshToken);
      res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
      sendData(res, 200, "Session refreshed successfully", {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        admin: result.admin,
      });
    } catch (error) {
      clearRefreshCookie(res);
      throw error;
    }
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    assertFrontendOrigin(req);
    const refreshToken = readCookie(req.header("cookie"), REFRESH_COOKIE);
    await authService.logout(refreshToken);
    clearRefreshCookie(res);
    sendData(res, 200, "Signed out successfully", null);
  }),
);

authRouter.get(
  "/me",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const admin = await authService.getMe(req.admin?.id ?? "");
    sendData(res, 200, "Admin profile retrieved successfully", admin);
  }),
);

function assertFrontendOrigin(req: Request): void {
  if (req.header("origin") !== env.FRONTEND_ORIGIN) {
    throw new DomainError("FORBIDDEN");
  }
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}
