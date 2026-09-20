import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import dbRoutes from "./routes/db.routes.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import clientRoutes from "./routes/client.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import teamRoutes from "./routes/team.routes.js";
import accountRoutes from "./routes/account.routes.js";
import quotationRoutes from "./routes/quotation.routes.js";
import publicQuotationRoutes from "./routes/public-quotation.routes.js";
import jobRoutes from "./routes/job.routes.js";
import calendarRoutes from "./routes/calendar.routes.js";
import moneyRoutes from "./routes/money.routes.js";
import portalRoutes from "./routes/portal.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import pricingRoutes from "./routes/pricing.routes.js";
import equipmentRoutes from "./routes/equipment.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import { errorHandler } from "./errors/error-handler.js";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    // PDF downloads read the filename from Content-Disposition.
    exposedHeaders: ["Content-Disposition"],
  }),
);
// Provider callbacks are mounted first so they keep their raw, unparsed body.
app.use("/api/webhooks", webhookRoutes);

app.use(express.json());

const uploadsRoot = path.join(process.cwd(), "uploads");
fs.mkdirSync(path.join(uploadsRoot, "logos"), { recursive: true });
app.use("/uploads", express.static(uploadsRoot));

const openapiPath = path.join(process.cwd(), "docs", "openapi.yaml");

const openapiDocument = YAML.parse(fs.readFileSync(openapiPath, "utf8"));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

app.use("/api", healthRoutes);
app.use("/api/db", dbRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/public/quotations", publicQuotationRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/money", moneyRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/equipment", equipmentRoutes);

app.use(errorHandler);

export default app;
