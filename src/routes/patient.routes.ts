import { Router } from "express";

import { create, getById, list, remove, update } from "../controllers/patient.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { validate } from "../middleware/validate.js";
import {
  createAssignedPatientBodySchema,
  patientIdParamsSchema,
  patientListQuerySchema,
  updatePatientBodySchema,
} from "../schemas/patient.schema.js";

export const patientRouter = Router();

patientRouter.use(requireAdmin);
patientRouter.post("/", validate({ body: createAssignedPatientBodySchema }), asyncHandler(create));
patientRouter.get("/", validate({ query: patientListQuerySchema }), asyncHandler(list));
patientRouter.get(
  "/:patientId",
  validate({ params: patientIdParamsSchema }),
  asyncHandler(getById),
);
patientRouter.patch(
  "/:patientId",
  validate({ params: patientIdParamsSchema, body: updatePatientBodySchema }),
  asyncHandler(update),
);
patientRouter.delete(
  "/:patientId",
  validate({ params: patientIdParamsSchema }),
  asyncHandler(remove),
);
