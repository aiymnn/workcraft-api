import {
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { clients } from "./clients.js";
import { studios } from "./studios.js";

export const quotations = mysqlTable("quotations", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  clientId: int("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),

  number: varchar("number", { length: 64 }),

  status: mysqlEnum("status", ["DRAFT", "SENT", "ACCEPTED", "LOST"])
    .notNull()
    .default("DRAFT"),

  currency: varchar("currency", { length: 8 }).notNull().default("MYR"),

  intro: text("intro"),

  notes: text("notes"),

  totalAmount: decimal("total_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),

  publicToken: varchar("public_token", { length: 64 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const quotationLineItems = mysqlTable("quotation_line_items", {
  id: int("id").autoincrement().primaryKey(),

  quotationId: int("quotation_id")
    .notNull()
    .references(() => quotations.id, { onDelete: "cascade" }),

  packageId: int("package_id"),

  name: varchar("name", { length: 200 }).notNull(),

  description: text("description"),

  quantity: decimal("quantity", { precision: 10, scale: 2 })
    .notNull()
    .default("1"),

  unitPrice: decimal("unit_price", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),

  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),

  sortOrder: int("sort_order").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quotationSessions = mysqlTable("quotation_sessions", {
  id: int("id").autoincrement().primaryKey(),

  quotationId: int("quotation_id")
    .notNull()
    .references(() => quotations.id, { onDelete: "cascade" }),

  ceremonyTypeItemId: int("ceremony_type_item_id"),

  label: varchar("label", { length: 200 }),

  startsAt: timestamp("starts_at"),

  endsAt: timestamp("ends_at"),

  venue: varchar("venue", { length: 255 }),

  sortOrder: int("sort_order").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quotationPaymentRows = mysqlTable("quotation_payment_rows", {
  id: int("id").autoincrement().primaryKey(),

  quotationId: int("quotation_id")
    .notNull()
    .references(() => quotations.id, { onDelete: "cascade" }),

  label: varchar("label", { length: 200 }).notNull(),

  type: mysqlEnum("type", ["FIXED", "PCT_TOTAL", "PCT_REMAINING"]).notNull(),

  value: decimal("value", { precision: 12, scale: 2 }).notNull().default("0"),

  dueN: int("due_n").notNull().default(0),

  dueUnit: mysqlEnum("due_unit", ["DAYS", "WEEKS", "MONTHS"])
    .notNull()
    .default("DAYS"),

  dueAnchor: mysqlEnum("due_anchor", ["TODAY", "BEFORE_SHOOT", "AFTER_SHOOT"])
    .notNull()
    .default("TODAY"),

  sortOrder: int("sort_order").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quotationContracts = mysqlTable("quotation_contracts", {
  id: int("id").autoincrement().primaryKey(),

  quotationId: int("quotation_id")
    .notNull()
    .references(() => quotations.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 200 }).notNull(),

  body: text("body").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
