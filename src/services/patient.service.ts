/// <reference lib="esnext.temporal" />

import { env } from "../config/env.js";
import { dayBounds, parsePlainDate } from "../lib/calendar.js";
import { DomainError } from "../lib/errors.js";
import * as doctorModel from "../models/doctor.model.js";
import * as patientModel from "../models/patient.model.js";
import type { Patient } from "../models/patient.model.js";
import type {
  CreatePatientBody,
  PatientListQuery,
  UpdatePatientBody,
} from "../schemas/patient.schema.js";

export type PatientResource = {
  id: string;
  doctorId: string;
  doctorName: string;
  fullName: string;
  dateOfBirth: string | null;
  sex: Patient["sex"];
  phone: string | null;
  email: string | null;
  condition: Patient["condition"];
  notes: string | null;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
};

function toPatientResource(patient: Patient, doctorName: string): PatientResource {
  return {
    id: patient.id,
    doctorId: patient.doctorId,
    doctorName,
    fullName: patient.fullName,
    dateOfBirth: patient.dateOfBirth,
    sex: patient.sex,
    phone: patient.phone,
    email: patient.email,
    condition: patient.condition,
    notes: patient.notes,
    registeredAt: patient.registeredAt.toISOString(),
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
  };
}

async function withDoctorNames(patients: Patient[]): Promise<PatientResource[]> {
  const doctorIds = [...new Set(patients.map((patient) => patient.doctorId))];
  const doctors = await doctorModel.findByIds(doctorIds);
  const names = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));
  return patients.map((patient) => toPatientResource(patient, names.get(patient.doctorId) ?? ""));
}

export async function createPatient(
  doctorId: string,
  input: CreatePatientBody,
): Promise<PatientResource> {
  const doctor = await doctorModel.findById(doctorId);
  if (!doctor) throw new DomainError("DOCTOR_NOT_FOUND");

  const registeredAt = input.registeredAt
    ? dayBounds(input.registeredAt, env.APP_TIMEZONE).start
    : new Date();
  const created = await patientModel.create({
    doctorId,
    fullName: input.fullName,
    dateOfBirth: input.dateOfBirth ?? null,
    sex: input.sex ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    condition: input.condition,
    notes: input.notes ?? null,
    registeredAt,
  });
  return toPatientResource(created, doctor.name);
}

export async function updatePatient(
  id: string,
  patch: UpdatePatientBody,
): Promise<PatientResource> {
  const current = await patientModel.findById(id);
  if (!current) throw new DomainError("PATIENT_NOT_FOUND");

  if (patch.doctorId) {
    const doctor = await doctorModel.findById(patch.doctorId);
    if (!doctor) throw new DomainError("DOCTOR_NOT_FOUND");
  }

  const { registeredAt, ...rest } = patch;
  const updated = await patientModel.update(id, {
    ...rest,
    ...(registeredAt ? { registeredAt: dayBounds(registeredAt, env.APP_TIMEZONE).start } : {}),
  });
  if (!updated) throw new DomainError("PATIENT_NOT_FOUND");

  const [resource] = await withDoctorNames([updated]);
  return resource;
}

export async function deletePatient(id: string): Promise<void> {
  const deleted = await patientModel.softDelete(id, new Date());
  if (!deleted) throw new DomainError("PATIENT_NOT_FOUND");
}

export async function listPatients(query: PatientListQuery) {
  if (query.registeredFrom && query.registeredTo) {
    const from = parsePlainDate(query.registeredFrom);
    const to = parsePlainDate(query.registeredTo);
    if (Temporal.PlainDate.compare(from, to) > 0) {
      throw new DomainError("VALIDATION_ERROR", "Start date is after end date");
    }
  }

  const page = await patientModel.search({
    ...query,
    registeredFrom: query.registeredFrom
      ? dayBounds(query.registeredFrom, env.APP_TIMEZONE).start
      : undefined,
    registeredTo: query.registeredTo
      ? dayBounds(query.registeredTo, env.APP_TIMEZONE).end
      : undefined,
  });
  return {
    ...page,
    items: await withDoctorNames(page.items),
  };
}

export async function getPatient(id: string): Promise<PatientResource> {
  const patient = await patientModel.findById(id);
  if (!patient) throw new DomainError("PATIENT_NOT_FOUND");
  const [resource] = await withDoctorNames([patient]);
  return resource;
}

export async function listDoctorPatients(
  doctorId: string,
  query: Omit<PatientListQuery, "doctorId">,
) {
  const doctor = await doctorModel.findById(doctorId);
  if (!doctor) throw new DomainError("DOCTOR_NOT_FOUND");
  return listPatients({ ...query, doctorId });
}
