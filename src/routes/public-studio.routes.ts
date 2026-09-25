import { Router } from "express";
import { getPublicStudioController } from "../controllers/public-studio.controller.js";

/** Public studio contact — no staff JWT. */
const router = Router();

router.get("/", getPublicStudioController);

export default router;
