import type { Request, Response } from "express";

import { pageMeta, sendData, sendList } from "../lib/response.js";
import type {
  CreateDoctorBody,
  DoctorListQuery,
  UpdateDoctorBody,
} from "../schemas/doctor.schema.js";
import type { CreatePatientBody, PatientListQuery } from "../schemas/patient.schema.js";
import * as doctorService from "../services/doctor.service.js";
import * as patientService from "../services/patient.service.js";

export async function create(_req: Request, res: Response): Promise<void> {
  const body = res.locals.body as CreateDoctorBody;
  const doctor = await doctorService.createDoctor(body);
  sendData(res, 201, "Doctor created successfully", toDoctorResource(doctor));
}

export async function list(_req: Request, res: Response): Promise<void> {
  const query = res.locals.query as DoctorListQuery;
  const page = await doctorService.listDoctors(query);
  sendList(
    res,
    "Doctors retrieved successfully",
    page.items.map(toDoctorResource),
    pageMeta(page.page, page.limit, page.total),
  );
}

export async function facets(_req: Request, res: Response): Promise<void> {
  const data = await doctorService.getDoctorFacets();
  sendData(res, 200, "Doctor facets retrieved successfully", data);
}

export async function getById(_req: Request, res: Response): Promise<void> {
  const { doctorId } = res.locals.params as { doctorId: string };
  const doctor = await doctorService.getDoctor(doctorId);
  sendData(res, 200, "Doctor retrieved successfully", toDoctorResource(doctor));
}

export async function update(_req: Request, res: Response): Promise<void> {
  const { doctorId } = res.locals.params as { doctorId: string };
  const body = res.locals.body as UpdateDoctorBody;
  const doctor = await doctorService.updateDoctor(doctorId, body);
  sendData(res, 200, "Doctor updated successfully", toDoctorResource(doctor));
}

export async function listPatients(_req: Request, res: Response): Promise<void> {
  const { doctorId } = res.locals.params as { doctorId: string };
  const query = res.locals.query as Omit<PatientListQuery, "doctorId">;
  const page = await patientService.listDoctorPatients(doctorId, query);
  sendList(
    res,
    "Patients retrieved successfully",
    page.items,
    pageMeta(page.page, page.limit, page.total),
  );
}

export async function createPatient(_req: Request, res: Response): Promise<void> {
  const { doctorId } = res.locals.params as { doctorId: string };
  const body = res.locals.body as CreatePatientBody;
  const patient = await patientService.createPatient(doctorId, body);
  sendData(res, 201, "Patient created successfully", patient);
}

function toDoctorResource(doctor: {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  activePatientCount?: number;
}) {
  return {
    ...doctor,
    createdAt: doctor.createdAt.toISOString(),
    updatedAt: doctor.updatedAt.toISOString(),
  };
}
