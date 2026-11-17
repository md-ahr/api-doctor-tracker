import { beforeAll, describe, expect, it, vi } from "vitest";

import type { Env } from "../../src/config/env.js";

const validEnv = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/doctor-tracker",
  JWT_ACCESS_SECRET: "a".repeat(32),
  FRONTEND_ORIGIN: "http://localhost:3000",
};

let parseEnv: (source: NodeJS.ProcessEnv) => Env;

beforeAll(async () => {
  vi.stubEnv("MONGODB_URI", validEnv.MONGODB_URI);
  vi.stubEnv("JWT_ACCESS_SECRET", validEnv.JWT_ACCESS_SECRET);
  vi.stubEnv("FRONTEND_ORIGIN", validEnv.FRONTEND_ORIGIN);
  const loaded = await import("../../src/config/env.js");
  parseEnv = loaded.parseEnv;
});

describe("parseEnv", () => {
  it("parses a minimal env and defaults PORT to 4000", () => {
    const env = parseEnv(validEnv);

    expect(env.MONGODB_URI).toBe(validEnv.MONGODB_URI);
    expect(env.JWT_ACCESS_SECRET).toBe(validEnv.JWT_ACCESS_SECRET);
    expect(env.FRONTEND_ORIGIN).toBe(validEnv.FRONTEND_ORIGIN);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe("development");
    expect(env.APP_TIMEZONE).toBe("UTC");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("rejects a JWT access secret shorter than 32 characters", () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        JWT_ACCESS_SECRET: "a".repeat(31),
      }),
    ).toThrow();
  });

  it("rejects a frontend origin with a trailing slash", () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        FRONTEND_ORIGIN: "http://localhost:3000/",
      }),
    ).toThrow();
  });
});
