import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  TemplatesServiceError,
  createChecklist,
  createContract,
  createPackage,
  createPaymentPlan,
  deleteChecklist,
  deleteContract,
  deletePackage,
  deletePaymentPlan,
  duplicateChecklist,
  getChecklist,
  getContract,
  getPackage,
  getPaymentPlan,
  listChecklists,
  listContracts,
  listEmailTemplates,
  listPackages,
  listPaymentPlans,
  listWhatsappTemplates,
  seedEmailTemplates,
  seedWhatsappTemplates,
  updateChecklist,
  updateContract,
  updatePackage,
  updatePaymentPlan,
  upsertEmailTemplate,
  upsertWhatsappTemplate,
} from "../services/settings-templates.service.js";

function requireStudioId(req: AuthenticatedRequest, res: Response): number | null {
  if (!req.studioId) {
    res.status(403).json({
      status: "error",
      message: "No studio membership for this account.",
    });
    return null;
  }
  return req.studioId;
}

function parseId(value: unknown): number | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

function handleError(error: unknown, res: Response, fallback: string) {
  if (error instanceof TemplatesServiceError) {
    return res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
  }
  console.error(fallback, error);
  return res.status(500).json({ status: "error", message: fallback });
}

/* Packages */

export async function listPackagesController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const items = await listPackages(studioId);
    return res.status(200).json({ status: "success", data: { packages: items } });
  } catch (error) {
    return handleError(error, res, "Unable to list packages.");
  }
}

export async function getPackageController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid package id." });
    }
    const pkg = await getPackage(studioId, id);
    if (!pkg) {
      return res.status(404).json({ status: "error", message: "Package not found." });
    }
    return res.status(200).json({ status: "success", data: { package: pkg } });
  } catch (error) {
    return handleError(error, res, "Unable to get package.");
  }
}

export async function createPackageController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const pkg = await createPackage(studioId, req.body);
    return res.status(201).json({ status: "success", data: { package: pkg } });
  } catch (error) {
    return handleError(error, res, "Unable to create package.");
  }
}

export async function updatePackageController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid package id." });
    }
    const pkg = await updatePackage(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { package: pkg } });
  } catch (error) {
    return handleError(error, res, "Unable to update package.");
  }
}

export async function deletePackageController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid package id." });
    }
    const result = await deletePackage(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete package.");
  }
}

/* Payment plans */

export async function listPaymentPlansController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const plans = await listPaymentPlans(studioId);
    return res.status(200).json({ status: "success", data: { plans } });
  } catch (error) {
    return handleError(error, res, "Unable to list payment plans.");
  }
}

export async function getPaymentPlanController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid payment plan id." });
    }
    const plan = await getPaymentPlan(studioId, id);
    if (!plan) {
      return res.status(404).json({ status: "error", message: "Payment plan not found." });
    }
    return res.status(200).json({ status: "success", data: { plan } });
  } catch (error) {
    return handleError(error, res, "Unable to get payment plan.");
  }
}

export async function createPaymentPlanController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const plan = await createPaymentPlan(studioId, req.body);
    return res.status(201).json({ status: "success", data: { plan } });
  } catch (error) {
    return handleError(error, res, "Unable to create payment plan.");
  }
}

export async function updatePaymentPlanController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid payment plan id." });
    }
    const plan = await updatePaymentPlan(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { plan } });
  } catch (error) {
    return handleError(error, res, "Unable to update payment plan.");
  }
}

export async function deletePaymentPlanController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid payment plan id." });
    }
    const result = await deletePaymentPlan(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete payment plan.");
  }
}

/* Contracts */

export async function listContractsController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const contracts = await listContracts(studioId);
    return res.status(200).json({ status: "success", data: { contracts } });
  } catch (error) {
    return handleError(error, res, "Unable to list contracts.");
  }
}

export async function getContractController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid contract id." });
    }
    const contract = await getContract(studioId, id);
    if (!contract) {
      return res.status(404).json({ status: "error", message: "Contract not found." });
    }
    return res.status(200).json({ status: "success", data: { contract } });
  } catch (error) {
    return handleError(error, res, "Unable to get contract.");
  }
}

export async function createContractController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const contract = await createContract(studioId, req.body);
    return res.status(201).json({ status: "success", data: { contract } });
  } catch (error) {
    return handleError(error, res, "Unable to create contract.");
  }
}

export async function updateContractController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid contract id." });
    }
    const contract = await updateContract(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { contract } });
  } catch (error) {
    return handleError(error, res, "Unable to update contract.");
  }
}

export async function deleteContractController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid contract id." });
    }
    const result = await deleteContract(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete contract.");
  }
}

/* Checklists */

export async function listChecklistsController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const checklists = await listChecklists(studioId);
    return res.status(200).json({ status: "success", data: { checklists } });
  } catch (error) {
    return handleError(error, res, "Unable to list checklists.");
  }
}

export async function getChecklistController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid checklist id." });
    }
    const checklist = await getChecklist(studioId, id);
    if (!checklist) {
      return res.status(404).json({ status: "error", message: "Checklist not found." });
    }
    return res.status(200).json({ status: "success", data: { checklist } });
  } catch (error) {
    return handleError(error, res, "Unable to get checklist.");
  }
}

export async function createChecklistController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const checklist = await createChecklist(studioId, req.body);
    return res.status(201).json({ status: "success", data: { checklist } });
  } catch (error) {
    return handleError(error, res, "Unable to create checklist.");
  }
}

export async function updateChecklistController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid checklist id." });
    }
    const checklist = await updateChecklist(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { checklist } });
  } catch (error) {
    return handleError(error, res, "Unable to update checklist.");
  }
}

export async function duplicateChecklistController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid checklist id." });
    }
    const checklist = await duplicateChecklist(studioId, id);
    return res.status(201).json({ status: "success", data: { checklist } });
  } catch (error) {
    return handleError(error, res, "Unable to duplicate checklist.");
  }
}

export async function deleteChecklistController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid checklist id." });
    }
    const result = await deleteChecklist(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete checklist.");
  }
}

/* Message templates */

export async function listEmailTemplatesController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const templates = await listEmailTemplates(studioId);
    return res.status(200).json({ status: "success", data: { templates } });
  } catch (error) {
    return handleError(error, res, "Unable to list email templates.");
  }
}

export async function upsertEmailTemplateController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const type = String(req.params.type ?? "");
    const template = await upsertEmailTemplate(studioId, type, req.body);
    return res.status(200).json({ status: "success", data: { template } });
  } catch (error) {
    return handleError(error, res, "Unable to save email template.");
  }
}

export async function seedEmailTemplatesController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const templates = await seedEmailTemplates(studioId);
    return res.status(200).json({ status: "success", data: { templates } });
  } catch (error) {
    return handleError(error, res, "Unable to seed email templates.");
  }
}

export async function listWhatsappTemplatesController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const templates = await listWhatsappTemplates(studioId);
    return res.status(200).json({ status: "success", data: { templates } });
  } catch (error) {
    return handleError(error, res, "Unable to list WhatsApp templates.");
  }
}

export async function upsertWhatsappTemplateController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const type = String(req.params.type ?? "");
    const template = await upsertWhatsappTemplate(studioId, type, req.body);
    return res.status(200).json({ status: "success", data: { template } });
  } catch (error) {
    return handleError(error, res, "Unable to save WhatsApp template.");
  }
}

export async function seedWhatsappTemplatesController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const templates = await seedWhatsappTemplates(studioId);
    return res.status(200).json({ status: "success", data: { templates } });
  } catch (error) {
    return handleError(error, res, "Unable to seed WhatsApp templates.");
  }
}
