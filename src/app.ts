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
import { errorHandler } from "./errors/error-handler.js";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
  }),
);
app.use(express.json());

const openapiPath = path.join(process.cwd(), "docs", "openapi.yaml");

const openapiDocument = YAML.parse(fs.readFileSync(openapiPath, "utf8"));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

app.use("/api", healthRoutes);
app.use("/api/db", dbRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

app.use(errorHandler);

export default app;
