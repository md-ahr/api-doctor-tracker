import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, createIndexes } from "./db/mongoose.js";
import { logger } from "./lib/logger.js";

logger.info("Connecting to the database");

await connectDatabase();
await createIndexes();

createApp().listen(env.PORT, () => {
  const origin = `http://localhost:${env.PORT}`;
  logger.info(`API ${origin}`);
  logger.info(`Docs ${origin}/api/docs`);
});
