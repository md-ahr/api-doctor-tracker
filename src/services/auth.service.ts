import { createHash, randomBytes } from "node:crypto";

import { DomainError } from "../lib/errors.js";
import { verifyPassword } from "../lib/password.js";
import { issueAccessToken } from "../lib/tokens.js";
import * as adminModel from "../models/user.model.js";
import * as sessionModel from "../models/session.model.js";

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$YQgwz11MSHrIdCBNVinK4g$y3e5vG45eTmXQ1iswy5HNJm/KCUcLrgD1BkMWBNAwik";

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function openSession(admin: {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}) {
  const refreshToken = randomBytes(32).toString("hex");
  await sessionModel.create({
    adminId: admin.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });

  const access = issueAccessToken(admin);
  return {
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken,
    admin: { id: admin.id, name: admin.name, email: admin.email },
  };
}

export async function login(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const admin = await adminModel.findByEmail(email);
  const passwordMatches = await verifyPassword(
    input.password,
    admin?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!admin || !passwordMatches) {
    throw new DomainError("INVALID_CREDENTIALS");
  }

  return openSession(admin);
}

export async function refreshSession(refreshToken: string) {
  const session = await sessionModel.consume(hashRefreshToken(refreshToken), new Date());
  if (!session) {
    throw new DomainError("UNAUTHENTICATED");
  }

  const admin = await adminModel.findById(session.adminId);
  if (!admin) {
    throw new DomainError("UNAUTHENTICATED");
  }

  return openSession(admin);
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  const session = await sessionModel.findLiveByHash(hashRefreshToken(refreshToken), new Date());
  if (!session) return;
  await sessionModel.revoke(session.id, new Date());
}

export async function getMe(adminId: string) {
  const admin = await adminModel.findById(adminId);
  if (!admin) {
    throw new DomainError("UNAUTHENTICATED");
  }
  return { id: admin.id, name: admin.name, email: admin.email };
}
