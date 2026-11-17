import { describe, expect, it } from "vitest";

import { createLogger, logger } from "../../src/lib/logger.js";

describe("logger", () => {
  it("exports a logger", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
  });

  it("accepts a smoke log at silent level", () => {
    const silent = createLogger("silent");
    expect(() => silent.info("smoke")).not.toThrow();
  });
});
