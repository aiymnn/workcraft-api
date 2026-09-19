import { Router } from "express";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { requirePermission } from "../auth/permission.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  createCrewContactSchema,
  createTeamMemberSchema,
  updateCrewContactSchema,
  updateTeamMemberSchema,
} from "../schemas/team.schema.js";
import {
  createCrewController,
  createMemberController,
  deleteCrewController,
  deleteMemberController,
  getCrewController,
  getMemberController,
  listCrewController,
  listMembersController,
  updateCrewController,
  updateMemberController,
} from "../controllers/team.controller.js";

const router = Router();

router.use(requireAuth, requireStudio);

router.get("/members", requirePermission("team.view"), listMembersController);
router.get("/members/:id", requirePermission("team.view"), getMemberController);
router.post(
  "/members",
  requirePermission("team.manage"),
  validateBody(createTeamMemberSchema),
  createMemberController,
);
router.patch(
  "/members/:id",
  requirePermission("team.manage"),
  validateBody(updateTeamMemberSchema),
  updateMemberController,
);
router.delete(
  "/members/:id",
  requirePermission("team.manage"),
  deleteMemberController,
);

router.get("/crew", requirePermission("team.view"), listCrewController);
router.get("/crew/:id", requirePermission("team.view"), getCrewController);
router.post(
  "/crew",
  requirePermission("team.manage"),
  validateBody(createCrewContactSchema),
  createCrewController,
);
router.patch(
  "/crew/:id",
  requirePermission("team.manage"),
  validateBody(updateCrewContactSchema),
  updateCrewController,
);
router.delete(
  "/crew/:id",
  requirePermission("team.manage"),
  deleteCrewController,
);

export default router;
