import { Types } from "mongoose";

import { hashPassword } from "../lib/password.js";
import { DoctorModel } from "../models/doctor.model.js";
import { PatientModel } from "../models/patient.model.js";
import { AdminModel } from "../models/user.model.js";
import {
  BD_HOSPITALS,
  CONDITION_WEIGHTS,
  CONDITIONS,
  DEMO_STAFF,
  DEMO_STAFF_PASSWORD,
  SPECIALIZATIONS,
  bdMobile,
  doctorFamilyName,
  doctorGivenName,
  patientFullName,
} from "./bd-fixtures.js";
import { createRng, pick } from "./prng.js";

export const DEMO_DOCTOR_TARGET = 100;
export const DEMO_PATIENT_TARGET = 1000;
export const DEMO_STAFF_TARGET = DEMO_STAFF.length; // 9 staff users

const BATCH = 250;
const DEMO_SEED = 42_026_111;

function weightedCondition(rng: () => number): (typeof CONDITIONS)[number] {
  const total = CONDITIONS.reduce((sum, key) => sum + CONDITION_WEIGHTS[key], 0);
  let roll = rng() * total;
  for (const condition of CONDITIONS) {
    roll -= CONDITION_WEIGHTS[condition];
    if (roll <= 0) return condition;
  }
  return "stable";
}

function dateOfBirth(rng: () => number): string {
  const year = 1945 + Math.floor(rng() * 56);
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function registrationDate(rng: () => number): Date {
  const start = Date.UTC(2024, 0, 1);
  const end = Date.UTC(2026, 10, 16);
  const ms = start + Math.floor(rng() * (end - start));
  return new Date(ms);
}

export async function seedStaffUsers(passwordHash?: string): Promise<number> {
  const hash = passwordHash ?? (await hashPassword(DEMO_STAFF_PASSWORD));
  const present = await AdminModel.find({
    email: { $in: DEMO_STAFF.map((staff) => staff.email) },
  })
    .select("email")
    .lean<Array<{ email: string }>>();
  const presentEmails = new Set(present.map((row) => row.email));
  const missing = DEMO_STAFF.filter((staff) => !presentEmails.has(staff.email));
  if (missing.length === 0) return 0;

  await AdminModel.insertMany(
    missing.map((staff) => ({
      name: staff.name,
      email: staff.email,
      passwordHash: hash,
      role: "user",
    })),
  );
  return missing.length;
}

export async function seedDoctors(): Promise<{ inserted: number; doctorIds: string[] }> {
  const existing = await DoctorModel.countDocuments();
  if (existing >= DEMO_DOCTOR_TARGET) {
    const docs = await DoctorModel.find({})
      .sort({ email: 1 })
      .select("_id")
      .limit(DEMO_DOCTOR_TARGET)
      .lean<Array<{ _id: Types.ObjectId }>>();
    return { inserted: 0, doctorIds: docs.map((doc) => doc._id.toString()) };
  }

  const rng = createRng(DEMO_SEED);
  const startIndex = existing;
  const toCreate = DEMO_DOCTOR_TARGET - existing;
  const rows = Array.from({ length: toCreate }, (_, offset) => {
    const index = startIndex + offset;
    const given = doctorGivenName(index);
    const family = doctorFamilyName(index);
    const name = `Dr. ${given} ${family}`;
    const specialization = SPECIALIZATIONS[index % SPECIALIZATIONS.length]!;
    const hospital = BD_HOSPITALS[index % BD_HOSPITALS.length]!;
    const email = `dr-${String(index + 1).padStart(3, "0")}@seed.careguide.local`;
    return {
      name,
      specialization,
      hospital,
      phone: bdMobile(index, rng),
      email,
      createdAt: registrationDate(rng),
      updatedAt: registrationDate(rng),
    };
  });

  await DoctorModel.insertMany(rows, { ordered: true });
  const docs = await DoctorModel.find({})
    .sort({ email: 1 })
    .select("_id")
    .limit(DEMO_DOCTOR_TARGET)
    .lean<Array<{ _id: Types.ObjectId }>>();
  return { inserted: toCreate, doctorIds: docs.map((doc) => doc._id.toString()) };
}

export async function seedPatients(doctorIds: string[]): Promise<number> {
  if (doctorIds.length === 0) return 0;

  const existing = await PatientModel.countDocuments({ deletedAt: null });
  if (existing >= DEMO_PATIENT_TARGET) return 0;

  const rng = createRng(DEMO_SEED + 1);
  const toCreate = DEMO_PATIENT_TARGET - existing;
  let inserted = 0;

  for (let offset = 0; offset < toCreate; offset += BATCH) {
    const size = Math.min(BATCH, toCreate - offset);
    const batch = Array.from({ length: size }, (_, i) => {
      const index = existing + offset + i;
      const doctorId = doctorIds[index % doctorIds.length]!;
      const sexRoll = rng();
      const sex =
        sexRoll < 0.48
          ? "male"
          : sexRoll < 0.96
            ? "female"
            : pick(rng, ["other", "undisclosed"] as const);
      const hasPhone = rng() > 0.08;
      const hasEmail = rng() > 0.35;
      const hasNotes = rng() > 0.55;
      const registeredAt = registrationDate(rng);

      return {
        doctorId: new Types.ObjectId(doctorId),
        fullName: patientFullName(rng, index),
        dateOfBirth: rng() > 0.05 ? dateOfBirth(rng) : null,
        sex,
        phone: hasPhone ? bdMobile(index + 3, rng) : null,
        email: hasEmail
          ? `patient.${String(index + 1).padStart(4, "0")}@mail.careguide.local`
          : null,
        condition: weightedCondition(rng),
        notes: hasNotes
          ? pick(rng, [
              "Follow-up at Dhanmondi branch.",
              "Referred from emergency night shift.",
              "Insurance paperwork pending.",
              "Prefers Bengali-speaking nurse.",
              "Diabetic diet counselling scheduled.",
              "Vitals stable at last visit.",
            ])
          : null,
        registeredAt,
        deletedAt: null,
        createdAt: registeredAt,
        updatedAt: registeredAt,
      };
    });

    await PatientModel.insertMany(batch, { ordered: false });
    inserted += size;
  }

  return inserted;
}

export async function seedDemoClinic(): Promise<{
  staffInserted: number;
  doctorsInserted: number;
  patientsInserted: number;
}> {
  const passwordHash = await hashPassword(DEMO_STAFF_PASSWORD);
  const staffInserted = await seedStaffUsers(passwordHash);
  const { inserted: doctorsInserted, doctorIds } = await seedDoctors();
  const patientsInserted = await seedPatients(doctorIds);

  return { staffInserted, doctorsInserted, patientsInserted };
}
