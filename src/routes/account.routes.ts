import { Router } from "express";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  changeEmailSchema,
  changePasswordSchema,
  confirm2faSchema,
  confirmEmailChangeSchema,
  disable2faSchema,
  footagePortalSchema,
  googleOauthActionSchema,
  updateAccountProfileSchema,
} from "../schemas/account.schema.js";
import {
  changeEmailController,
  changePasswordController,
  confirm2faController,
  confirmEmailChangeController,
  disable2faController,
  enroll2faController,
  footagePortalController,
  getProfileController,
  googleCallbackController,
  googleDisconnectController,
  googleStartController,
  googleSyncController,
  patchProfileController,
  revokeAllSessionsController,
} from "../controllers/account.controller.js";

const router = Router();

// Public: both are reached from a link (email button, Google redirect) that
// cannot carry a Bearer token — they authenticate on their own token/state.
router.post(
  "/email/confirm",
  validateBody(confirmEmailChangeSchema),
  confirmEmailChangeController,
);
router.get("/oauth/google/callback", googleCallbackController);

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
router.post("/2fa/enroll", enroll2faController);
router.post(
  "/2fa/confirm",
  validateBody(confirm2faSchema),
  confirm2faController,
);
router.post(
  "/2fa/disable",
  validateBody(disable2faSchema),
  disable2faController,
);
router.post("/sessions/revoke-all", revokeAllSessionsController);
router.get("/oauth/google/start", googleStartController);
router.post(
  "/oauth/google/disconnect",
  validateBody(googleOauthActionSchema),
  googleDisconnectController,
);
router.post(
  "/oauth/google/sync",
  validateBody(googleOauthActionSchema),
  googleSyncController,
);
router.post(
  "/footage-portal",
  validateBody(footagePortalSchema),
  footagePortalController,
);

export default router;
