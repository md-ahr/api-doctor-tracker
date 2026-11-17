import { Router } from "express";

import { create, facets, getById, list, update } from "../controllers/doctor.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { validate } from "../middleware/validate.js";
import {
  createDoctorBodySchema,
  doctorIdParamsSchema,
  doctorListQuerySchema,
  updateDoctorBodySchema,
} from "../schemas/doctor.schema.js";

export const doctorRouter = Router();

doctorRouter.use(requireAdmin);
doctorRouter.post("/", validate({ body: createDoctorBodySchema }), asyncHandler(create));
doctorRouter.get("/", validate({ query: doctorListQuerySchema }), asyncHandler(list));
doctorRouter.get("/facets", asyncHandler(facets));
doctorRouter.get("/:doctorId", validate({ params: doctorIdParamsSchema }), asyncHandler(getById));
doctorRouter.patch(
  "/:doctorId",
  validate({ params: doctorIdParamsSchema, body: updateDoctorBodySchema }),
  asyncHandler(update),
);
