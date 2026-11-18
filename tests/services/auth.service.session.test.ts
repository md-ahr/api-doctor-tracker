import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/models/user.model.js", () => ({
  findById: vi.fn(),
}));

vi.mock("../../src/models/session.model.js", () => ({
  create: vi.fn(),
  consume: vi.fn(),
  findLiveByHash: vi.fn(),
  revoke: vi.fn(),
}));

import { DomainError } from "../../src/lib/errors.js";
import { verifyAccessToken } from "../../src/lib/tokens.js";
import { findById } from "../../src/models/user.model.js";
import {
  consume,
  create as createSession,
  findLiveByHash,
  revoke,
} from "../../src/models/session.model.js";
import { getMe, logout, refreshSession } from "../../src/services/auth.service.js";

const admin = {
  id: "665f1c0a2b3c4d5e6f708192",
  name: "Avery Admin",
  email: "admin@example.com",
  role: "admin" as const,
  passwordHash: "hash",
};

const liveSession = { id: "session-1", adminId: admin.id };

describe("auth session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unknown, expired, or already rotated refresh token", async () => {
    vi.mocked(consume).mockResolvedValue(null);

    await expect(refreshSession("missing-token")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("consumes the old session atomically and returns new tokens", async () => {
    vi.mocked(consume).mockResolvedValue(liveSession);
    vi.mocked(findById).mockResolvedValue(admin);
    vi.mocked(createSession).mockResolvedValue(undefined);

    const result = await refreshSession("old-refresh-token");

    expect(consume).toHaveBeenCalledWith(
      createHash("sha256").update("old-refresh-token").digest("hex"),
      expect.any(Date),
    );
    expect(vi.mocked(consume).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(createSession).mock.invocationCallOrder[0] ?? 0,
    );
    expect(result.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(result.refreshToken).not.toBe("old-refresh-token");
    expect(result.expiresIn).toBe(900);
    expect(result.admin).toEqual({ id: admin.id, name: admin.name, email: admin.email });
    expect(verifyAccessToken(result.accessToken).sub).toBe(admin.id);

    const tokenHash = createHash("sha256").update(result.refreshToken).digest("hex");
    expect(createSession).toHaveBeenCalledWith({
      adminId: admin.id,
      tokenHash,
      expiresAt: expect.any(Date),
    });
  });

  it("rejects refresh when the admin is gone", async () => {
    vi.mocked(consume).mockResolvedValue(liveSession);
    vi.mocked(findById).mockResolvedValue(null);

    await expect(refreshSession("old-refresh-token")).rejects.toBeInstanceOf(DomainError);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("succeeds when logout is called with an unknown cookie", async () => {
    vi.mocked(findLiveByHash).mockResolvedValue(null);

    await expect(logout("unknown-cookie")).resolves.toBeUndefined();
    expect(revoke).not.toHaveBeenCalled();
  });

  it("returns the admin profile fields", async () => {
    vi.mocked(findById).mockResolvedValue(admin);

    await expect(getMe(admin.id)).resolves.toEqual({
      id: admin.id,
      name: admin.name,
      email: admin.email,
    });
  });
});
