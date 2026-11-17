import type { CookieOptions, Request, Response } from "express";

import { env } from "../config/env.js";
import { DomainError } from "../lib/errors.js";
import { sendData } from "../lib/response.js";
import * as authService from "../services/auth.service.js";

const REFRESH_COOKIE = "dt_refresh";

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function login(_req: Request, res: Response): Promise<void> {
  const body = res.locals.body as { email: string; password: string };
  const result = await authService.login(body);
  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
  sendData(res, 200, "Signed in successfully", {
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
    admin: result.admin,
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
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
}

export async function logout(req: Request, res: Response): Promise<void> {
  assertFrontendOrigin(req);
  const refreshToken = readCookie(req.header("cookie"), REFRESH_COOKIE);
  await authService.logout(refreshToken);
  clearRefreshCookie(res);
  sendData(res, 200, "Signed out successfully", null);
}

export async function me(req: Request, res: Response): Promise<void> {
  const admin = await authService.getMe(req.admin?.id ?? "");
  sendData(res, 200, "Admin profile retrieved successfully", admin);
}

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
