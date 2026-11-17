import pino, { type Logger } from "pino";

import { env, type Env } from "../config/env.js";

export function createLogger(level: Env["LOG_LEVEL"] = env.LOG_LEVEL): Logger {
  return pino({
    level,
    redact: [
      "password",
      "passwordHash",
      "hash",
      "refreshToken",
      "accessToken",
      "token",
      "*.password",
      "*.passwordHash",
      "*.hash",
      "*.refreshToken",
      "*.accessToken",
      "*.token",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
  });
}

export const logger = createLogger();
