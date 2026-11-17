/// <reference lib="esnext.temporal" />

import { env } from "../config/env.js";
import { dayBounds, eachPlainDateInRange, parsePlainDate } from "../lib/calendar.js";
import { DomainError } from "../lib/errors.js";
import * as doctorModel from "../models/doctor.model.js";
import * as patientModel from "../models/patient.model.js";

const conditions = [
  "critical",
  "serious",
  "stable",
  "recovering",
  "chronic",
  "observation",
] as const;

const maxInclusiveDays = 366;

export async function getDashboard(range: { from?: string; to?: string } = {}) {
  const timezone = env.APP_TIMEZONE;
  const today = Temporal.Now.plainDateISO(timezone);
  const from = range.from ?? today.subtract({ days: 29 }).toString();
  const to = range.to ?? today.toString();
  const fromDate = parsePlainDate(from);
  const toDate = parsePlainDate(to);

  if (Temporal.PlainDate.compare(fromDate, toDate) > 0) {
    throw new DomainError("VALIDATION_ERROR", "Start date is after end date", [
      { path: "from", message: "Start date is after end date" },
    ]);
  }

  const span = fromDate.until(toDate, { largestUnit: "day" }).days;
  if (span > maxInclusiveDays - 1) {
    throw new DomainError("VALIDATION_ERROR", "Date range cannot exceed 366 days", [
      { path: "to", message: "Date range cannot exceed 366 days" },
    ]);
  }

  const window = {
    from: dayBounds(from, timezone).start,
    to: dayBounds(to, timezone).end,
  };

  const [doctors, patients, byDoctor, byCondition, registeredByDay, createdByDay, summaries] =
    await Promise.all([
      doctorModel.count(),
      patientModel.countActive(),
      patientModel.countByDoctor(),
      patientModel.countByCondition(),
      patientModel.countRegisteredByDay(window, timezone),
      doctorModel.countCreatedByDay(window, timezone),
      doctorModel.listSummaries(),
    ]);

  const patientCounts = new Map(byDoctor.map((row) => [row.doctorId, row.patientCount]));
  const patientsPerDoctor = summaries
    .map((doctor) => ({
      doctorId: doctor.id,
      name: doctor.name,
      specialization: doctor.specialization,
      patientCount: patientCounts.get(doctor.id) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.patientCount - left.patientCount || left.name.localeCompare(right.name),
    );

  const conditionCounts = new Map(byCondition.map((row) => [row.condition, row.patientCount]));
  const registeredCounts = new Map(registeredByDay.map((row) => [row.date, row.count]));
  const createdCounts = new Map(createdByDay.map((row) => [row.date, row.count]));
  const dates = eachPlainDateInRange(from, to);

  return {
    range: { from, to, timezone },
    totals: { doctors, patients },
    patientsPerDoctor,
    patientsByCondition: conditions.map((condition) => ({
      condition,
      patientCount: conditionCounts.get(condition) ?? 0,
    })),
    patientsRegisteredByDay: dates.map((date) => ({
      date,
      count: registeredCounts.get(date) ?? 0,
    })),
    doctorsCreatedByDay: dates.map((date) => ({
      date,
      count: createdCounts.get(date) ?? 0,
    })),
  };
}
