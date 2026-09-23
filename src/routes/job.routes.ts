import { Router } from "express";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { requirePermission } from "../auth/permission.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  createJobSchema,
  patchChecklistItemSchema,
  patchDeliverableSchema,
  updateJobSchema,
} from "../schemas/job.schema.js";
import {
  createJobController,
  deleteJobController,
  getJobController,
  listJobActivityController,
  listJobsController,
  patchChecklistItemController,
  patchDeliverableController,
  updateJobController,
} from "../controllers/job.controller.js";

const router = Router();

router.use(requireAuth, requireStudio);

router.get("/", requirePermission("jobs.view"), listJobsController);
router.get(
  "/:id/activity",
  requirePermission("jobs.view"),
  listJobActivityController,
);
router.get("/:id", requirePermission("jobs.view"), getJobController);
router.post(
  "/",
  requirePermission("jobs.create"),
  validateBody(createJobSchema),
  createJobController,
);
router.patch(
  "/:id",
  requirePermission("jobs.update"),
  validateBody(updateJobSchema),
  updateJobController,
);
router.delete(
  "/:id",
  requirePermission("jobs.delete"),
  deleteJobController,
);
router.patch(
  "/:id/checklist/:itemId",
  requirePermission("jobs.update"),
  validateBody(patchChecklistItemSchema),
  patchChecklistItemController,
);
router.patch(
  "/:id/deliverables/:deliverableId",
  requirePermission("jobs.update"),
  validateBody(patchDeliverableSchema),
  patchDeliverableController,
);

export default router;
