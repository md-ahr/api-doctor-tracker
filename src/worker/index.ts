import { DurableObject } from "cloudflare:workers";

const CONTAINER_PORT = 8080;
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const READINESS_PATH = "/api/v1/health";

export class ApiContainer extends DurableObject<Env> {
  private starting: Promise<void> | undefined;
  private monitoring: Promise<void> | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const container = ctx.container;
    if (container?.running) {
      void ctx.blockConcurrencyWhile(() => container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS));
      this.observeExit();
    }
  }

  async fetch(request: Request): Promise<Response> {
    this.starting ??= this.startAndWaitForPort().finally(() => {
      this.starting = undefined;
    });
    await this.starting;

    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "container";
    const forwarded = new Request(url, request);
    forwarded.headers.delete("host");
    return this.ctx.container!.getTcpPort(CONTAINER_PORT).fetch(forwarded);
  }

  private containerEnv(): Record<string, string> {
    return {
      MONGODB_URI: this.env.MONGODB_URI,
      JWT_ACCESS_SECRET: this.env.JWT_ACCESS_SECRET,
      FRONTEND_ORIGIN: this.env.FRONTEND_ORIGIN,
      APP_TIMEZONE: this.env.APP_TIMEZONE ?? "UTC",
      LOG_LEVEL: this.env.LOG_LEVEL ?? "info",
      NODE_ENV: "production",
      PORT: String(CONTAINER_PORT),
    };
  }

  private async startAndWaitForPort(): Promise<void> {
    const container = this.ctx.container!;
    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: "standard-1",
        enableInternet: true,
        env: this.containerEnv(),
      });
    }
    this.observeExit();
    await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);

    const port = container.getTcpPort(CONTAINER_PORT);
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const response = await port.fetch(`http://container${READINESS_PATH}`, {
          signal: AbortSignal.timeout(2000),
        });
        await response.body?.cancel();
        if (response.ok) return;
      } catch {
        // HTTP server may still be starting.
      }
      await scheduler.wait(200);
    }
    throw new Error(`Container did not become ready on port ${CONTAINER_PORT}`);
  }

  private observeExit(): void {
    if (this.monitoring) return;
    this.monitoring = this.ctx
      .container!.monitor()
      .catch(() => undefined)
      .finally(() => {
        this.monitoring = undefined;
      });
    this.ctx.waitUntil(this.monitoring);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.API_CONTAINER.idFromName("doctor-tracker-api");
    return env.API_CONTAINER.get(id).fetch(request);
  },
};
