import { Router } from "express";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { requirePermission } from "../auth/permission.middleware.js";
import { listCalendarSessionsController, crewSchedulePdfController } from "../controllers/calendar.controller.js";

const router = Router();

router.use(requireAuth, requireStudio);

router.get(
  "/sessions",
  requirePermission("calendar.view"),
  listCalendarSessionsController,
);

router.post(
  "/crew-schedule/pdf",
  requirePermission("calendar.view"),
  crewSchedulePdfController,
);

export default router;
