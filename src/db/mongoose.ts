import mongoose from "mongoose";

import { env } from "../config/env.js";
import { AdminModel } from "../models/admin.model.js";
import { DoctorModel } from "../models/doctor.model.js";
import { PatientModel } from "../models/patient.model.js";
import { SessionModel } from "../models/session.model.js";

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI, { autoIndex: false });
}

export async function createIndexes(): Promise<void> {
  await Promise.all([
    AdminModel.createIndexes(),
    SessionModel.createIndexes(),
    DoctorModel.createIndexes(),
    PatientModel.createIndexes(),
  ]);
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await mongoose.connection.db?.admin().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
