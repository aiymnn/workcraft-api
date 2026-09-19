import { Router } from "express";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  changeEmailSchema,
  changePasswordSchema,
  enroll2faSchema,
  updateAccountProfileSchema,
} from "../schemas/account.schema.js";
import {
  changeEmailController,
  changePasswordController,
  disable2faController,
  enroll2faController,
  getProfileController,
  patchProfileController,
} from "../controllers/account.controller.js";

const router = Router();

router.use(requireAuth, requireStudio);

router.get("/profile", getProfileController);
router.patch(
  "/profile",
  validateBody(updateAccountProfileSchema),
  patchProfileController,
);
router.post(
  "/password",
  validateBody(changePasswordSchema),
  changePasswordController,
);
router.post(
  "/email",
  validateBody(changeEmailSchema),
  changeEmailController,
);
router.post(
  "/2fa/enroll",
  validateBody(enroll2faSchema),
  enroll2faController,
);
router.post("/2fa/disable", disable2faController);

export default router;
