import {
  int,
  mysqlTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { optionItems } from "./option_lists.js";
import { studios } from "./studios.js";
import { users } from "./users.js";

export const crewContacts = mysqlTable("crew_contacts", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 200 }).notNull(),

  phone: varchar("phone", { length: 32 }),

  email: varchar("email", { length: 255 }),

  /** Reserved for future freelancer login — null by default. */
  userId: int("user_id").references(() => users.id, { onDelete: "set null" }),

  retiredAt: timestamp("retired_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const crewContactCrafts = mysqlTable(
  "crew_contact_crafts",
  {
    crewContactId: int("crew_contact_id")
      .notNull()
      .references(() => crewContacts.id, { onDelete: "cascade" }),

    optionItemId: int("option_item_id")
      .notNull()
      .references(() => optionItems.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.crewContactId, table.optionItemId],
    }),
  ],
);
