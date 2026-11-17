import { pathToFileURL } from "node:url";

import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./db/mongoose.js";
import { logger } from "./lib/logger.js";
import { hashPassword } from "./lib/password.js";
import * as adminModel from "./models/user.model.js";
import { cleanDemoData } from "./seed/clean.js";
import { seedDemoClinic } from "./seed/demo.js";

export type SeedOptions = {
  all?: boolean;
  clean?: boolean;
};

export function parseSeedArgv(argv: string[]): SeedOptions {
  return {
    all: argv.includes("--all"),
    clean: argv.includes("--clean"),
  };
}

export async function seedAdmin(): Promise<void> {
  const email = env.ADMIN_EMAIL;
  const password = env.ADMIN_PASSWORD;
  const name = env.ADMIN_NAME;
  if (!email || !password || !name) {
    throw new Error("ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required to seed");
  }

  await connectDatabase();
  const existing = await adminModel.findByEmail(email);
  if (!existing) {
    await adminModel.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      role: "admin",
    });
  }
}

export async function runSeed(options: SeedOptions = {}): Promise<void> {
  const wantsDemo = options.all === true;
  const wantsClean = options.clean === true;

  if (!wantsDemo && !wantsClean) {
    try {
      logger.info("Connecting to the database");
      await seedAdmin();
      logger.info("Admin seed complete");
    } catch (error) {
      logger.error({ err: error }, "Admin seed failed");
      process.exitCode = 1;
    } finally {
      try {
        await disconnectDatabase();
      } catch (error) {
        logger.error({ err: error }, "Failed to close the database connection");
        process.exitCode = 1;
      }
    }
    return;
  }

  try {
    logger.info("Connecting to the database");
    await connectDatabase();

    if (wantsClean) {
      logger.info("Clearing demo data");
      await cleanDemoData();
      logger.info("Demo data cleared");
    }

    if (wantsDemo) {
      await seedAdmin();
      logger.info("Seeding clinic demo data");
      const summary = await seedDemoClinic();
      logger.info(
        {
          staffInserted: summary.staffInserted,
          doctorsInserted: summary.doctorsInserted,
          patientsInserted: summary.patientsInserted,
        },
        "Clinic demo seed complete",
      );
    }
  } catch (error) {
    logger.error({ err: error }, "Seed failed");
    process.exitCode = 1;
  } finally {
    try {
      await disconnectDatabase();
    } catch (error) {
      logger.error({ err: error }, "Failed to close the database connection");
      process.exitCode = 1;
    }
  }
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  const options = parseSeedArgv(process.argv.slice(2));
  await runSeed(options);
}
