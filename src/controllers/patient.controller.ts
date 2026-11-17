import type { Request, Response } from "express";

import { pageMeta, sendData, sendList } from "../lib/response.js";
import type {
  CreateAssignedPatientBody,
  PatientListQuery,
  UpdatePatientBody,
} from "../schemas/patient.schema.js";
import * as patientService from "../services/patient.service.js";

export async function create(_req: Request, res: Response): Promise<void> {
  const { doctorId, ...body } = res.locals.body as CreateAssignedPatientBody;
  const patient = await patientService.createPatient(doctorId, body);
  sendData(res, 201, "Patient created successfully", patient);
}

export async function list(_req: Request, res: Response): Promise<void> {
  const query = res.locals.query as PatientListQuery;
  const page = await patientService.listPatients(query);
  sendList(
    res,
    "Patients retrieved successfully",
    page.items,
    pageMeta(page.page, page.limit, page.total),
  );
}

export async function getById(_req: Request, res: Response): Promise<void> {
  const { patientId } = res.locals.params as { patientId: string };
  const patient = await patientService.getPatient(patientId);
  sendData(res, 200, "Patient retrieved successfully", patient);
}

export async function update(_req: Request, res: Response): Promise<void> {
  const { patientId } = res.locals.params as { patientId: string };
  const body = res.locals.body as UpdatePatientBody;
  const patient = await patientService.updatePatient(patientId, body);
  sendData(res, 200, "Patient updated successfully", patient);
}

export async function remove(_req: Request, res: Response): Promise<void> {
  const { patientId } = res.locals.params as { patientId: string };
  await patientService.deletePatient(patientId);
  sendData(res, 200, "Patient deleted successfully", null);
}
