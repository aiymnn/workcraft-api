import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(process.cwd(), "../.env"),
});

dotenv.config();

process.env.APP_ENV ??= "test";
process.env.PORT ??= "3000";
process.env.DB_HOST ??= "localhost";
process.env.DB_PORT ??= "3307";
process.env.DB_NAME ??= "workcraft";
process.env.DB_USER ??= "workcraft";
process.env.DB_PASSWORD ??= "workcraft_password";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.JWT_SECRET ??=
  "test_secret_that_is_at_least_32_chars_long";
process.env.JWT_EXPIRES_IN ??= "1h";
