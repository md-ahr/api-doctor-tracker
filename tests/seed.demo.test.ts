import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DoctorModel } from "../src/models/doctor.model.js";
import { PatientModel } from "../src/models/patient.model.js";
import { AdminModel } from "../src/models/user.model.js";
import { cleanDemoData } from "../src/seed/clean.js";
import {
  DEMO_DOCTOR_TARGET,
  DEMO_PATIENT_TARGET,
  DEMO_STAFF_TARGET,
  seedDemoClinic,
} from "../src/seed/demo.js";
import { parseSeedArgv } from "../src/seed.js";

describe("seed demo clinic", () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { autoIndex: false });
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("parses --clean and --all flags", () => {
    expect(parseSeedArgv(["--clean", "--all"])).toEqual({ clean: true, all: true });
    expect(parseSeedArgv([])).toEqual({ clean: false, all: false });
  });

  it("loads Bangladesh-style clinic volumes", async () => {
    await cleanDemoData();
    const summary = await seedDemoClinic();

    expect(summary.staffInserted).toBe(DEMO_STAFF_TARGET);
    expect(summary.doctorsInserted).toBe(DEMO_DOCTOR_TARGET);
    expect(summary.patientsInserted).toBe(DEMO_PATIENT_TARGET);

    expect(await AdminModel.countDocuments({ role: "user" })).toBe(DEMO_STAFF_TARGET);
    expect(await DoctorModel.countDocuments()).toBe(DEMO_DOCTOR_TARGET);
    expect(await PatientModel.countDocuments({ deletedAt: null })).toBe(DEMO_PATIENT_TARGET);

    const sampleDoctor = await DoctorModel.findOne().lean();
    expect(sampleDoctor?.hospital).toMatch(/Dhaka|Hospital|Centre/i);
    expect(sampleDoctor?.phone).toMatch(/^\+880 /);

    const doctorNames = await DoctorModel.distinct("name");
    expect(doctorNames).toHaveLength(DEMO_DOCTOR_TARGET);

    const summaryAgain = await seedDemoClinic();
    expect(summaryAgain).toEqual({
      staffInserted: 0,
      doctorsInserted: 0,
      patientsInserted: 0,
    });
  }, 120_000);
});
