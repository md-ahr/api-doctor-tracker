import { pathToFileURL } from "node:url";

import { env } from "./config/env.js";
import { connectDatabase } from "./db/mongoose.js";
import { hashPassword } from "./lib/password.js";
import * as adminModel from "./models/admin.model.js";

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

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  await seedAdmin();
}
