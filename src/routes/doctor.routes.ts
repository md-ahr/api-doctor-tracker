import { Router } from "express";

import {
  create,
  createPatient,
  facets,
  getById,
  list,
  listPatients,
  update,
} from "../controllers/doctor.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { validate } from "../middleware/validate.js";
import {
  createDoctorBodySchema,
  doctorIdParamsSchema,
  doctorListQuerySchema,
  updateDoctorBodySchema,
} from "../schemas/doctor.schema.js";
import {
  createPatientBodySchema,
  doctorPatientListQuerySchema,
} from "../schemas/patient.schema.js";

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
doctorRouter.get(
  "/:doctorId/patients",
  validate({ params: doctorIdParamsSchema, query: doctorPatientListQuerySchema }),
  asyncHandler(listPatients),
);
doctorRouter.post(
  "/:doctorId/patients",
  validate({ params: doctorIdParamsSchema, body: createPatientBodySchema }),
  asyncHandler(createPatient),
);
