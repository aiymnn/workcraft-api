import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { studios } from "./studios.js";

export const optionListKeys = [
  "CEREMONY_TYPE",
  "JOB_TYPE",
  "LEAD_SOURCE",
  "PAY_METHOD",
  "EXPENSE_CAT",
  "INCOME_CAT",
  "CANCEL_REASON",
  "BANK",
  "CREW_ROLE",
  "CRAFT",
  "EQUIP_LOCATION",
] as const;

export type OptionListKey = (typeof optionListKeys)[number];

export const optionLists = mysqlTable(
  "option_lists",
  {
    id: int("id").autoincrement().primaryKey(),

    studioId: int("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),

    key: mysqlEnum("key", [...optionListKeys]).notNull(),

    seeded: boolean("seeded").notNull().default(false),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("option_lists_studio_key_uidx").on(table.studioId, table.key),
  ],
);

export const optionItems = mysqlTable("option_items", {
  id: int("id").autoincrement().primaryKey(),

  listId: int("list_id")
    .notNull()
    .references(() => optionLists.id, { onDelete: "cascade" }),

  label: varchar("label", { length: 200 }).notNull(),

  sortOrder: int("sort_order").notNull().default(0),

  retiredAt: timestamp("retired_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
