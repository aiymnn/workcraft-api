import { Router } from "express";
import multer from "multer";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { requirePermission } from "../auth/permission.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  createOptionItemSchema,
  replaceRemindersSchema,
  updateOptionItemSchema,
  updateStudioSchema,
} from "../schemas/settings.schema.js";
import {
  createChecklistSchema,
  createContractSchema,
  createPackageSchema,
  createPaymentPlanSchema,
  updateChecklistSchema,
  updateContractSchema,
  updatePackageSchema,
  updatePaymentPlanSchema,
  upsertEmailTemplateSchema,
  upsertWhatsappTemplateSchema,
} from "../schemas/settings-templates.schema.js";
import {
  addOptionItemController,
  clearStudioLogoController,
  getOptionCatalogController,
  getStudioController,
  listOptionsController,
  listRemindersController,
  patchStudioController,
  putRemindersController,
  seedOptionCatalogController,
  updateOptionItemController,
  uploadStudioLogoController,
} from "../controllers/settings.controller.js";
import {
  createChecklistController,
  createContractController,
  createPackageController,
  createPaymentPlanController,
  deleteChecklistController,
  deleteContractController,
  deletePackageController,
  deletePaymentPlanController,
  duplicateChecklistController,
  getChecklistController,
  getContractController,
  getPackageController,
  getPaymentPlanController,
  listChecklistsController,
  listContractsController,
  listEmailTemplatesController,
  listPackagesController,
  listPaymentPlansController,
  listWhatsappTemplatesController,
  seedEmailTemplatesController,
  seedWhatsappTemplatesController,
  updateChecklistController,
  updateContractController,
  updatePackageController,
  updatePaymentPlanController,
  upsertEmailTemplateController,
  upsertWhatsappTemplateController,
} from "../controllers/settings-templates.controller.js";

const router = Router();

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.use(requireAuth, requireStudio);

router.get("/studio", requirePermission("settings.view"), getStudioController);
router.patch(
  "/studio",
  requirePermission("settings.manage"),
  validateBody(updateStudioSchema),
  patchStudioController,
);
router.post(
  "/studio/logo",
  requirePermission("settings.manage"),
  logoUpload.single("logo"),
  uploadStudioLogoController,
);
router.delete(
  "/studio/logo",
  requirePermission("settings.manage"),
  clearStudioLogoController,
);

router.get("/options", requirePermission("settings.view"), listOptionsController);
router.get(
  "/options/:key",
  requirePermission("settings.view"),
  getOptionCatalogController,
);
router.post(
  "/options/:key/seed",
  requirePermission("settings.manage"),
  seedOptionCatalogController,
);
router.post(
  "/options/:key/items",
  requirePermission("settings.manage"),
  validateBody(createOptionItemSchema),
  addOptionItemController,
);
router.patch(
  "/options/items/:id",
  requirePermission("settings.manage"),
  validateBody(updateOptionItemSchema),
  updateOptionItemController,
);

router.get(
  "/reminders",
  requirePermission("settings.view"),
  listRemindersController,
);
router.put(
  "/reminders",
  requirePermission("settings.manage"),
  validateBody(replaceRemindersSchema),
  putRemindersController,
);

/* Slice 3 — catalog templates */

router.get("/packages", requirePermission("settings.view"), listPackagesController);
router.get(
  "/packages/:id",
  requirePermission("settings.view"),
  getPackageController,
);
router.post(
  "/packages",
  requirePermission("settings.manage"),
  validateBody(createPackageSchema),
  createPackageController,
);
router.patch(
  "/packages/:id",
  requirePermission("settings.manage"),
  validateBody(updatePackageSchema),
  updatePackageController,
);
router.delete(
  "/packages/:id",
  requirePermission("settings.manage"),
  deletePackageController,
);

router.get(
  "/payment-plans",
  requirePermission("settings.view"),
  listPaymentPlansController,
);
router.get(
  "/payment-plans/:id",
  requirePermission("settings.view"),
  getPaymentPlanController,
);
router.post(
  "/payment-plans",
  requirePermission("settings.manage"),
  validateBody(createPaymentPlanSchema),
  createPaymentPlanController,
);
router.patch(
  "/payment-plans/:id",
  requirePermission("settings.manage"),
  validateBody(updatePaymentPlanSchema),
  updatePaymentPlanController,
);
router.delete(
  "/payment-plans/:id",
  requirePermission("settings.manage"),
  deletePaymentPlanController,
);

router.get(
  "/contracts",
  requirePermission("settings.view"),
  listContractsController,
);
router.get(
  "/contracts/:id",
  requirePermission("settings.view"),
  getContractController,
);
router.post(
  "/contracts",
  requirePermission("settings.manage"),
  validateBody(createContractSchema),
  createContractController,
);
router.patch(
  "/contracts/:id",
  requirePermission("settings.manage"),
  validateBody(updateContractSchema),
  updateContractController,
);
router.delete(
  "/contracts/:id",
  requirePermission("settings.manage"),
  deleteContractController,
);

router.get(
  "/checklists",
  requirePermission("settings.view"),
  listChecklistsController,
);
router.get(
  "/checklists/:id",
  requirePermission("settings.view"),
  getChecklistController,
);
router.post(
  "/checklists",
  requirePermission("settings.manage"),
  validateBody(createChecklistSchema),
  createChecklistController,
);
router.patch(
  "/checklists/:id",
  requirePermission("settings.manage"),
  validateBody(updateChecklistSchema),
  updateChecklistController,
);
router.post(
  "/checklists/:id/duplicate",
  requirePermission("settings.manage"),
  duplicateChecklistController,
);
router.delete(
  "/checklists/:id",
  requirePermission("settings.manage"),
  deleteChecklistController,
);

router.get(
  "/email-templates",
  requirePermission("settings.view"),
  listEmailTemplatesController,
);
router.post(
  "/email-templates/seed",
  requirePermission("settings.manage"),
  seedEmailTemplatesController,
);
router.put(
  "/email-templates/:type",
  requirePermission("settings.manage"),
  validateBody(upsertEmailTemplateSchema),
  upsertEmailTemplateController,
);

router.get(
  "/whatsapp-templates",
  requirePermission("settings.view"),
  listWhatsappTemplatesController,
);
router.post(
  "/whatsapp-templates/seed",
  requirePermission("settings.manage"),
  seedWhatsappTemplatesController,
);
router.put(
  "/whatsapp-templates/:type",
  requirePermission("settings.manage"),
  validateBody(upsertWhatsappTemplateSchema),
  upsertWhatsappTemplateController,
);

export default router;
