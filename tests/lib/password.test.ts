import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../../src/lib/password.js";

describe("password", () => {
  it("verifies the original password and rejects a different one", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash.startsWith("$argon2id$")).toBe(true);
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });
});
