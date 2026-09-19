import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { jobs } from "./jobs.js";
import { studios } from "./studios.js";

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  jobId: int("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),

  number: varchar("number", { length: 64 }),

  status: mysqlEnum("status", ["DRAFT", "SENT", "PAID", "VOID"])
    .notNull()
    .default("DRAFT"),

  notes: text("notes"),

  templateId: varchar("template_id", { length: 32 }).notNull().default("BASIC"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const invoiceMilestones = mysqlTable("invoice_milestones", {
  id: int("id").autoincrement().primaryKey(),

  invoiceId: int("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),

  label: varchar("label", { length: 200 }).notNull(),

  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),

  dueDate: timestamp("due_date"),

  sortOrder: int("sort_order").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  jobId: int("job_id").references(() => jobs.id, { onDelete: "set null" }),

  milestoneId: int("milestone_id").references(() => invoiceMilestones.id, {
    onDelete: "set null",
  }),

  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),

  status: mysqlEnum("status", ["PAID", "UNPAID", "WRITTEN_OFF"])
    .notNull()
    .default("UNPAID"),

  paidAt: timestamp("paid_at"),

  payMethodItemId: int("pay_method_item_id"),

  bankItemId: int("bank_item_id"),

  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  jobId: int("job_id").references(() => jobs.id, { onDelete: "set null" }),

  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),

  categoryItemId: int("category_item_id"),

  taxBucket: mysqlEnum("tax_bucket", [
    "CLAIMABLE",
    "EQUIPMENT",
    "NOT_CLAIMABLE",
    "DRAWING",
  ])
    .notNull()
    .default("CLAIMABLE"),

  spentAt: timestamp("spent_at").notNull(),

  receiptUrl: varchar("receipt_url", { length: 512 }),

  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const ownerDrawings = mysqlTable("owner_drawings", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),

  drawnAt: timestamp("drawn_at").notNull(),

  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const otherIncome = mysqlTable("other_income", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),

  categoryItemId: int("category_item_id"),

  countsTowardProfit: boolean("counts_toward_profit").notNull().default(true),

  receivedAt: timestamp("received_at").notNull(),

  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
