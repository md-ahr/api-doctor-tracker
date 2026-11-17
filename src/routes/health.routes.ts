import { Router } from "express";

import { pingDatabase } from "../db/mongoose.js";
import { sendData, sendFailure } from "../lib/response.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const datetime = new Date().toISOString();
    const up = await pingDatabase();
    if (!up) {
      sendFailure(res, 503, "Database unavailable", "INTERNAL", [], {
        status: "degraded",
        database: "down",
        datetime,
      });
      return;
    }
    sendData(res, 200, "Service is healthy", { status: "ok", database: "up", datetime });
  }),
);
