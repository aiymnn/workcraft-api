import {
  boolean,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { studios } from "./studios.js";

export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 200 }).notNull(),

  phone: varchar("phone", { length: 32 }),

  email: varchar("email", { length: 255 }),

  nricOrSsm: varchar("nric_or_ssm", { length: 64 }),

  tin: varchar("tin", { length: 64 }),

  socialHandle: varchar("social_handle", { length: 120 }),

  address: text("address"),

  whatsappConsent: boolean("whatsapp_consent").notNull().default(false),

  retiredAt: timestamp("retired_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
