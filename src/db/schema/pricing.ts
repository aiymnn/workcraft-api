import {
  decimal,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { studios } from "./studios.js";

export const pricingOpex = mysqlTable("pricing_opex", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  /** Flexible OPEX lines / statutory params until product freezes shape. */
  payload: json("payload").$type<Record<string, unknown>>().notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const pricingTargets = mysqlTable("pricing_targets", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  jobsPerMonth: int("jobs_per_month").notNull().default(0),

  avgPrice: decimal("avg_price", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),

  profitGoal: decimal("profit_goal", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const pricingSavedCalcs = mysqlTable("pricing_saved_calcs", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 200 }).notNull(),

  sellPrice: decimal("sell_price", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),

  directCost: decimal("direct_cost", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),

  verdict: varchar("verdict", { length: 32 }),

  notes: text("notes"),

  packageId: int("package_id"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
