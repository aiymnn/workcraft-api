import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
} from "drizzle-orm/mysql-core";
import { studios } from "./studios.js";

export const reminderRules = mysqlTable("reminder_rules", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  days: int("days").notNull().default(0),

  dir: mysqlEnum("dir", ["before", "after", "on"]).notNull(),

  enabled: boolean("enabled").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
