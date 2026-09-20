import "dotenv/config";
import * as z from "zod";

const envSchema = z.object({
  APP_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(3000),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),

  CORS_ORIGIN: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().min(1),

  /** Origin of the client-facing web app, used to build public quote/portal links. */
  PUBLIC_WEB_ORIGIN: z.string().min(1).default("http://localhost:5173"),

  /** Outbound email. Sending is disabled until host + user + pass are all set. */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  /** Google OAuth for Calendar sync / Drive receipts. Off until all three are set. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  /** AES key for provider tokens at rest. Falls back to JWT_SECRET when unset. */
  TOKEN_ENC_KEY: z.string().optional(),

  /** CHIP online payments. Checkout stays off until all three are set. */
  CHIP_BRAND_ID: z.string().optional(),
  CHIP_API_KEY: z.string().optional(),
  CHIP_WEBHOOK_SECRET: z.string().optional(),
  CHIP_API_BASE: z.string().min(1).default("https://gate.chip-in.asia/api/v1"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error(
    "Invalid environment configuration:",
    result.error.issues,
  );

  process.exit(1);
}

export const env = result.data;
