import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, createIndexes } from "./db/mongoose.js";

await connectDatabase();
await createIndexes();

createApp().listen(env.PORT);
