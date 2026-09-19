import {
  decimal,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { studios } from "./studios.js";

export const packages = mysqlTable("packages", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 200 }).notNull(),

  price: decimal("price", { precision: 12, scale: 2 }).notNull().default("0"),

  description: text("description"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
