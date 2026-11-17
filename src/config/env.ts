import { config as loadEnvFile } from "dotenv";
import { z } from "zod";

loadEnvFile();

export const envSchema = z.object({
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  FRONTEND_ORIGIN: z
    .string()
    .url()
    .refine((value) => !value.endsWith("/"), "No trailing slash"),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_TIMEZONE: z.string().min(1).default("UTC"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  ADMIN_NAME: z.string().trim().min(1).max(120).optional(),
  ADMIN_EMAIL: z.string().trim().email().max(254).optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
