import { describe, expect, it } from "vitest";

import { escapeRegex } from "../../src/lib/escape-regex.js";

describe("escapeRegex", () => {
  it("matches regex metacharacters as literal text", () => {
    const input = "a+b (test).*";
    const expression = new RegExp(`^${escapeRegex(input)}$`);

    expect(expression.test(input)).toBe(true);
    expect(expression.test("aaab (test)XYZ")).toBe(false);
  });
});
