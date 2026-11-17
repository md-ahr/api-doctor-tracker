import { env } from "../config/env.js";
import { DoctorModel } from "../models/doctor.model.js";
import { PatientModel } from "../models/patient.model.js";
import { SessionModel } from "../models/session.model.js";
import { AdminModel } from "../models/user.model.js";

export async function cleanDemoData(): Promise<void> {
  await Promise.all([
    PatientModel.deleteMany({}),
    SessionModel.deleteMany({}),
    DoctorModel.deleteMany({}),
  ]);

  const adminEmail = env.ADMIN_EMAIL?.toLowerCase();
  if (adminEmail) {
    await AdminModel.deleteMany({
      $or: [{ role: "user" }, { email: { $ne: adminEmail } }],
    });
    return;
  }

  await AdminModel.deleteMany({ role: "user" });
}
