import { Router } from "express";

import { get } from "../controllers/dashboard.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { validate } from "../middleware/validate.js";
import { dashboardQuerySchema } from "../schemas/dashboard.schema.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAdmin);
dashboardRouter.get("/", validate({ query: dashboardQuerySchema }), asyncHandler(get));
