import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/models/user.model.js", () => ({
  findByEmail: vi.fn(),
}));

vi.mock("../../src/models/session.model.js", () => ({
  create: vi.fn(),
}));

vi.mock("../../src/lib/password.js", () => ({
  verifyPassword: vi.fn(),
}));

import { DomainError } from "../../src/lib/errors.js";
import { verifyPassword } from "../../src/lib/password.js";
import { verifyAccessToken } from "../../src/lib/tokens.js";
import { findByEmail } from "../../src/models/user.model.js";
import { create as createSession } from "../../src/models/session.model.js";
import { login } from "../../src/services/auth.service.js";

const admin = {
  id: "665f1c0a2b3c4d5e6f708192",
  name: "Avery Admin",
  email: "admin@example.com",
  role: "admin" as const,
  passwordHash: "$argon2id$stored-admin-hash",
};

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies a dummy hash and rejects an unknown email", async () => {
    vi.mocked(findByEmail).mockResolvedValue(null);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await expect(
      login({ email: "missing@example.com", password: "correct horse" }),
    ).rejects.toEqual(expect.any(DomainError));
    await expect(
      login({ email: "missing@example.com", password: "correct horse" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    expect(verifyPassword).toHaveBeenCalledWith(
      "correct horse",
      expect.stringMatching(/^\$argon2id\$/),
    );
    expect(vi.mocked(verifyPassword).mock.calls[0]?.[1]).not.toBe(admin.passwordHash);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects a wrong password", async () => {
    vi.mocked(findByEmail).mockResolvedValue(admin);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await expect(
      login({ email: "Admin@Example.com", password: "wrong-password" }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });

    expect(findByEmail).toHaveBeenCalledWith("admin@example.com");
    expect(verifyPassword).toHaveBeenCalledWith("wrong-password", admin.passwordHash);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("returns an access token, expiry, admin profile, and opaque refresh token", async () => {
    vi.mocked(findByEmail).mockResolvedValue(admin);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(createSession).mockResolvedValue(undefined);

    const result = await login({ email: "admin@example.com", password: "correct horse" });

    expect(result.expiresIn).toBe(900);
    expect(result.admin).toEqual({
      id: admin.id,
      name: admin.name,
      email: admin.email,
    });
    expect(result.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyAccessToken(result.accessToken)).toMatchObject({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: "admin",
    });

    const tokenHash = createHash("sha256").update(result.refreshToken).digest("hex");
    expect(createSession).toHaveBeenCalledWith({
      adminId: admin.id,
      tokenHash,
      expiresAt: expect.any(Date),
    });
    const expiresAt = vi.mocked(createSession).mock.calls[0]?.[0].expiresAt;
    expect(expiresAt).toBeInstanceOf(Date);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt!.getTime()).toBeGreaterThan(Date.now() + sevenDays - 5_000);
    expect(expiresAt!.getTime()).toBeLessThan(Date.now() + sevenDays + 5_000);
  });
});
