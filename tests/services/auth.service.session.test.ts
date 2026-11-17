import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/models/admin.model.js", () => ({
  findById: vi.fn(),
}));

vi.mock("../../src/models/session.model.js", () => ({
  create: vi.fn(),
  findLiveByHash: vi.fn(),
  revoke: vi.fn(),
}));

import { DomainError } from "../../src/lib/errors.js";
import { verifyAccessToken } from "../../src/lib/tokens.js";
import { findById } from "../../src/models/admin.model.js";
import { create as createSession, findLiveByHash, revoke } from "../../src/models/session.model.js";
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

  it("rejects an unknown or revoked refresh token", async () => {
    vi.mocked(findLiveByHash).mockResolvedValue(null);

    await expect(refreshSession("missing-token")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(revoke).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("revokes the old session and returns new tokens", async () => {
    vi.mocked(findLiveByHash).mockResolvedValue(liveSession);
    vi.mocked(findById).mockResolvedValue(admin);
    vi.mocked(revoke).mockResolvedValue(undefined);
    vi.mocked(createSession).mockResolvedValue(undefined);

    const result = await refreshSession("old-refresh-token");

    expect(findLiveByHash).toHaveBeenCalledWith(
      createHash("sha256").update("old-refresh-token").digest("hex"),
      expect.any(Date),
    );
    expect(vi.mocked(revoke).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(createSession).mock.invocationCallOrder[0] ?? 0,
    );
    expect(revoke).toHaveBeenCalledWith(liveSession.id, expect.any(Date));
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

  it("revokes the session and rejects refresh when the admin is gone", async () => {
    vi.mocked(findLiveByHash).mockResolvedValue(liveSession);
    vi.mocked(findById).mockResolvedValue(null);

    await expect(refreshSession("old-refresh-token")).rejects.toBeInstanceOf(DomainError);
    expect(revoke).toHaveBeenCalledWith(liveSession.id, expect.any(Date));
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
