import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db/database.js";
import { packages } from "../db/schema/packages.js";
import {
  paymentPlanMilestones,
  paymentPlanTemplates,
} from "../db/schema/payment_plans.js";
import { contractTemplates } from "../db/schema/contract_templates.js";
import {
  checklistTemplateItems,
  checklistTemplates,
} from "../db/schema/checklist_templates.js";
import {
  emailTemplates,
  whatsappTemplates,
} from "../db/schema/message_templates.js";
import {
  emailTemplateTypes,
  whatsappTemplateTypes,
} from "../schemas/settings-templates.schema.js";

export class TemplatesServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "TemplatesServiceError";
  }
}

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseId(id: number, label: string) {
  if (!Number.isInteger(id) || id < 1) {
    throw new TemplatesServiceError(`Invalid ${label} id.`, 400);
  }
}

type MilestoneInput = {
  label: string;
  type: "FIXED" | "PCT_TOTAL" | "PCT_REMAINING";
  value: string;
  dueN: number;
  dueUnit: "DAYS" | "WEEKS" | "MONTHS";
  dueAnchor: "TODAY" | "BEFORE_SHOOT" | "AFTER_SHOOT";
  sortOrder?: number;
};

type ChecklistItemInput = {
  label: string;
  phase: "BEFORE" | "ON_DAY" | "AFTER";
  sortOrder?: number;
};

const DEFAULT_EMAIL = [
  {
    type: "QUOTE",
    title: "Quotation email",
    subject: "Your quotation from {studio}",
    body: "Thank you for considering {studio} for your event. Your quotation {quote_number} is ready — view it, read the agreement and accept it online. No login needed.",
  },
  {
    type: "INVOICE",
    title: "Invoice email",
    subject: "Invoice {invoice_number} from {studio}",
    body: "Here is your invoice {invoice_number} from {studio}. You can view it and your payment schedule online.",
  },
  {
    type: "REM_BEFORE",
    title: "Payment reminder — before due",
    subject: "Upcoming payment · {studio}",
    body: "A friendly reminder: your payment of {amount} for {milestone} is due on {due_date}.",
  },
  {
    type: "REM_DUE",
    title: "Payment reminder — due today",
    subject: "Payment due today · {studio}",
    body: "Your payment of {amount} for {milestone} is due today ({due_date}).",
  },
  {
    type: "REM_AFTER",
    title: "Payment reminder — overdue",
    subject: "Payment overdue · {studio}",
    body: "Your payment of {amount} for {milestone} was due on {due_date} and is now overdue. Please arrange payment at your earliest convenience.",
  },
] as const;

const DEFAULT_WA = [
  {
    type: "QUOTE",
    title: "Quotation",
    body: "Hello {name},\n\nThank you for considering {studio}. Your quotation {quote_number} is ready:\n{link}",
  },
  {
    type: "INVOICE",
    title: "Invoice",
    body: "Hello {name},\n\nPlease find invoice {invoice_number} from {studio}:\n{link}",
  },
  {
    type: "REM_BEFORE",
    title: "Payment reminder — before due",
    body: "Dear {name},\n\nYour payment of {amount} ({milestone}) is due on {due_date}:\n{link}",
  },
  {
    type: "REM_DUE",
    title: "Payment reminder — due today",
    body: "Hello {name},\n\nYour payment of {amount} ({milestone}) is due today ({due_date}):\n{link}",
  },
  {
    type: "REM_AFTER",
    title: "Payment reminder — overdue",
    body: "Dear {name},\n\nYour payment of {amount} ({milestone}) was due on {due_date}:\n{link}",
  },
  {
    type: "CONTRACT",
    title: "Contract",
    body: "Dear {name},\n\nPlease review your booking agreement with {studio}:\n{link}",
  },
] as const;

/* ── Packages ─────────────────────────────────────────────── */

export async function listPackages(studioId: number) {
  return db
    .select()
    .from(packages)
    .where(eq(packages.studioId, studioId))
    .orderBy(asc(packages.name), asc(packages.id));
}

export async function getPackage(studioId: number, id: number) {
  parseId(id, "package");
  const rows = await db
    .select()
    .from(packages)
    .where(and(eq(packages.id, id), eq(packages.studioId, studioId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createPackage(
  studioId: number,
  input: { name: string; price?: string; description?: string | null },
) {
  const result = await db.insert(packages).values({
    studioId,
    name: input.name.trim(),
    price: input.price ?? "0.00",
    description: emptyToNull(input.description),
  });
  const created = await getPackage(studioId, result[0].insertId);
  if (!created) throw new TemplatesServiceError("Failed to create package.", 500);
  return created;
}

export async function updatePackage(
  studioId: number,
  id: number,
  input: { name?: string; price?: string; description?: string | null },
) {
  const existing = await getPackage(studioId, id);
  if (!existing) throw new TemplatesServiceError("Package not found.", 404);

  const updates: Partial<typeof packages.$inferInsert> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.price !== undefined) updates.price = input.price;
  if (input.description !== undefined)
    updates.description = emptyToNull(input.description);

  if (Object.keys(updates).length === 0) {
    throw new TemplatesServiceError("At least one field is required to update.", 400);
  }

  await db
    .update(packages)
    .set(updates)
    .where(and(eq(packages.id, id), eq(packages.studioId, studioId)));

  const updated = await getPackage(studioId, id);
  if (!updated) throw new TemplatesServiceError("Package not found.", 404);
  return updated;
}

export async function deletePackage(studioId: number, id: number) {
  const existing = await getPackage(studioId, id);
  if (!existing) throw new TemplatesServiceError("Package not found.", 404);
  await db
    .delete(packages)
    .where(and(eq(packages.id, id), eq(packages.studioId, studioId)));
  return { id, deleted: true as const };
}

/* ── Payment plans ────────────────────────────────────────── */

async function getMilestonesForPlans(planIds: number[]) {
  const map = new Map<number, (typeof paymentPlanMilestones.$inferSelect)[]>();
  if (planIds.length === 0) return map;

  const rows = await db
    .select()
    .from(paymentPlanMilestones)
    .where(inArray(paymentPlanMilestones.planId, planIds))
    .orderBy(asc(paymentPlanMilestones.sortOrder), asc(paymentPlanMilestones.id));

  for (const row of rows) {
    const list = map.get(row.planId) ?? [];
    list.push(row);
    map.set(row.planId, list);
  }
  return map;
}

export async function listPaymentPlans(studioId: number) {
  const plans = await db
    .select()
    .from(paymentPlanTemplates)
    .where(eq(paymentPlanTemplates.studioId, studioId))
    .orderBy(asc(paymentPlanTemplates.name), asc(paymentPlanTemplates.id));

  const milestones = await getMilestonesForPlans(plans.map((p) => p.id));
  return plans.map((plan) => ({
    ...plan,
    milestones: milestones.get(plan.id) ?? [],
  }));
}

export async function getPaymentPlan(studioId: number, id: number) {
  parseId(id, "payment plan");
  const rows = await db
    .select()
    .from(paymentPlanTemplates)
    .where(
      and(
        eq(paymentPlanTemplates.id, id),
        eq(paymentPlanTemplates.studioId, studioId),
      ),
    )
    .limit(1);
  const plan = rows[0];
  if (!plan) return null;
  const milestones = await getMilestonesForPlans([plan.id]);
  return { ...plan, milestones: milestones.get(plan.id) ?? [] };
}

async function replaceMilestones(
  planId: number,
  milestones: MilestoneInput[],
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  await tx
    .delete(paymentPlanMilestones)
    .where(eq(paymentPlanMilestones.planId, planId));

  if (milestones.length === 0) return;

  await tx.insert(paymentPlanMilestones).values(
    milestones.map((m, index) => ({
      planId,
      label: m.label.trim(),
      type: m.type,
      value: m.value,
      dueN: m.dueN,
      dueUnit: m.dueUnit,
      dueAnchor: m.dueAnchor,
      sortOrder: m.sortOrder ?? index,
    })),
  );
}

export async function createPaymentPlan(
  studioId: number,
  input: { name: string; milestones?: MilestoneInput[] },
) {
  const planId = await db.transaction(async (tx) => {
    const result = await tx.insert(paymentPlanTemplates).values({
      studioId,
      name: input.name.trim(),
    });
    const id = result[0].insertId;
    await replaceMilestones(id, input.milestones ?? [], tx);
    return id;
  });

  const created = await getPaymentPlan(studioId, planId);
  if (!created) {
    throw new TemplatesServiceError("Failed to create payment plan.", 500);
  }
  return created;
}

export async function updatePaymentPlan(
  studioId: number,
  id: number,
  input: { name?: string; milestones?: MilestoneInput[] },
) {
  const existing = await getPaymentPlan(studioId, id);
  if (!existing) throw new TemplatesServiceError("Payment plan not found.", 404);

  if (input.name === undefined && input.milestones === undefined) {
    throw new TemplatesServiceError("At least one field is required to update.", 400);
  }

  await db.transaction(async (tx) => {
    if (input.name !== undefined) {
      await tx
        .update(paymentPlanTemplates)
        .set({ name: input.name.trim() })
        .where(
          and(
            eq(paymentPlanTemplates.id, id),
            eq(paymentPlanTemplates.studioId, studioId),
          ),
        );
    }
    if (input.milestones !== undefined) {
      await replaceMilestones(id, input.milestones, tx);
    }
  });

  const updated = await getPaymentPlan(studioId, id);
  if (!updated) throw new TemplatesServiceError("Payment plan not found.", 404);
  return updated;
}

export async function deletePaymentPlan(studioId: number, id: number) {
  const existing = await getPaymentPlan(studioId, id);
  if (!existing) throw new TemplatesServiceError("Payment plan not found.", 404);
  await db
    .delete(paymentPlanTemplates)
    .where(
      and(
        eq(paymentPlanTemplates.id, id),
        eq(paymentPlanTemplates.studioId, studioId),
      ),
    );
  return { id, deleted: true as const };
}

/* ── Contracts ────────────────────────────────────────────── */

export async function listContracts(studioId: number) {
  return db
    .select()
    .from(contractTemplates)
    .where(eq(contractTemplates.studioId, studioId))
    .orderBy(asc(contractTemplates.name), asc(contractTemplates.id));
}

export async function getContract(studioId: number, id: number) {
  parseId(id, "contract");
  const rows = await db
    .select()
    .from(contractTemplates)
    .where(
      and(eq(contractTemplates.id, id), eq(contractTemplates.studioId, studioId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createContract(
  studioId: number,
  input: { name: string; body: string },
) {
  const result = await db.insert(contractTemplates).values({
    studioId,
    name: input.name.trim(),
    body: input.body,
  });
  const created = await getContract(studioId, result[0].insertId);
  if (!created) throw new TemplatesServiceError("Failed to create contract.", 500);
  return created;
}

export async function updateContract(
  studioId: number,
  id: number,
  input: { name?: string; body?: string },
) {
  const existing = await getContract(studioId, id);
  if (!existing) throw new TemplatesServiceError("Contract not found.", 404);

  const updates: Partial<typeof contractTemplates.$inferInsert> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.body !== undefined) updates.body = input.body;

  if (Object.keys(updates).length === 0) {
    throw new TemplatesServiceError("At least one field is required to update.", 400);
  }

  await db
    .update(contractTemplates)
    .set(updates)
    .where(
      and(eq(contractTemplates.id, id), eq(contractTemplates.studioId, studioId)),
    );

  const updated = await getContract(studioId, id);
  if (!updated) throw new TemplatesServiceError("Contract not found.", 404);
  return updated;
}

export async function deleteContract(studioId: number, id: number) {
  const existing = await getContract(studioId, id);
  if (!existing) throw new TemplatesServiceError("Contract not found.", 404);
  await db
    .delete(contractTemplates)
    .where(
      and(eq(contractTemplates.id, id), eq(contractTemplates.studioId, studioId)),
    );
  return { id, deleted: true as const };
}

/* ── Checklists ───────────────────────────────────────────── */

async function getChecklistItems(templateIds: number[]) {
  const map = new Map<number, (typeof checklistTemplateItems.$inferSelect)[]>();
  if (templateIds.length === 0) return map;

  const rows = await db
    .select()
    .from(checklistTemplateItems)
    .where(inArray(checklistTemplateItems.templateId, templateIds))
    .orderBy(
      asc(checklistTemplateItems.sortOrder),
      asc(checklistTemplateItems.id),
    );

  for (const row of rows) {
    const list = map.get(row.templateId) ?? [];
    list.push(row);
    map.set(row.templateId, list);
  }
  return map;
}

function summarizeChecklist(
  template: typeof checklistTemplates.$inferSelect,
  items: (typeof checklistTemplateItems.$inferSelect)[],
) {
  return {
    ...template,
    before: items.filter((i) => i.phase === "BEFORE").length,
    onDay: items.filter((i) => i.phase === "ON_DAY").length,
    after: items.filter((i) => i.phase === "AFTER").length,
    items,
  };
}

export async function listChecklists(studioId: number) {
  const templates = await db
    .select()
    .from(checklistTemplates)
    .where(eq(checklistTemplates.studioId, studioId))
    .orderBy(asc(checklistTemplates.name), asc(checklistTemplates.id));

  const items = await getChecklistItems(templates.map((t) => t.id));
  return templates.map((t) => summarizeChecklist(t, items.get(t.id) ?? []));
}

export async function getChecklist(studioId: number, id: number) {
  parseId(id, "checklist");
  const rows = await db
    .select()
    .from(checklistTemplates)
    .where(
      and(
        eq(checklistTemplates.id, id),
        eq(checklistTemplates.studioId, studioId),
      ),
    )
    .limit(1);
  const template = rows[0];
  if (!template) return null;
  const items = await getChecklistItems([template.id]);
  return summarizeChecklist(template, items.get(template.id) ?? []);
}

async function clearDefaultChecklists(
  studioId: number,
  exceptId: number | null,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  if (exceptId === null) {
    await tx
      .update(checklistTemplates)
      .set({ isDefault: false })
      .where(eq(checklistTemplates.studioId, studioId));
    return;
  }
  await tx
    .update(checklistTemplates)
    .set({ isDefault: false })
    .where(
      and(
        eq(checklistTemplates.studioId, studioId),
        ne(checklistTemplates.id, exceptId),
      ),
    );
}

async function replaceChecklistItems(
  templateId: number,
  items: ChecklistItemInput[],
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  await tx
    .delete(checklistTemplateItems)
    .where(eq(checklistTemplateItems.templateId, templateId));

  if (items.length === 0) return;

  await tx.insert(checklistTemplateItems).values(
    items.map((item, index) => ({
      templateId,
      label: item.label.trim(),
      phase: item.phase,
      sortOrder: item.sortOrder ?? index,
    })),
  );
}

export async function createChecklist(
  studioId: number,
  input: {
    name: string;
    isDefault?: boolean;
    items?: ChecklistItemInput[];
  },
) {
  const id = await db.transaction(async (tx) => {
    if (input.isDefault) {
      await clearDefaultChecklists(studioId, null, tx);
    }
    const result = await tx.insert(checklistTemplates).values({
      studioId,
      name: input.name.trim(),
      isDefault: input.isDefault ?? false,
    });
    const templateId = result[0].insertId;
    await replaceChecklistItems(templateId, input.items ?? [], tx);
    return templateId;
  });

  const created = await getChecklist(studioId, id);
  if (!created) {
    throw new TemplatesServiceError("Failed to create checklist.", 500);
  }
  return created;
}

export async function updateChecklist(
  studioId: number,
  id: number,
  input: {
    name?: string;
    isDefault?: boolean;
    items?: ChecklistItemInput[];
  },
) {
  const existing = await getChecklist(studioId, id);
  if (!existing) throw new TemplatesServiceError("Checklist not found.", 404);

  if (
    input.name === undefined &&
    input.isDefault === undefined &&
    input.items === undefined
  ) {
    throw new TemplatesServiceError("At least one field is required to update.", 400);
  }

  await db.transaction(async (tx) => {
    if (input.isDefault === true) {
      await clearDefaultChecklists(studioId, id, tx);
    }

    const updates: Partial<typeof checklistTemplates.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.isDefault !== undefined) updates.isDefault = input.isDefault;

    if (Object.keys(updates).length > 0) {
      await tx
        .update(checklistTemplates)
        .set(updates)
        .where(
          and(
            eq(checklistTemplates.id, id),
            eq(checklistTemplates.studioId, studioId),
          ),
        );
    }

    if (input.items !== undefined) {
      await replaceChecklistItems(id, input.items, tx);
    }
  });

  const updated = await getChecklist(studioId, id);
  if (!updated) throw new TemplatesServiceError("Checklist not found.", 404);
  return updated;
}

export async function duplicateChecklist(studioId: number, id: number) {
  const existing = await getChecklist(studioId, id);
  if (!existing) throw new TemplatesServiceError("Checklist not found.", 404);

  return createChecklist(studioId, {
    name: `${existing.name} (copy)`,
    isDefault: false,
    items: existing.items.map((item) => ({
      label: item.label,
      phase: item.phase,
      sortOrder: item.sortOrder,
    })),
  });
}

export async function deleteChecklist(studioId: number, id: number) {
  const existing = await getChecklist(studioId, id);
  if (!existing) throw new TemplatesServiceError("Checklist not found.", 404);
  await db
    .delete(checklistTemplates)
    .where(
      and(
        eq(checklistTemplates.id, id),
        eq(checklistTemplates.studioId, studioId),
      ),
    );
  return { id, deleted: true as const };
}

/* ── Email / WhatsApp ─────────────────────────────────────── */

export async function listEmailTemplates(studioId: number) {
  return db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.studioId, studioId))
    .orderBy(asc(emailTemplates.type));
}

export async function upsertEmailTemplate(
  studioId: number,
  type: string,
  input: { title: string; subject: string; body: string },
) {
  if (!(emailTemplateTypes as readonly string[]).includes(type)) {
    throw new TemplatesServiceError("Unknown email template type.", 400);
  }

  const existing = await db
    .select()
    .from(emailTemplates)
    .where(
      and(eq(emailTemplates.studioId, studioId), eq(emailTemplates.type, type)),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(emailTemplates)
      .set({
        title: input.title.trim(),
        subject: input.subject.trim(),
        body: input.body,
      })
      .where(eq(emailTemplates.id, existing[0].id));
  } else {
    await db.insert(emailTemplates).values({
      studioId,
      type,
      title: input.title.trim(),
      subject: input.subject.trim(),
      body: input.body,
    });
  }

  const rows = await db
    .select()
    .from(emailTemplates)
    .where(
      and(eq(emailTemplates.studioId, studioId), eq(emailTemplates.type, type)),
    )
    .limit(1);
  return rows[0]!;
}

export async function seedEmailTemplates(studioId: number) {
  const existing = await listEmailTemplates(studioId);
  const have = new Set(existing.map((t) => t.type));
  const missing = DEFAULT_EMAIL.filter((t) => !have.has(t.type));

  if (missing.length > 0) {
    await db.insert(emailTemplates).values(
      missing.map((t) => ({
        studioId,
        type: t.type,
        title: t.title,
        subject: t.subject,
        body: t.body,
      })),
    );
  }

  return listEmailTemplates(studioId);
}

export async function listWhatsappTemplates(studioId: number) {
  return db
    .select()
    .from(whatsappTemplates)
    .where(eq(whatsappTemplates.studioId, studioId))
    .orderBy(asc(whatsappTemplates.type));
}

export async function upsertWhatsappTemplate(
  studioId: number,
  type: string,
  input: { title: string; body: string },
) {
  if (!(whatsappTemplateTypes as readonly string[]).includes(type)) {
    throw new TemplatesServiceError("Unknown WhatsApp template type.", 400);
  }

  const existing = await db
    .select()
    .from(whatsappTemplates)
    .where(
      and(
        eq(whatsappTemplates.studioId, studioId),
        eq(whatsappTemplates.type, type),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(whatsappTemplates)
      .set({
        title: input.title.trim(),
        body: input.body,
      })
      .where(eq(whatsappTemplates.id, existing[0].id));
  } else {
    await db.insert(whatsappTemplates).values({
      studioId,
      type,
      title: input.title.trim(),
      body: input.body,
    });
  }

  const rows = await db
    .select()
    .from(whatsappTemplates)
    .where(
      and(
        eq(whatsappTemplates.studioId, studioId),
        eq(whatsappTemplates.type, type),
      ),
    )
    .limit(1);
  return rows[0]!;
}

export async function seedWhatsappTemplates(studioId: number) {
  const existing = await listWhatsappTemplates(studioId);
  const have = new Set(existing.map((t) => t.type));
  const missing = DEFAULT_WA.filter((t) => !have.has(t.type));

  if (missing.length > 0) {
    await db.insert(whatsappTemplates).values(
      missing.map((t) => ({
        studioId,
        type: t.type,
        title: t.title,
        body: t.body,
      })),
    );
  }

  return listWhatsappTemplates(studioId);
}
