import { Router } from "express";
import rateLimit from "express-rate-limit";

import { login, logout, me, refresh } from "../controllers/auth.controller.js";
import { DomainError } from "../lib/errors.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { validate } from "../middleware/validate.js";
import { loginBodySchema } from "../schemas/auth.schema.js";

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new DomainError("RATE_LIMITED"));
  },
});

export const authRouter = Router();

authRouter.post("/login", loginRateLimit, validate({ body: loginBodySchema }), asyncHandler(login));
authRouter.post("/refresh", asyncHandler(refresh));
authRouter.post("/logout", asyncHandler(logout));
authRouter.get("/me", requireAdmin, asyncHandler(me));
