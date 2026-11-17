/// <reference lib="esnext.temporal" />

import { env } from "../config/env.js";
import { dayBounds, parsePlainDate } from "../lib/calendar.js";
import { DomainError, isDuplicateKeyError } from "../lib/errors.js";
import * as doctorModel from "../models/doctor.model.js";
import * as patientModel from "../models/patient.model.js";
import type {
  CreateDoctorBody,
  DoctorListQuery,
  UpdateDoctorBody,
} from "../schemas/doctor.schema.js";

export async function createDoctor(input: CreateDoctorBody) {
  const email = input.email.toLowerCase();
  const existing = await doctorModel.findByEmail(email);
  if (existing) throw new DomainError("EMAIL_IN_USE");

  try {
    return await doctorModel.create({ ...input, email });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new DomainError("EMAIL_IN_USE");
    throw error;
  }
}

export async function updateDoctor(id: string, patch: UpdateDoctorBody) {
  const current = await doctorModel.findById(id);
  if (!current) throw new DomainError("DOCTOR_NOT_FOUND");

  const email = patch.email?.toLowerCase();
  if (email && email !== current.email) {
    const existing = await doctorModel.findByEmail(email);
    if (existing && existing.id !== id) throw new DomainError("EMAIL_IN_USE");
  }

  try {
    const updated = await doctorModel.update(id, email ? { ...patch, email } : patch);
    if (!updated) throw new DomainError("DOCTOR_NOT_FOUND");
    return updated;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (isDuplicateKeyError(error)) throw new DomainError("EMAIL_IN_USE");
    throw error;
  }
}

export async function listDoctors(query: DoctorListQuery) {
  if (query.createdFrom && query.createdTo) {
    const from = parsePlainDate(query.createdFrom);
    const to = parsePlainDate(query.createdTo);
    if (Temporal.PlainDate.compare(from, to) > 0) {
      throw new DomainError("VALIDATION_ERROR", "Start date is after end date");
    }
  }

  return doctorModel.search({
    ...query,
    createdFrom: query.createdFrom
      ? dayBounds(query.createdFrom, env.APP_TIMEZONE).start
      : undefined,
    createdTo: query.createdTo ? dayBounds(query.createdTo, env.APP_TIMEZONE).end : undefined,
  });
}

export async function getDoctor(id: string) {
  const doctor = await doctorModel.findById(id);
  if (!doctor) throw new DomainError("DOCTOR_NOT_FOUND");
  const activePatientCount = await patientModel.countActive(id);
  return { ...doctor, activePatientCount };
}

export async function getDoctorFacets() {
  return doctorModel.facets();
}
