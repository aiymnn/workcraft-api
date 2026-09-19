import {
  mysqlTable,
  int,
  primaryKey,
  timestamp,
} from "drizzle-orm/mysql-core";
import { users } from "./users.js";
import { roles } from "./roles.js";

export const userRoles = mysqlTable(
  "user_roles",
  {
    userId: int("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    roleId: int("role_id")
      .notNull()
      .references(() => roles.id, {
        onDelete: "cascade",
      }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.roleId],
    }),
  ],
);
