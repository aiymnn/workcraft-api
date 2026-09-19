import {
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { studios } from "./studios.js";

export const emailTemplates = mysqlTable(
  "email_templates",
  {
    id: int("id").autoincrement().primaryKey(),

    studioId: int("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),

    type: varchar("type", { length: 32 }).notNull(),

    title: varchar("title", { length: 200 }).notNull(),

    subject: varchar("subject", { length: 500 }).notNull(),

    body: text("body").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("email_templates_studio_type_uidx").on(
      table.studioId,
      table.type,
    ),
  ],
);

export const whatsappTemplates = mysqlTable(
  "whatsapp_templates",
  {
    id: int("id").autoincrement().primaryKey(),

    studioId: int("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),

    type: varchar("type", { length: 32 }).notNull(),

    title: varchar("title", { length: 200 }).notNull(),

    body: text("body").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("whatsapp_templates_studio_type_uidx").on(
      table.studioId,
      table.type,
    ),
  ],
);
