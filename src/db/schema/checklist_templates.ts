import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { studios } from "./studios.js";

export const checklistTemplates = mysqlTable("checklist_templates", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 200 }).notNull(),

  isDefault: boolean("is_default").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const checklistTemplateItems = mysqlTable("checklist_template_items", {
  id: int("id").autoincrement().primaryKey(),

  templateId: int("template_id")
    .notNull()
    .references(() => checklistTemplates.id, { onDelete: "cascade" }),

  label: varchar("label", { length: 255 }).notNull(),

  phase: mysqlEnum("phase", ["BEFORE", "ON_DAY", "AFTER"]).notNull(),

  sortOrder: int("sort_order").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
