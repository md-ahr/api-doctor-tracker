import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/db/mongoose.js", () => ({
  connectDatabase: vi.fn(),
}));

vi.mock("../src/models/user.model.js", () => ({
  findByEmail: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../src/lib/password.js", () => ({
  hashPassword: vi.fn(),
}));

import { env } from "../src/config/env.js";
import { hashPassword } from "../src/lib/password.js";
import { connectDatabase } from "../src/db/mongoose.js";
import { create, findByEmail } from "../src/models/user.model.js";
import { seedAdmin } from "../src/seed.js";

describe("seedAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hashPassword).mockResolvedValue("hashed-password");
    vi.mocked(create).mockResolvedValue({
      id: "665f1c0a2b3c4d5e6f708192",
      name: env.ADMIN_NAME ?? "Admin",
      email: env.ADMIN_EMAIL ?? "admin@example.com",
      role: "admin",
    });
  });

  it("does not insert a second admin when the email already exists", async () => {
    vi.mocked(findByEmail).mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "665f1c0a2b3c4d5e6f708192",
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      passwordHash: "hashed-password",
    });

    await seedAdmin();
    await seedAdmin();

    expect(connectDatabase).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      name: env.ADMIN_NAME,
      email: env.ADMIN_EMAIL,
      passwordHash: "hashed-password",
      role: "admin",
    });
  });
});
