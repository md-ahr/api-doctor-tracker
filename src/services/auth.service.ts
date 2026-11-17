import { createHash, randomBytes } from "node:crypto";

import { DomainError } from "../lib/errors.js";
import { verifyPassword } from "../lib/password.js";
import { issueAccessToken } from "../lib/tokens.js";
import * as adminModel from "../models/admin.model.js";
import * as sessionModel from "../models/session.model.js";

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$YQgwz11MSHrIdCBNVinK4g$y3e5vG45eTmXQ1iswy5HNJm/KCUcLrgD1BkMWBNAwik";

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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

  const refreshToken = randomBytes(32).toString("hex");
  await sessionModel.create({
    adminId: admin.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });

  const access = issueAccessToken({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
  });

  return {
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken,
    admin: { id: admin.id, name: admin.name, email: admin.email },
  };
}
