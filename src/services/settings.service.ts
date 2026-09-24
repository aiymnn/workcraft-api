import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/database.js";
import {
  optionItems,
  optionLists,
  type OptionListKey,
} from "../db/schema/option_lists.js";
import { reminderRules } from "../db/schema/reminder_rules.js";
import { studios } from "../db/schema/studios.js";
import {
  OPTION_BUILT_IN_LABELS,
  OPTION_DEFAULT_LABELS,
  catalogStartsBuiltIn,
  isOptionListKey,
} from "./option-catalog.defaults.js";

export class SettingsServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "SettingsServiceError";
  }
}

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function getStudioSettings(studioId: number) {
  const rows = await db
    .select()
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  const studio = rows[0];
  if (!studio) {
    throw new SettingsServiceError("Studio not found.", 404);
  }
  return studio;
}

export async function updateStudioSettings(
  studioId: number,
  input: Record<string, unknown>,
) {
  await getStudioSettings(studioId);

  const updates: Partial<typeof studios.$inferInsert> = {};

  const stringFields = [
    "name",
    "ssm",
    "tin",
    "address",
    "phone",
    "email",
    "logoUrl",
    "payToBank",
    "payToAccountName",
    "payToAccountNo",
    "portalMessage",
    "currency",
    "invoiceTemplateId",
    "quoteIntro",
    "quoteNotes",
    "invoiceNotes",
  ] as const;

  for (const key of stringFields) {
    if (key in input) {
      const value = input[key];
      if (key === "name" || key === "currency" || key === "invoiceTemplateId") {
        if (typeof value !== "string" || !value.trim()) {
          throw new SettingsServiceError(`${key} cannot be empty.`, 400);
        }
        updates[key] = value.trim();
      } else if (value === null || typeof value === "string") {
        (updates as Record<string, unknown>)[key] = emptyToNull(
          value as string | null,
        );
      }
    }
  }

  if ("bizType" in input) {
    const v = input.bizType;
    if (v === null) updates.bizType = null;
    else if (v === "SOLE_PROP" || v === "SDN_BHD") updates.bizType = v;
    else throw new SettingsServiceError("Invalid bizType.", 400);
  }

  if ("workingDays" in input) {
    if (!Array.isArray(input.workingDays)) {
      throw new SettingsServiceError("workingDays must be an array.", 400);
    }
    updates.workingDays = input.workingDays as number[];
  }

  if ("capacityPerDay" in input && typeof input.capacityPerDay === "number") {
    updates.capacityPerDay = input.capacityPerDay;
  }
  if ("quoteNextNumber" in input && typeof input.quoteNextNumber === "number") {
    updates.quoteNextNumber = input.quoteNextNumber;
  }
  if (
    "invoiceNextNumber" in input &&
    typeof input.invoiceNextNumber === "number"
  ) {
    updates.invoiceNextNumber = input.invoiceNextNumber;
  }
  if ("chipEnabled" in input && typeof input.chipEnabled === "boolean") {
    updates.chipEnabled = input.chipEnabled;
  }
  if (
    "paymentRemindersEnabled" in input &&
    typeof input.paymentRemindersEnabled === "boolean"
  ) {
    updates.paymentRemindersEnabled = input.paymentRemindersEnabled;
  }

  if (Object.keys(updates).length === 0) {
    throw new SettingsServiceError(
      "At least one field is required to update.",
      400,
    );
  }

  await db.update(studios).set(updates).where(eq(studios.id, studioId));
  return getStudioSettings(studioId);
}

export async function listOptionCatalogs(studioId: number) {
  const lists = await db
    .select()
    .from(optionLists)
    .where(eq(optionLists.studioId, studioId))
    .orderBy(asc(optionLists.key));

  const listIds = lists.map((l) => l.id);
  const items =
    listIds.length === 0
      ? []
      : await db
          .select()
          .from(optionItems)
          .where(inArray(optionItems.listId, listIds))
          .orderBy(asc(optionItems.sortOrder), asc(optionItems.id));

  const itemsByList = new Map<number, typeof items>();
  for (const item of items) {
    const group = itemsByList.get(item.listId) ?? [];
    group.push(item);
    itemsByList.set(item.listId, group);
  }

  return lists.map((list) => ({
    ...list,
    builtInUntilSeeded: catalogStartsBuiltIn(list.key) && !list.seeded,
    builtInLabels: OPTION_BUILT_IN_LABELS[list.key] ?? [],
    items: (itemsByList.get(list.id) ?? []).filter((i) => !i.retiredAt),
  }));
}

export async function getOptionCatalog(studioId: number, key: OptionListKey) {
  const lists = await db
    .select()
    .from(optionLists)
    .where(and(eq(optionLists.studioId, studioId), eq(optionLists.key, key)))
    .limit(1);

  const list = lists[0];
  if (!list) {
    throw new SettingsServiceError("Option list not found.", 404);
  }

  const items = await db
    .select()
    .from(optionItems)
    .where(eq(optionItems.listId, list.id))
    .orderBy(asc(optionItems.sortOrder), asc(optionItems.id));

  return {
    ...list,
    builtInUntilSeeded: catalogStartsBuiltIn(list.key) && !list.seeded,
    builtInLabels: OPTION_BUILT_IN_LABELS[list.key] ?? [],
    items: items.filter((i) => !i.retiredAt),
  };
}

export async function seedOptionCatalog(studioId: number, key: OptionListKey) {
  const catalog = await getOptionCatalog(studioId, key);

  if (catalog.seeded) {
    return catalog;
  }

  const labels =
    OPTION_BUILT_IN_LABELS[key] ?? OPTION_DEFAULT_LABELS[key] ?? [];

  if (labels.length === 0) {
    await db
      .update(optionLists)
      .set({ seeded: true })
      .where(eq(optionLists.id, catalog.id));
    return getOptionCatalog(studioId, key);
  }

  const existingLabels = new Set(
    catalog.items.map((item) => item.label.trim().toLowerCase()),
  );
  const toInsert = labels.filter(
    (label) => !existingLabels.has(label.trim().toLowerCase()),
  );
  const baseSort =
    catalog.items.length === 0
      ? 0
      : Math.max(...catalog.items.map((i) => i.sortOrder)) + 1;

  await db.transaction(async (tx) => {
    await tx
      .update(optionLists)
      .set({ seeded: true })
      .where(eq(optionLists.id, catalog.id));

    if (toInsert.length > 0) {
      await tx.insert(optionItems).values(
        toInsert.map((label, index) => ({
          listId: catalog.id,
          label,
          sortOrder: baseSort + index,
        })),
      );
    }
  });

  return getOptionCatalog(studioId, key);
}

export async function addOptionItem(
  studioId: number,
  key: OptionListKey,
  label: string,
) {
  const catalog = await getOptionCatalog(studioId, key);

  if (catalogStartsBuiltIn(key) && !catalog.seeded) {
    throw new SettingsServiceError(
      "List is built-in. Make it editable before adding items.",
      400,
    );
  }

  const trimmed = label.trim();
  if (!trimmed) {
    throw new SettingsServiceError("Label is required.", 400);
  }

  const existing = catalog.items.find(
    (item) => item.label.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) {
    return { catalog, itemId: existing.id };
  }

  const sortOrder =
    catalog.items.length === 0
      ? 0
      : Math.max(...catalog.items.map((i) => i.sortOrder)) + 1;

  const result = await db.insert(optionItems).values({
    listId: catalog.id,
    label: trimmed,
    sortOrder,
  });

  if (!catalog.seeded) {
    await db
      .update(optionLists)
      .set({ seeded: true })
      .where(eq(optionLists.id, catalog.id));
  }

  return getOptionCatalog(studioId, key).then((c) => ({
    catalog: c,
    itemId: result[0].insertId,
  }));
}

export async function updateOptionItem(
  studioId: number,
  itemId: number,
  input: { label?: string; sortOrder?: number; retire?: boolean },
) {
  const rows = await db
    .select({
      item: optionItems,
      list: optionLists,
    })
    .from(optionItems)
    .innerJoin(optionLists, eq(optionItems.listId, optionLists.id))
    .where(
      and(eq(optionItems.id, itemId), eq(optionLists.studioId, studioId)),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new SettingsServiceError("Option item not found.", 404);
  }

  if (catalogStartsBuiltIn(row.list.key) && !row.list.seeded) {
    throw new SettingsServiceError(
      "List is built-in. Make it editable before changing items.",
      400,
    );
  }

  const updates: Partial<typeof optionItems.$inferInsert> = {};
  if (input.label !== undefined) {
    const label = input.label.trim();
    if (!label) throw new SettingsServiceError("Label cannot be empty.", 400);
    updates.label = label;
  }
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.retire === true) updates.retiredAt = new Date();
  if (input.retire === false) updates.retiredAt = null;

  if (Object.keys(updates).length === 0) {
    throw new SettingsServiceError(
      "At least one field is required to update.",
      400,
    );
  }

  await db
    .update(optionItems)
    .set(updates)
    .where(eq(optionItems.id, itemId));

  return getOptionCatalog(studioId, row.list.key);
}

export async function listReminderRules(studioId: number) {
  return db
    .select()
    .from(reminderRules)
    .where(eq(reminderRules.studioId, studioId))
    .orderBy(asc(reminderRules.id));
}

export async function replaceReminderRules(
  studioId: number,
  rules: { days: number; dir: "before" | "after" | "on"; enabled: boolean }[],
) {
  await getStudioSettings(studioId);

  await db.transaction(async (tx) => {
    await tx
      .delete(reminderRules)
      .where(eq(reminderRules.studioId, studioId));

    if (rules.length > 0) {
      await tx.insert(reminderRules).values(
        rules.map((rule) => ({
          studioId,
          days: rule.dir === "on" ? 0 : rule.days,
          dir: rule.dir,
          enabled: rule.enabled,
        })),
      );
    }
  });

  return listReminderRules(studioId);
}

export { isOptionListKey };
