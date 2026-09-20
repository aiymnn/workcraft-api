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

// Tests must never reach a real SMTP server or Google. Blanking (not deleting)
// these keys stops `dotenv` from filling them back in from .env.
process.env.SMTP_HOST = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";
process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";
process.env.GOOGLE_REDIRECT_URI = "";
