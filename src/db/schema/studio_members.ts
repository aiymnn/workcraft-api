import {
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { optionItems } from "./option_lists.js";
import { studios } from "./studios.js";
import { users } from "./users.js";

export const studioMembers = mysqlTable(
  "studio_members",
  {
    id: int("id").autoincrement().primaryKey(),

    studioId: int("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),

    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    access: mysqlEnum("access", ["OWNER", "ADMIN", "MEMBER"])
      .notNull()
      .default("MEMBER"),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("studio_members_studio_user_uidx").on(
      table.studioId,
      table.userId,
    ),
  ],
);

export const studioMemberCrafts = mysqlTable(
  "studio_member_crafts",
  {
    studioMemberId: int("studio_member_id")
      .notNull()
      .references(() => studioMembers.id, { onDelete: "cascade" }),

    optionItemId: int("option_item_id")
      .notNull()
      .references(() => optionItems.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.studioMemberId, table.optionItemId],
    }),
  ],
);
