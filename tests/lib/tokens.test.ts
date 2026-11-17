import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import { env } from "../../src/config/env.js";
import { DomainError } from "../../src/lib/errors.js";
import { issueAccessToken, verifyAccessToken } from "../../src/lib/tokens.js";

const admin = {
  id: "admin-1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  role: "admin" as const,
};

describe("access tokens", () => {
  it("issues a token whose payload names the admin", () => {
    const issued = issueAccessToken(admin);
    const payload = verifyAccessToken(issued.token);

    expect(issued.expiresIn).toBe(900);
    expect(payload.sub).toBe(admin.id);
    expect(payload.email).toBe(admin.email);
    expect(payload.name).toBe(admin.name);
    expect(payload.role).toBe("admin");
  });

  it("rejects a tampered token", () => {
    const { token } = issueAccessToken(admin);
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) {
      throw new Error("Token was not a JWT");
    }
    const last = signature.at(-1) === "a" ? "b" : "a";
    const tampered = `${header}.${body}.${signature.slice(0, -1)}${last}`;

    expect(() => verifyAccessToken(tampered)).toThrow(DomainError);
    expect(() => verifyAccessToken(tampered)).toThrow(
      expect.objectContaining({ code: "UNAUTHENTICATED" }),
    );
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign(
      {
        email: admin.email,
        name: admin.name,
        role: admin.role,
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      env.JWT_ACCESS_SECRET,
      { subject: admin.id, algorithm: "HS256" },
    );

    expect(() => verifyAccessToken(expired)).toThrow(
      expect.objectContaining({ code: "UNAUTHENTICATED" }),
    );
  });
});
