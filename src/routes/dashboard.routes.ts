import { Router } from "express";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { getDashboardController } from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/", requireAuth, requireStudio, getDashboardController);

export default router;
