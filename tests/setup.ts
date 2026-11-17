import { config as loadEnv } from "dotenv";

process.env.NODE_ENV = "test";
loadEnv();

process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/doctor-tracker-test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-at-least-32-chars";
process.env.FRONTEND_ORIGIN ||= "http://localhost:3000";
process.env.ADMIN_NAME ||= "Admin";
process.env.ADMIN_EMAIL ||= "admin@example.com";
process.env.ADMIN_PASSWORD ||= "password";
process.env.LOG_LEVEL = "silent";
