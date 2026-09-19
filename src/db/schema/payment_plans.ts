import {
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { studios } from "./studios.js";

export const paymentPlanTemplates = mysqlTable("payment_plan_templates", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 200 }).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const paymentPlanMilestones = mysqlTable("payment_plan_milestones", {
  id: int("id").autoincrement().primaryKey(),

  planId: int("plan_id")
    .notNull()
    .references(() => paymentPlanTemplates.id, { onDelete: "cascade" }),

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
