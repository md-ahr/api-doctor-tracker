import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { DomainError } from "./errors.js";

const EXPIRES_IN_SECONDS = 900;

export function issueAccessToken(admin: {
  id: string;
  email: string;
  name: string;
  role: "admin";
}) {
  const token = jwt.sign(
    { email: admin.email, name: admin.name, role: admin.role },
    env.JWT_ACCESS_SECRET,
    { subject: admin.id, expiresIn: EXPIRES_IN_SECONDS, algorithm: "HS256" },
  );
  return { token, expiresIn: EXPIRES_IN_SECONDS };
}

export function verifyAccessToken(token: string) {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub) {
      throw new DomainError("UNAUTHENTICATED");
    }
    return payload;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("UNAUTHENTICATED");
  }
}
