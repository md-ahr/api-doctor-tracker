/// <reference types="@cloudflare/workers-types" />

/** Wrangler overrides bindings when you run `npm run cf:typegen` → `worker-configuration.d.ts`. */
interface Env {
  API_CONTAINER: DurableObjectNamespace<import("./index").ApiContainer>;
  MONGODB_URI: string;
  JWT_ACCESS_SECRET: string;
  FRONTEND_ORIGIN: string;
  APP_TIMEZONE?: string;
  LOG_LEVEL?: string;
}
