import { config as loadEnvFile } from "dotenv";
import { z } from "zod";

loadEnvFile();

const frontendOriginSchema = z
  .string()
  .trim()
  .min(1, "FRONTEND_ORIGIN is required")
  .transform((value) => value.split(","))
  .pipe(
    z
      .array(
        z
          .string()
          .trim()
          .min(1, "FRONTEND_ORIGIN contains an empty origin")
          .url("Each FRONTEND_ORIGIN must be an absolute URL")
          .refine((value) => !value.endsWith("/"), "No trailing slash"),
      )
      .min(1, "FRONTEND_ORIGIN is required")
      .transform((origins) => [...new Set(origins)]),
  );

const envObjectSchema = z.object({
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  FRONTEND_ORIGIN: frontendOriginSchema,
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_TIMEZONE: z.string().min(1).default("UTC"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  ADMIN_NAME: z.string().trim().min(1).max(120).optional(),
  ADMIN_EMAIL: z.string().trim().email().max(254).optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

export const envSchema = envObjectSchema.transform(({ FRONTEND_ORIGIN, ...rest }) => ({
  ...rest,
  FRONTEND_ORIGINS: FRONTEND_ORIGIN,
}));

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
