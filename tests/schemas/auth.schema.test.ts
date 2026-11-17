import { describe, expect, it } from "vitest";

import { loginBodySchema } from "../../src/schemas/auth.schema.js";

describe("loginBodySchema", () => {
  it("accepts a valid login body and lowercases the email", () => {
    const parsed = loginBodySchema.parse({
      email: " Admin@Example.com ",
      password: "correct horse",
    });

    expect(parsed).toEqual({
      email: "admin@example.com",
      password: "correct horse",
    });
  });

  it("rejects an invalid email", () => {
    const result = loginBodySchema.safeParse({
      email: "not-an-email",
      password: "correct horse",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = loginBodySchema.safeParse({
      email: "admin@example.com",
      password: "short",
    });

    expect(result.success).toBe(false);
  });
});
