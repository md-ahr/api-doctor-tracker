import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { swaggerRouter } from "./docs/swagger.js";
import { logger } from "./lib/logger.js";
import { sendFailure } from "./lib/response.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { authRouter } from "./routes/auth.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { doctorRouter } from "./routes/doctor.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { patientRouter } from "./routes/patient.routes.js";

export function createApp() {
  const app = express();

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => {
        const request = req as typeof req & { requestId?: string };
        return request.requestId ?? "unknown";
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_ORIGINS,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Authorization", "Content-Type"],
    }),
  );
  app.use(express.json({ limit: "16kb" }));
  app.use("/api/docs", swaggerRouter);
  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/doctors", doctorRouter);
  app.use("/api/v1/patients", patientRouter);
  app.use("/api/v1/dashboard", dashboardRouter);
  app.use((_req, res) => {
    sendFailure(res, 404, "Route not found", "VALIDATION_ERROR", []);
  });
  app.use(errorHandler);

  return app;
}
